import { generateObject } from "ai";
import { Omission, OmissionResultSchema } from "@/schemas/omission";
import { getEvaluatorModel } from "./evaluateClaim";
import {
  deduplicateOmissions,
  validateSingleOmission,
} from "./validateOmissions";
import { traceStage } from "../debug/trace";

/**
 * Required system instruction for evidence-grounded context and omission analysis.
 */
export const OMISSION_DETECTOR_SYSTEM_INSTRUCTION = `You are a context and omission analysis system.

Determine whether the supplied article materially omits information necessary to correctly understand its important factual claims.

Use ONLY the supplied article, claims, claim evaluations, and evidence.

Do not browse.
Do not use outside knowledge.
Do not invent missing facts.
Do not infer political motives.
Do not label an omission merely because another detail exists.

An omission is valid only when supplied evidence shows that missing or underrepresented context could materially change a reasonable reader's interpretation of the claim.

FRAMING MISMATCH AND HEDGING RULES:
1. Only flag misleading framing or omissions when the article presents something at a HIGHER certainty than the evidence supports (e.g. asserting 'Hardik Pandya joins PBKS' as an established fact when evidence shows only talks or trade consideration), OR when it omits evidence-backed counter-information that materially changes the picture.
2. Do NOT flag 'no official confirmation' or lack of final confirmation as an omission when the article itself hedges (e.g. 'could', 'may', 'likely', 'in talks', 'reportedly'). Hedged wording that matches the state of the evidence is correct reporting, NOT an omission.
3. Every omission must be backed by concrete evidence and must cite valid evidence IDs from the supplied evidence set.

Consider:
- scope
- timing
- magnitude
- causality
- conditions
- attribution
- legal meaning
- statistical baseline
- important qualifications
- strong counter-evidence

Do not require an article to include every perspective or every fact.

Do not treat disagreement alone as proof of omission.

If the evidence does not establish material omitted context, return no omission.

Use only supplied evidence IDs.`;

/**
 * Compact input representation for omission detection.
 */
export interface CompactContextInput {
  article: {
    title: string;
    description: string | null;
    contentExcerpt: string;
    sourceDomain: string;
  };
  prioritizedClaims: Array<{
    id: string;
    text: string;
    importance: string;
    claimType: string;
    evaluationVerdict: string;
    evaluationConfidence: string;
    evaluationExplanation: string;
    importantNotes: string[];
  }>;
  evidence: Array<{
    evidenceId: string;
    claimId: string;
    title: string;
    domain: string;
    url: string;
    sourceType: string;
    sourceRelationship: string;
    evidenceQuality: string;
    snippet: string;
    sourceContentExcerpt?: string | null;
  }>;
}

/**
 * Function signature for custom omission detectors (live LLM or mock).
 */
export type OmissionDetectorFn = (
  input: CompactContextInput
) => Promise<unknown>;

/**
 * Executes omission detection over prepared compact context.
 *
 * Rules:
 * - Uses structured output + Zod
 * - Never invents facts or IDs
 * - Validates every omission against supplied evidence set
 * - Deduplicates similar omissions
 */
export async function detectOmissions(
  input: CompactContextInput,
  validEvidenceIds: Set<string>,
  validClaimIds: Set<string>,
  customDetector?: OmissionDetectorFn
): Promise<Omission[]> {
  // If no prioritized claims or no evidence, return empty omissions without calling model
  if (input.prioritizedClaims.length === 0 || input.evidence.length === 0) {
    return [];
  }

  let rawOutput: unknown;

  if (customDetector) {
    rawOutput = await customDetector(input);
  } else {
    const model = getEvaluatorModel();
    if (!model) {
      const configErr = Object.assign(
        new Error(
          "No LLM provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY or ANTHROPIC_API_KEY in server environment."
        ),
        { code: "CONFIG_ERROR" }
      );
      throw configErr;
    }

    const userPrompt = JSON.stringify(input, null, 2);

    const result = await generateObject({
      model,
      schema: OmissionResultSchema,
      system: OMISSION_DETECTOR_SYSTEM_INSTRUCTION,
      prompt: `Analyze the following article presentation and prioritized claims against supplied evidence to determine if any material omissions exist.\n\nContext Data:\n${userPrompt}`,
    });

    rawOutput = result.object;
  }

  // Validate output structure (supports both { omissions: [...] } and direct array [...])
  const rawList = Array.isArray(rawOutput)
    ? rawOutput
    : (rawOutput as { omissions?: unknown[] })?.omissions;
  if (!Array.isArray(rawList)) {
    return [];
  }

  const validatedOmissions: Omission[] = [];
  const discardedOmissions: Array<{ rawItem: unknown; reason: string }> = [];

  for (const rawItem of rawList) {
    const validation = validateSingleOmission(
      rawItem,
      validEvidenceIds,
      validClaimIds
    );

    if (validation.isValid) {
      // Hedging Rule: Do NOT flag "no official confirmation" as an omission when the article itself hedges
      const descLower = validation.omission.description.toLowerCase();
      const articleText = `${input.article.title} ${input.article.contentExcerpt}`.toLowerCase();
      const isArticleHedged =
        /\b(could|may|might|likely|potential|considering|in talks|exploring|what if|scenario|rumour|rumor|reportedly|speculat)\b/i.test(
          articleText
        );
      const isConfirmationOmission =
        descLower.includes("no official confirmation") ||
        descLower.includes("unconfirmed") ||
        descLower.includes("not confirmed") ||
        descLower.includes("no confirmation has been");

      if (isArticleHedged && isConfirmationOmission) {
        discardedOmissions.push({
          rawItem,
          reason: "Article itself hedges; lack of official confirmation is not an omission when properly hedged",
        });
        continue;
      }

      validatedOmissions.push(validation.omission);
    } else {
      discardedOmissions.push({
        rawItem,
        reason: validation.error || "Validation failed",
      });
    }
  }

  // Deduplicate omissions based on claimId, type, and semantic overlap
  const finalOmissions = deduplicateOmissions(validatedOmissions);

  try {
    traceStage("omissions", {
      detected: finalOmissions.map((o) => ({
        id: o.id,
        claimId: o.claimId,
        type: o.type,
        severity: o.severity,
        evidenceIds: o.evidenceIds,
        description: o.description,
        whyItMatters: o.whyItMatters,
      })),
      discarded: discardedOmissions,
    });
  } catch {}

  return finalOmissions;
}
