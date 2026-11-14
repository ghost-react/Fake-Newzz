import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation, Verdict, Confidence } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import {
  ClaimSummary,
  ScoreBreakdown,
  VerificationConfidence,
  CrossSourceComparison,
  TransparentScoreExplanation,
} from "@/schemas/verification";
import { compareClaimsAcrossSources } from "../verification/crossSourceComparison";

export interface ScoreCalculationOptions {
  crossSourceComparison?: CrossSourceComparison;
  evidence?: Evidence[];
  originalPublisher?: string;
}

export interface ScoreCalculationResult {
  scoreBreakdown: ScoreBreakdown;
  confidence: VerificationConfidence;
  claimSummary: ClaimSummary;
  scoreExplanation: TransparentScoreExplanation;
  crossSourceComparison?: CrossSourceComparison;
}

/**
 * Base importance weights for claims:
 * high: 3
 * medium: 2
 * low: 1
 */
export const IMPORTANCE_WEIGHTS: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Base verdict values:
 * supporting: +1.00
 * qualifying: +0.25
 * insufficient: 0.00
 * contradicting: -1.00
 */
export const VERDICT_BASE_VALUES: Record<Verdict, number> = {
  supporting: 1.0,
  qualifying: 0.25,
  insufficient: 0.0,
  contradicting: -1.0,
};

/**
 * Confidence multipliers for claim evaluations:
 * high: 1.00
 * medium: 0.75
 * low: 0.50
 */
export const CONFIDENCE_MULTIPLIERS: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/**
 * Base penalties for omitted context by severity:
 * high: 15
 * medium: 8
 * low: 3
 */
export const OMISSION_BASE_PENALTIES: Record<string, number> = {
  high: 15,
  medium: 8,
  low: 3,
};

/**
 * Confidence multipliers for omitted context:
 * high: 1.00
 * medium: 0.75
 * low: 0.50
 */
export const OMISSION_CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/**
 * Maximum cumulative context penalty cap to prevent small/duplicate omissions
 * from destroying an otherwise well-grounded score.
 */
export const MAX_CONTEXT_PENALTY = 25;

/**
 * Confidence adjustments to the final score:
 * high: +0
 * medium: -3
 * low: -7
 */
export const CONFIDENCE_ADJUSTMENTS: Record<VerificationConfidence, number> = {
  high: 0,
  medium: -3,
  low: -7,
};

/**
 * Deterministically calculates the article-wide confidence level.
 *
 * Grounded in:
 * - Claim evaluation confidence
 * - Evidence availability
 * - High-importance insufficient claims
 * - Meaningful evidence conflicts
 * - Omission confidence
 */
export function calculateOverallConfidence(
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: {
    independentClustersCount?: number;
    has2FullTextClusters?: boolean;
  }
): VerificationConfidence {
  if (options?.independentClustersCount !== undefined && options.independentClustersCount === 0) {
    return "low";
  }

  if (claims.length === 0 || evaluations.length === 0) {
    return "low";
  }

  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  // Evidence citation availability
  const totalCitations = evaluations.reduce(
    (sum, e) => sum + (e.evidenceIds ? e.evidenceIds.length : 0),
    0
  );
  if (totalCitations === 0) {
    return "low";
  }

  // Filter out interpretation and opinion_analysis claims (they are excluded from factual evaluation)
  const factualClaims = claims.filter(
    (c) => c.layer !== "interpretation" && c.certainty !== "opinion_analysis"
  );
  const eligibleClaims = factualClaims.length > 0 ? factualClaims : claims;

  const highClaims = eligibleClaims.filter((c) => c.importance === "high");
  const claimsToCheck = highClaims.length > 0 ? highClaims : eligibleClaims;

  let insufficientCount = 0;
  let lowConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let highConfidenceCount = 0;
  let hasConflict = false;

  for (const claim of claimsToCheck) {
    const ev = evalMap.get(claim.id);
    if (!ev) {
      insufficientCount++;
      lowConfidenceCount++;
      continue;
    }

    if (ev.verdict === "insufficient") {
      insufficientCount++;
    }

    if (ev.confidence === "high") {
      highConfidenceCount++;
    } else if (ev.confidence === "medium") {
      mediumConfidenceCount++;
    } else {
      lowConfidenceCount++;
    }

    const noteText = `${ev.explanation} ${(ev.importantNotes || []).join(" ")}`.toLowerCase();
    if (
      noteText.includes("conflict") ||
      noteText.includes("contradictory evidence") ||
      noteText.includes("unresolved")
    ) {
      hasConflict = true;
    }
  }

  // Check whether other claims provide strong corroborating evidence
  const nonPrimarySupporting = evaluations.filter(
    (e) => !claimsToCheck.some((c) => c.id === e.claimId) && e.verdict === "supporting" && e.confidence !== "low"
  );

  // 1. LOW CONFIDENCE:
  // - All major claims insufficient and no other claims are supported
  // - Over half of major claims are insufficient or low confidence (without other supported claims)
  // - Unresolved conflicting evidence on major claims without high-confidence resolution
  if (
    (insufficientCount === claimsToCheck.length && nonPrimarySupporting.length === 0) ||
    (insufficientCount / claimsToCheck.length >= 0.5 && nonPrimarySupporting.length === 0) ||
    (lowConfidenceCount / claimsToCheck.length >= 0.5 && highConfidenceCount === 0 && nonPrimarySupporting.length === 0) ||
    (hasConflict && highConfidenceCount === 0)
  ) {
    return "low";
  }

  // 2. HIGH CONFIDENCE:
  // - Most important claims have high/medium confidence
  // - No high- or medium-importance insufficient claims
  // - No unresolved major evidence conflicts
  const hasUncertainMaterialClaim = factualClaims.some((c) => {
    if (c.importance === "high" || c.importance === "medium") {
      const ev = evalMap.get(c.id);
      return !ev || ev.verdict === "insufficient" || ev.confidence === "low";
    }
    return false;
  });

  if (
    !hasConflict &&
    !hasUncertainMaterialClaim &&
    insufficientCount === 0 &&
    highConfidenceCount / claimsToCheck.length >= 0.6 &&
    lowConfidenceCount === 0
  ) {
    // If a high-severity omission has low confidence, downgrade to medium confidence
    const hasUncertainHighOmission = omissions.some(
      (o) => o.severity === "high" && o.confidence === "low"
    );
    if (hasUncertainHighOmission) {
      return "medium";
    }
    if (options?.independentClustersCount === 1) {
      return "medium";
    }
    if (options?.has2FullTextClusters === false) {
      return "medium";
    }
    return "high";
  }

  // 3. MEDIUM CONFIDENCE:
  // - Some claims have medium/low confidence or evidence is incomplete
  return "medium";
}

/**
 * Deterministically calculates the article-wide trust score and score breakdown.
 *
 * Formula:
 * claimScore = 50 + 50 * (sum(weightedClaimValue) / sum(importanceWeight * 1))
 * contextPenalty = min(25, sum(omissionSeverityPenalty * omissionConfidenceMultiplier))
 * finalScore = clamp(0, 100, round(claimScore - contextPenalty + confidenceAdjustment))
 *
 * NOTE: The LLM is never asked to generate the score. All computation is pure application code.
 */
export function calculateScore(
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: ScoreCalculationOptions
): ScoreCalculationResult {
  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  // 1. Claim Weighting & Normalization (excluding interpretation layer claims)
  let positiveMaximum = 0;
  let weightedResult = 0;

  for (const claim of claims) {
    // Exclude interpretation layer claims and opinion_analysis certainty from weighted score calculation
    if (claim.layer === "interpretation" || claim.certainty === "opinion_analysis") {
      continue;
    }

    const importanceWeight = IMPORTANCE_WEIGHTS[claim.importance] ?? 2;
    positiveMaximum += importanceWeight * 1;

    const evaluation = evalMap.get(claim.id);
    const verdict: Verdict = evaluation?.verdict || "insufficient";
    const confidence: Confidence = evaluation?.confidence || "low";

    const verdictValue = VERDICT_BASE_VALUES[verdict] ?? 0;
    const confidenceMultiplier = CONFIDENCE_MULTIPLIERS[confidence] ?? 0.75;

    const weightedClaimValue = importanceWeight * verdictValue * confidenceMultiplier;
    weightedResult += weightedClaimValue;
  }

  // Zero-claim safety: prevent divide-by-zero
  let rawClaimScore = 50;
  if (claims.length > 0 && positiveMaximum > 0) {
    rawClaimScore = 50 + 50 * (weightedResult / positiveMaximum);
  }
  const clampedClaimScore = Math.max(0, Math.min(100, rawClaimScore));
  const roundedClaimScore = Math.round(clampedClaimScore);

  // 2. Omission/Context Penalty
  let rawPenalty = 0;
  for (const omission of omissions) {
    const basePenalty = OMISSION_BASE_PENALTIES[omission.severity] ?? 8;
    const confMultiplier = OMISSION_CONFIDENCE_MULTIPLIERS[omission.confidence] ?? 0.75;
    rawPenalty += basePenalty * confMultiplier;
  }
  const clampedContextPenalty = Math.min(MAX_CONTEXT_PENALTY, rawPenalty);
  const roundedContextPenalty = Math.round(clampedContextPenalty);

  // 3. Overall Confidence & Adjustment
  const overallConfidence = calculateOverallConfidence(claims, evaluations, omissions);
  const confidenceAdjustment = CONFIDENCE_ADJUSTMENTS[overallConfidence] ?? -3;

  // 4. Cross-Source Comparison & Evidence Adjustments
  let crossSourceAdjustment = 0;
  const hundredEligibilityIssues: string[] = [];

  const comparison =
    options?.crossSourceComparison ||
    (options?.evidence && options.evidence.length > 0
      ? compareClaimsAcrossSources(options.originalPublisher || "unknown", claims, options.evidence, evaluations)
      : undefined);

  if (comparison) {
    // A. Numerical conflict check (-10 points)
    if (comparison.hasNumericalConflict) {
      crossSourceAdjustment -= 10;
      hundredEligibilityIssues.push("Unresolved numerical discrepancies exist across reporting outlets.");
    }

    // B. Direct quote conflict check (-5 points)
    if (comparison.hasDirectQuoteConflict) {
      crossSourceAdjustment -= 5;
      hundredEligibilityIssues.push("Direct quotation phrasing varies materially across sources.");
    }

    // C. Syndication reliance without independent confirmation (-5 points)
    if (comparison.totalPublicationsExamined > 1 && comparison.independentSourcesCount === 0) {
      crossSourceAdjustment -= 5;
      hundredEligibilityIssues.push("Coverage relies solely on syndicated wire reports without independent reporting.");
    }

    // D. Limited snippet-only evidence (-4 points)
    const hasFullContentOrOfficial = options?.evidence?.some(
      (e) =>
        e.sourceContentStatus === "retrieved" ||
        e.sourceType === "official" ||
        e.sourceType === "primary_document"
    );
    if (options?.evidence && options.evidence.length > 0 && !hasFullContentOrOfficial) {
      crossSourceAdjustment -= 4;
      hundredEligibilityIssues.push("Evidence is limited to search snippets without full-article retrieval.");
    }

    // E. Unresolved claims check
    if (comparison.claimsUnresolvedCount > 0) {
      hundredEligibilityIssues.push(`${comparison.claimsUnresolvedCount} material claim(s) remain unverified.`);
    }

    // F. Independent source requirement for 100 score
    if (comparison.independentSourcesCount < 2 && !hasFullContentOrOfficial) {
      hundredEligibilityIssues.push("Fewer than two genuinely independent publications corroborate the story.");
    }
  }

  // 5. Final Score Calculation with Strict 100/100 Enforcement
  let rawFinalScore = roundedClaimScore - roundedContextPenalty + confidenceAdjustment + crossSourceAdjustment;

  // Invariant 4: A verdict of insufficient never reduces the score below the neutral baseline (50)
  const hasContradicting = evaluations.some((e) => e.verdict === "contradicting");
  const allInsufficientOrNeutral =
    evaluations.length > 0 &&
    evaluations.every((e) => e.verdict === "insufficient" || (e.verdict as string) === "neutral");
  if (allInsufficientOrNeutral && !hasContradicting && roundedContextPenalty === 0 && rawFinalScore < 50) {
    rawFinalScore = 50;
  }

  // A score of 100 requires:
  // - All material claims supported with high confidence (claimScore === 100)
  // - Zero context penalty
  // - High confidence
  // - Zero unresolved cross-source conflicts or syndication-only dependencies
  const is100Eligible =
    roundedClaimScore === 100 &&
    roundedContextPenalty === 0 &&
    overallConfidence === "high" &&
    hundredEligibilityIssues.length === 0;

  let finalScore: number;
  if (rawFinalScore >= 100) {
    if (is100Eligible) {
      finalScore = 100;
    } else {
      // Reflect the uncertainty by capping below 100
      finalScore = Math.min(95, Math.max(0, Math.round(rawFinalScore)));
    }
  } else {
    finalScore = Math.round(Math.max(0, Math.min(100, rawFinalScore)));
  }

  // 6. Claim Summary Counts
  const claimSummary: ClaimSummary = {
    total: claims.length,
    supporting: evaluations.filter((e) => e.verdict === "supporting").length,
    contradicting: evaluations.filter((e) => e.verdict === "contradicting").length,
    qualifying: evaluations.filter((e) => e.verdict === "qualifying").length,
    insufficient: evaluations.filter((e) => e.verdict === "insufficient").length,
  };

  const scoreBreakdown: ScoreBreakdown = {
    claimScore: roundedClaimScore,
    contextPenalty: roundedContextPenalty,
    confidenceAdjustment,
    finalScore,
  };

  // 7. Transparent Score Explanation
  const claimSupportExplanation =
    claims.length > 0
      ? `${claimSummary.supporting} of ${claims.length} claims (${Math.round((claimSummary.supporting / claims.length) * 100)}%) are supported by verified reporting.`
      : "No claims available for evaluation.";

  const crossSourceAgreementExplanation =
    comparison && comparison.totalPublicationsExamined > 0
      ? `${comparison.claimsAgreedCount} of ${claims.length} claims show cross-source agreement across ${comparison.totalPublicationsExamined} examined publications (${comparison.independentSourcesCount} independent).`
      : "Coverage examined against primary and wire sources.";

  const contradictingEvidenceExplanation =
    claimSummary.contradicting > 0
      ? `${claimSummary.contradicting} claim(s) conflict with reliable public records or official statements.`
      : comparison?.hasNumericalConflict
      ? "Minor numerical discrepancies detected across publications, but no core factual refutation."
      : "No contradicting evidence was identified across examined publications.";

  const sourceIndependenceExplanation =
    comparison && comparison.totalPublicationsExamined > 0
      ? `${comparison.independentSourcesCount} independent source(s) and ${comparison.syndicatedSourcesCount} syndicated wire dispatch(es) analyzed.${comparison.wireAgenciesDetected.length > 0 ? ` Wire sources: ${comparison.wireAgenciesDetected.join(", ")}.` : ""}`
      : "Sources evaluated for independence and primary documentation.";

  const missingContextExplanation =
    roundedContextPenalty > 0
      ? `${omissions.length} material contextual omission(s) penalized -${roundedContextPenalty} points.`
      : "No material context omissions or misleading framing were identified.";

  const unresolvedInformationExplanation =
    claimSummary.insufficient > 0
      ? `${claimSummary.insufficient} claim(s) remain unable to verify due to limited independent coverage.`
      : "All material factual assertions were successfully resolved against public records.";

  let hundredScoreJustification: string | undefined;
  if (finalScore === 100) {
    hundredScoreJustification =
      "A perfect 100/100 score is justified: Every material claim is corroborated with high confidence by multiple independent publications or official primary archives with zero omissions or conflicting details.";
  } else if (roundedClaimScore === 100 && hundredEligibilityIssues.length > 0) {
    hundredScoreJustification = `A score of 100 was not granted due to evidence limits: ${hundredEligibilityIssues.join(" ")}`;
  }

  const scoreExplanation: TransparentScoreExplanation = {
    claimSupportExplanation,
    crossSourceAgreementExplanation,
    contradictingEvidenceExplanation,
    sourceIndependenceExplanation,
    missingContextExplanation,
    unresolvedInformationExplanation,
    hundredScoreJustification,
  };

  return {
    scoreBreakdown,
    confidence: overallConfidence,
    claimSummary,
    scoreExplanation,
    crossSourceComparison: comparison,
  };
}

