import { generateObject } from "ai";
import { z } from "zod";
import { ClaimInput } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import {
  VeracityVerdict,
  VerificationConfidence,
  Conclusion,
  ComparisonReport,
} from "@/schemas/verification";
import { getEvaluatorModel } from "./evaluateClaim";
import { ConclusionClaim } from "./conclusion";

export interface SummaryInput {
  article: {
    title: string;
    sourceDomain: string;
  };
  claims: ConclusionClaim[];
  evaluations: ClaimEvaluation[];
  omissions: Omission[];
  score: number;
  veracityVerdict: VeracityVerdict;
  confidence: VerificationConfidence;
  conclusion?: Conclusion;
  comparison?: ComparisonReport;
  sourceReadStatus?: string;
  isUnreadable?: boolean;
  independentClustersCount?: number;
  customGenerator?: (input: SummaryInput) => Promise<string>;
}

const SummaryResultSchema = z.object({
  summary: z.string().trim().min(1, { message: "Summary cannot be empty" }),
});

export const SUMMARY_SYSTEM_PROMPT = `You are an objective news verification summarizer.

Produce a concise, plain-language verification summary (3-5 sentences) in this exact order:
1. Sentence (a): What the story reports. If claims are allegations or rumours, describe them as allegations and rumours; never state an unverified claim as fact.
2. Sentence (b): What independent reporting confirms. If the claim is an attributed quote or allegation, clearly distinguish whether independent reporting confirms that the statement was made versus whether the underlying accusation is proven. Do not repeat the exact phrasing of sentence (a).
3. Sentence (c): What is disputed, unconfirmed, or missing context.
4. Sentence (d): The bottom line strictly matching the supplied conclusion label.

STRICT GROUNDING RULES:
- You receive ONLY the claims (with layers and certainty), evaluations, comparison outcomes, and the conclusion label.
- Do NOT add facts, names, numbers, dates, or sources that are not in the input data.
- Write in your own words. Do not copy sentences from the article. Any quote must be under 15 words and attributed.
- If isUnreadable is true, state clearly that this check is based on independent reporting of the same story.
- Your final bottom line sentence must match the conclusion label (e.g. True, Mostly true, Partly true, Unconfirmed, Misleading, False, Can't verify). Never contradict the conclusion label.`;

/**
 * Human-friendly verdict labels for summary generation
 */
export function formatVerdictLabel(verdict: VeracityVerdict): string {
  switch (verdict) {
    case "verified_true":
      return "Verified True";
    case "mostly_true":
      return "Mostly True";
    case "mixed":
      return "Mixed";
    case "misleading":
      return "Misleading";
    case "mostly_false":
      return "Mostly False";
    case "false":
      return "False";
    case "unverified":
      return "Unverified";
    case "could_not_read":
      return "Couldn't read this article";
    default:
      return "Unverified";
  }
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates that the generated summary adheres to strict grounding constraints:
 * 1. Contains no numbers not present in the input data
 * 2. Contains no proper names/entities not present in the input data
 * 3. Does not contradict the deterministic conclusion label
 * 4. Includes the unreadable basis note if the original source was unreadable
 */
export function validateSummary(summary: string, input: SummaryInput): ValidationResult {
  if (!summary || !summary.trim()) {
    return { isValid: false, reason: "Summary is empty" };
  }

  // Gather all allowed text from input data
  const allowedTexts = [
    input.article.title,
    input.article.sourceDomain,
    ...input.claims.map((c) => c.text),
    ...input.evaluations.map((e) => e.explanation),
    ...input.omissions.map((o) => `${o.description} ${o.whyItMatters}`),
    input.conclusion?.label || "",
    input.conclusion?.explanation || "",
    ...(input.comparison?.claims.flatMap((c) =>
      c.dimensions.map(
        (d) =>
          `${d.dimension} ${d.articleValue || ""} ${d.sourceValues?.map((s) => s.value).join(" ") || ""}`
      )
    ) || []),
    String(input.score),
    "100",
    String(input.independentClustersCount ?? input.comparison?.totalIndependentClusters ?? 0),
  ].join(" ").toLowerCase();

  // 1. Validate Numbers: Any number in summary must appear in input data
  const summaryNumbers = summary.match(/\b\d+(?:[\.,]\d+)?\b/g) || [];
  for (const num of summaryNumbers) {
    const cleanNum = num.replace(/,/g, "");
    if (!allowedTexts.includes(num.toLowerCase()) && !allowedTexts.includes(cleanNum)) {
      return {
        isValid: false,
        reason: `Summary contains number "${num}" not present in input report data.`,
      };
    }
  }

  // 2. Validate Names: Any capitalized proper name (excluding start of sentence and standard vocabulary)
  const sentences = summary.split(/(?<=[.?!])\s+/);
  const commonWords = new Set([
    "a", "an", "the", "this", "that", "these", "those", "in", "on", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "out", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should",
    "would", "could", "may", "might", "must", "shall", "ought",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing",
    "it", "its", "it's", "he", "him", "his", "she", "her", "hers", "they", "them", "their", "theirs",
    "we", "us", "our", "ours", "you", "your", "yours", "i", "me", "my", "mine",
    "what", "which", "who", "whom", "whose", "if", "as", "but", "and", "or",
    "now", "overall", "however", "additionally", "furthermore", "meanwhile", "crucially",
    "independent", "reporting", "records", "evidence", "claim", "claims", "article", "story",
    "conclusion", "verified", "unverified", "false", "true", "mostly", "partly", "misleading",
    "rumour", "rumor", "allegation", "allegations", "fact", "facts", "details", "summary",
    "according", "public", "source", "sources", "check", "based", "first", "second", "third",
    "available", "official", "central", "primary", "while", "though", "although", "despite",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december"
  ]);

  const allowedWords = new Set(
    allowedTexts
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
  );

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const rawWord = words[i].replace(/^[^\w]+|[^\w]+$/g, "");
      if (!rawWord) continue;
      if (/^[A-Z][a-z]+$/.test(rawWord)) {
        const lower = rawWord.toLowerCase();
        if (!commonWords.has(lower) && !allowedWords.has(lower)) {
          return {
            isValid: false,
            reason: `Summary contains proper name/entity "${rawWord}" not present in input report data.`,
          };
        }
      }
    }
  }

  // 3. Validate Conclusion Alignment: Must not contradict conclusion label
  const conclusionLabel = input.conclusion?.label;
  const lowerSummary = summary.toLowerCase();

  if (conclusionLabel === "False") {
    if (
      lowerSummary.includes("is true") ||
      lowerSummary.includes("is verified as true") ||
      lowerSummary.includes("all claims are true") ||
      lowerSummary.includes("fully accurate")
    ) {
      return {
        isValid: false,
        reason: 'Summary asserts truth but conclusion label is "False".',
      };
    }
  } else if (conclusionLabel === "True") {
    if (
      lowerSummary.includes("is false") ||
      lowerSummary.includes("is fabricated") ||
      lowerSummary.includes("completely unverified") ||
      lowerSummary.includes("remains unconfirmed")
    ) {
      return {
        isValid: false,
        reason: 'Summary asserts falsehood/unconfirmed but conclusion label is "True".',
      };
    }
  } else if (conclusionLabel === "Unconfirmed") {
    if (
      lowerSummary.includes("conclusively proven") ||
      lowerSummary.includes("definitely true") ||
      lowerSummary.includes("confirmed beyond doubt") ||
      lowerSummary.includes("is definitively false")
    ) {
      return {
        isValid: false,
        reason: 'Summary asserts definitive truth/falsehood but conclusion label is "Unconfirmed".',
      };
    }
  } else if (conclusionLabel === "Can't verify") {
    if (
      lowerSummary.includes("is verified true") ||
      lowerSummary.includes("proven false")
    ) {
      return {
        isValid: false,
        reason: 'Summary asserts definitive verification but conclusion label is "Can\'t verify".',
      };
    }
  }

  // 4. Validate unreadable basis note
  const isUnreadable =
    input.isUnreadable ||
    input.sourceReadStatus === "unreadable" ||
    input.sourceReadStatus === "failed" ||
    input.sourceReadStatus === "could_not_read";

  if (isUnreadable) {
    const hasBasisMention =
      lowerSummary.includes("independent reporting") ||
      lowerSummary.includes("independent reports") ||
      lowerSummary.includes("could not be read") ||
      lowerSummary.includes("could not read");
    if (!hasBasisMention) {
      return {
        isValid: false,
        reason: "Unreadable article summary must state that check is based on independent reporting.",
      };
    }
  }

  return { isValid: true };
}

/**
 * Fast, deterministic templated summary generator.
 * Strictly implements the 4 required parts (a)-(b)-(c)-(d) grounded entirely in report data.
 */
export function generateTemplatedSummary(input: SummaryInput): string {
  const sentences: string[] = [];
  const evalMap = new Map<string, ClaimEvaluation>();
  input.evaluations.forEach((e) => evalMap.set(e.claimId, e));

  const isUnreadable =
    input.isUnreadable ||
    input.sourceReadStatus === "unreadable" ||
    input.sourceReadStatus === "failed" ||
    input.sourceReadStatus === "could_not_read";

  // (a) What the story reports
  const primaryClaim = input.claims[0];
  const claimText = primaryClaim ? primaryClaim.text : input.article.title;
  const isStatement = primaryClaim?.layer === "statement_made";
  const isRumour =
    primaryClaim?.certainty === "speculation" ||
    primaryClaim?.certainty === "reported_claim" ||
    isStatement ||
    /\b(rumour|rumor|allegation|alleged)\b/i.test(claimText);

  let sentenceA = "";
  if (isUnreadable) {
    sentenceA = `This check is based on independent reporting of the same story, as the original article could not be directly read.`;
  } else if (isStatement) {
    sentenceA = `The story reports that ${claimText}.`;
  } else if (isRumour) {
    sentenceA = `The submitted reporting highlights an unconfirmed rumour that ${claimText}.`;
  } else {
    sentenceA = `The story reports that ${claimText}.`;
  }
  sentences.push(sentenceA);

  // (b) What independent reporting confirms
  const supported = input.claims.filter((c) => evalMap.get(c.id)?.verdict === "supporting");
  let sentenceB = "";
  if (supported.length > 0) {
    const isDuplicateText =
      supported[0].text.trim().toLowerCase() === claimText.trim().toLowerCase() ||
      sentenceA.toLowerCase().includes(supported[0].text.trim().toLowerCase());

    if (isDuplicateText) {
      if (isStatement) {
        sentenceB = `Independent reporting confirms that the public statement was made, though the underlying assertions remain unconfirmed.`;
      } else {
        sentenceB = `Independent reporting and public records corroborate these core assertions.`;
      }
    } else {
      sentenceB = `Independent reporting and public records corroborate that ${supported[0].text}.`;
    }
  } else if (isUnreadable && !sentenceA.includes("independent reporting")) {
    sentenceB = `Independent news sources have covered the same event across verified reporting.`;
  } else {
    sentenceB = `Available independent reporting has not substantiated the primary claims.`;
  }
  sentences.push(sentenceB);

  // (c) What is disputed, unconfirmed or missing
  const contradicted = input.claims.filter((c) => evalMap.get(c.id)?.verdict === "contradicting");
  const qualifying = input.claims.filter((c) => evalMap.get(c.id)?.verdict === "qualifying");
  const unconfirmed = input.claims.filter((c) => evalMap.get(c.id)?.verdict === "insufficient");

  let sentenceC = "";
  if (contradicted.length > 0) {
    sentenceC = `However, credible independent evidence directly contradicts assertions regarding ${contradicted[0].text}.`;
  } else if (qualifying.length > 0) {
    sentenceC = `However, independent evidence indicates important conditions that limit the scope of the claims.`;
  } else if (input.omissions.length > 0) {
    sentenceC = `However, the coverage omits crucial context: ${input.omissions[0].description}.`;
  } else if (unconfirmed.length > 0) {
    sentenceC = `However, key supporting details remain unconfirmed across independent accounts.`;
  } else {
    sentenceC = `No major factual disputes or material omissions were identified.`;
  }
  sentences.push(sentenceC);

  // (d) The bottom line matching the conclusion label
  const label = input.conclusion?.label || formatVerdictLabel(input.veracityVerdict);
  let sentenceD = "";
  switch (label) {
    case "True":
      sentenceD = "In conclusion, the central story is fully verified as true.";
      break;
    case "Mostly true":
      sentenceD = "In conclusion, the story is mostly true, with minor details unconfirmed.";
      break;
    case "Partly true":
      sentenceD = "In conclusion, the story is partly true, combining corroborated facts with unproven assertions.";
      break;
    case "Unconfirmed":
      sentenceD = "In conclusion, the claims remain unconfirmed by independent evidence.";
      break;
    case "Misleading":
      sentenceD = "In conclusion, the story is misleading due to missing context and unverified framing.";
      break;
    case "False":
      sentenceD = "In conclusion, the central assertions in the story are false.";
      break;
    case "Can't verify":
      sentenceD = "In conclusion, available evidence is insufficient to verify the story.";
      break;
    default:
      sentenceD = `In conclusion, the story is evaluated as ${label.toLowerCase()}.`;
      break;
  }
  sentences.push(sentenceD);

  return sentences.join(" ");
}

/**
 * Backward compatibility alias for generateTemplatedSummary
 */
export const generateDeterministicSummary = generateTemplatedSummary;

/**
 * Generates an explainable natural language summary grounded strictly in the verified data.
 * Validates that no unauthorized numbers or names appear and that the conclusion label is not contradicted.
 * Retries up to 2 times on validation failure before falling back to the template.
 */
export async function generateSummary(input: SummaryInput): Promise<string> {
  const maxRetries = 2;

  // If custom generator provided (e.g. in tests)
  if (input.customGenerator) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const candidate = await input.customGenerator(input);
        const validation = validateSummary(candidate, input);
        if (validation.isValid) {
          return candidate.trim();
        }
      } catch {}
    }
    return generateTemplatedSummary(input);
  }

  const model = getEvaluatorModel();
  if (!model) {
    return generateTemplatedSummary(input);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const promptPayload = {
        articleTitle: input.article.title,
        sourceDomain: input.article.sourceDomain,
        conclusionLabel: input.conclusion?.label || formatVerdictLabel(input.veracityVerdict),
        conclusionExplanation: input.conclusion?.explanation,
        isUnreadable: Boolean(
          input.isUnreadable ||
          input.sourceReadStatus === "unreadable" ||
          input.sourceReadStatus === "failed" ||
          input.sourceReadStatus === "could_not_read"
        ),
        claims: input.claims.map((c) => {
          const ev = input.evaluations.find((e) => e.claimId === c.id);
          return {
            id: c.id,
            text: c.text,
            layer: c.layer || "underlying_fact",
            certainty: c.certainty || "asserted_fact",
            importance: c.importance,
            verdict: ev?.verdict || "insufficient",
            confidence: ev?.confidence || "low",
            explanation: ev?.explanation || "",
          };
        }),
        comparisonOutcomes: {
          independentClustersCount: input.independentClustersCount ?? input.comparison?.totalIndependentClusters ?? 0,
          totalConflicts: input.comparison?.totalConflicts ?? 0,
          totalUnresolvedDimensions: input.comparison?.totalUnresolvedDimensions ?? 0,
        },
        omissions: input.omissions.map((o) => ({
          description: o.description,
          whyItMatters: o.whyItMatters,
        })),
      };

      const result = await generateObject({
        model,
        schema: SummaryResultSchema,
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: `Generate an objective verification summary for this analyzed news article:\n\n${JSON.stringify(promptPayload, null, 2)}`,
      });

      if (result.object?.summary) {
        const validation = validateSummary(result.object.summary, input);
        if (validation.isValid) {
          return result.object.summary.trim();
        }
      }
    } catch {
      // Model error or timeout
    }
  }

  return generateTemplatedSummary(input);
}
