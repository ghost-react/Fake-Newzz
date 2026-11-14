import { Article } from "@/schemas/article";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import {
  CompactContextInput,
  detectOmissions,
  OmissionDetectorFn,
} from "./detectOmissions";

export interface ContextAnalysisOptions {
  customDetector?: OmissionDetectorFn;
  maxPrioritizedClaims?: number;
}

/**
 * Filters and prioritizes claims for omission analysis according to Phase 6 rules:
 *
 * Prioritizes:
 * 1. Claims evaluated as "contradicting" or "qualifying"
 * 2. Claims evaluated as "supporting" with important limitations / notes
 * 3. High-importance claims
 * 4. Medium-importance claims
 *
 * Skips low-importance claims unless they have non-supporting/qualifying evaluations.
 * This significantly reduces unnecessary model calls and cost while focusing on material impact.
 */
export function prioritizeClaimsForOmissionAnalysis(
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  maxClaims: number = 6
): Array<{
  claim: ClaimInput;
  evaluation?: ClaimEvaluation;
  priorityScore: number;
}> {
  const evalMap = new Map<string, ClaimEvaluation>();
  for (const ev of evaluations) {
    evalMap.set(ev.claimId, ev);
  }

  const scored = claims.map((claim) => {
    const evaluation = evalMap.get(claim.id);
    let priorityScore = 0;

    // Phase 5 evaluation verdict weighting
    if (evaluation?.verdict === "contradicting") {
      priorityScore += 50;
    } else if (evaluation?.verdict === "qualifying") {
      priorityScore += 45;
    } else if (evaluation?.verdict === "supporting") {
      // Supporting with important notes or lower confidence implies contextual nuances
      if (evaluation.importantNotes && evaluation.importantNotes.length > 0) {
        priorityScore += 30;
      } else if (evaluation.confidence !== "high") {
        priorityScore += 20;
      } else {
        priorityScore += 10;
      }
    } else {
      // Insufficient verdict
      priorityScore += 15;
    }

    // Claim importance weighting
    if (claim.importance === "high") {
      priorityScore += 30;
    } else if (claim.importance === "medium") {
      priorityScore += 15;
    } else {
      // Low importance gets 0 base
      priorityScore += 0;
    }

    return {
      claim,
      evaluation,
      priorityScore,
    };
  });

  // Filter out low priority claims with score < 20 (e.g. low importance + plain supporting)
  const filtered = scored.filter((s) => s.priorityScore >= 15);

  // Sort descending by priority score
  filtered.sort((a, b) => b.priorityScore - a.priorityScore);

  return filtered.slice(0, maxClaims);
}

/**
 * Orchestrates Phase 6 Context and Material Omission Analysis.
 *
 * Flow:
 * 1. Prioritize important claims with contextual nuances
 * 2. Build compact context payload from article, prioritized claims, evaluations, and evidence
 * 3. Enforce traceability against verified evidence IDs
 * 4. Detect omissions using structured LLM evaluator
 * 5. Validate semantic correctness and deduplicate
 */
export async function analyzeArticleContext(
  article: Article,
  claims: ClaimInput[],
  evidence: Evidence[],
  evaluations: ClaimEvaluation[],
  options?: ContextAnalysisOptions
): Promise<Omission[]> {
  const prioritized = prioritizeClaimsForOmissionAnalysis(
    claims,
    evaluations,
    options?.maxPrioritizedClaims ?? 6
  );

  if (prioritized.length === 0 || evidence.length === 0) {
    return [];
  }

  const prioritizedClaimIds = new Set(prioritized.map((p) => p.claim.id));
  const validEvidenceIds = new Set(evidence.map((e) => e.id));
  const validClaimIds = new Set(claims.map((c) => c.id));

  // Filter evidence to those relevant to prioritized claims
  const relevantEvidence = evidence.filter((ev) =>
    prioritizedClaimIds.has(ev.claimId)
  );

  // If filtered evidence is empty, fallback to all available verified evidence
  const evidenceToUse =
    relevantEvidence.length > 0 ? relevantEvidence : evidence;

  // Build compact article content excerpt (first 2,500 chars to avoid large payloads)
  const contentExcerpt = article.content
    ? article.content.trim().slice(0, 2500)
    : "";

  const compactInput: CompactContextInput = {
    article: {
      title: article.title,
      description: article.description,
      contentExcerpt,
      sourceDomain: article.sourceDomain,
    },
    prioritizedClaims: prioritized.map(({ claim, evaluation }) => ({
      id: claim.id,
      text: claim.text,
      importance: claim.importance,
      claimType: claim.claimType,
      evaluationVerdict: evaluation?.verdict || "insufficient",
      evaluationConfidence: evaluation?.confidence || "low",
      evaluationExplanation:
        evaluation?.explanation || "No evaluation available.",
      importantNotes: evaluation?.importantNotes || [],
    })),
    evidence: evidenceToUse.map((ev) => ({
      evidenceId: ev.id,
      claimId: ev.claimId,
      title: ev.title,
      domain: ev.domain,
      url: ev.url,
      sourceType: ev.sourceType,
      sourceRelationship: ev.sourceRelationship,
      evidenceQuality: ev.evidenceQuality,
      snippet: ev.snippet.slice(0, 350),
      sourceContentExcerpt: ev.sourceContentExcerpt
        ? ev.sourceContentExcerpt.slice(0, 500)
        : null,
    })),
  };

  return detectOmissions(
    compactInput,
    validEvidenceIds,
    validClaimIds,
    options?.customDetector
  );
}
