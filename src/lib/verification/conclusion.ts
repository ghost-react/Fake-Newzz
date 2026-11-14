import {
  Conclusion,
  ConclusionLabel,
  Gate100Result,
  ScoreBreakdown,
  StoryStatus,
  VeracityVerdict,
  ComparisonReport,
} from "@/schemas/verification";
import { ClaimInput } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";

export interface ConclusionClaim {
  id: string;
  text: string;
  importance: "high" | "medium" | "low";
  claimType?: string;
  layer?: "event_occurred" | "statement_made" | "quote_wording" | "underlying_fact" | "interpretation";
  certainty?: "asserted_fact" | "reported_claim" | "speculation" | "opinion_analysis";
  linkedClaimId?: string | null;
}

export interface DetermineConclusionInput {
  veracityVerdict: VeracityVerdict;
  overallTrustScore: number;
  scoreBreakdown?: ScoreBreakdown;
  gate100Result?: Gate100Result;
  verifiedTrue?: boolean;
  storyStatus?: StoryStatus;
  claims?: ConclusionClaim[];
  evaluations?: ClaimEvaluation[];
  comparison?: ComparisonReport;
  omissions?: Omission[];
  sourceReadStatus?: string;
  sourceReadNote?: string;
  independentClustersCount?: number;
}

/**
 * Deterministically maps existing report data into a standardized conclusion label,
 * explanation, and reason codes.
 *
 * Rules:
 * 1. "True" ONLY when the 100-gate passes.
 * 2. "False" ONLY when a high-importance claim is contradicted by reliable, independent evidence.
 * 3. A rumour story with credible reports gives "Unconfirmed", NOT "False".
 * 4. Never output True or False from an LLM.
 */
export function determineConclusion(input: DetermineConclusionInput): Conclusion {
  const {
    veracityVerdict,
    overallTrustScore,
    scoreBreakdown,
    gate100Result,
    verifiedTrue,
    storyStatus,
    claims = [],
    evaluations = [],
    comparison,
    omissions = [],
    sourceReadStatus,
    independentClustersCount,
  } = input;

  const reasonCodes: string[] = [];

  // Index evaluations by claimId
  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  // Determine independent clusters count
  const effectiveIndepCount =
    independentClustersCount ??
    comparison?.totalIndependentClusters ??
    0;

  // 1. Can't Verify: Source could not be read, or completely unverified with zero independent coverage
  const isUnreadable =
    veracityVerdict === "could_not_read" ||
    sourceReadStatus === "could_not_read" ||
    sourceReadStatus === "failed";

  if (isUnreadable && effectiveIndepCount === 0) {
    reasonCodes.push("COULD_NOT_READ_SOURCE");
    return {
      label: "Can't verify",
      explanation: "The original source could not be accessed and no independent reporting was found.",
      reasonCodes,
    };
  }

  if (veracityVerdict === "could_not_read") {
    reasonCodes.push("COULD_NOT_READ_SOURCE");
    return {
      label: "Can't verify",
      explanation: "Available reporting and public records are insufficient to substantiate the claims.",
      reasonCodes,
    };
  }

  if (veracityVerdict === "unverified" && effectiveIndepCount === 0) {
    reasonCodes.push("NO_INDEPENDENT_REPORTS");
    return {
      label: "Can't verify",
      explanation: "No independent reporting was found to substantiate or refute the claims.",
      reasonCodes,
    };
  }

  // Check for rumour stories
  const isRumourStory =
    storyStatus === "unconfirmed_reports" ||
    claims.some(
      (c) =>
        c.certainty === "speculation" ||
        c.certainty === "reported_claim" ||
        c.layer === "statement_made" ||
        /\b(rumour|rumor|allegation|allegedly|unconfirmed)\b/i.test(c.text)
    );

  // 2. Check for contradicted central claim -> "False"
  // Constraint: A high-importance claim contradicted by reliable independent evidence.
  // Rule 4.b: A rumour story with credible reports gives Unconfirmed, not False.
  const highImportanceContradicted = claims.some((c) => {
    if (c.importance !== "high") return false;
    const ev = evalMap.get(c.id);
    return ev?.verdict === "contradicting";
  });

  if (highImportanceContradicted && !isRumourStory) {
    reasonCodes.push("HIGH_IMPORTANCE_CLAIM_CONTRADICTED");
    return {
      label: "False",
      explanation: "Central factual claims are contradicted by reliable independent evidence.",
      reasonCodes,
    };
  }

  // If it is a rumour story with credible reports, it yields "Unconfirmed", NOT "False"
  if (isRumourStory && effectiveIndepCount > 0) {
    reasonCodes.push("RUMOUR_WITH_CREDIBLE_REPORTS");
    return {
      label: "Unconfirmed",
      explanation: "Independent reporting confirms this is an unverified rumour or developing claim.",
      reasonCodes,
    };
  }

  // 3. "True" ONLY when the 100-gate passes
  const gate100Passed =
    (gate100Result?.canReach100 === true && overallTrustScore === 100) ||
    verifiedTrue === true;

  if (gate100Passed) {
    reasonCodes.push("GATE_100_PASSED");
    return {
      label: "True",
      explanation: "All factual claims are fully corroborated across independent reporting and official records.",
      reasonCodes,
    };
  }

  // 4. "Mostly true"
  // Rule 4.a: 100-gate pass gives True; one unresolved detail gives Mostly true.
  const hasOneUnresolvedDetail =
    comparison?.totalUnresolvedDimensions === 1 ||
    (comparison?.claims.some((c) =>
      c.dimensions.some((d) => d.outcome === "detail_variation" || d.outcome === "partial_agreement")
    ) &&
      veracityVerdict === "verified_true") ||
    (gate100Result &&
      !gate100Result.canReach100 &&
      gate100Result.failedConditions.some((fc) => fc.code === "NO_DETAIL_VARIATION") &&
      veracityVerdict === "verified_true");

  const isMostlyTrueVerdict =
    veracityVerdict === "mostly_true" ||
    (veracityVerdict === "verified_true" && !gate100Passed) ||
    hasOneUnresolvedDetail;

  if (isMostlyTrueVerdict && overallTrustScore >= 70) {
    if (hasOneUnresolvedDetail) {
      reasonCodes.push("ONE_UNRESOLVED_DETAIL");
    } else {
      reasonCodes.push("MOSTLY_TRUE_EVIDENCE");
    }
    return {
      label: "Mostly true",
      explanation: "The core event is corroborated by independent reporting, with minor unresolved details.",
      reasonCodes,
    };
  }

  // 5. "Misleading"
  const hasHighOmission = omissions.some((o) => o.severity === "high");
  const hasContextPenalty = (scoreBreakdown?.contextPenalty ?? 0) >= 20;

  if (veracityVerdict === "misleading" || hasHighOmission || hasContextPenalty) {
    reasonCodes.push("MATERIAL_CONTEXT_MISSING_OR_MISLEADING");
    return {
      label: "Misleading",
      explanation: "Key assertions omit crucial context or frame events in a misleading manner.",
      reasonCodes,
    };
  }

  // 6. "Unconfirmed"
  if (
    storyStatus === "developing" ||
    storyStatus === "unconfirmed_reports" ||
    veracityVerdict === "unverified"
  ) {
    reasonCodes.push("STORY_UNCONFIRMED_OR_DEVELOPING");
    return {
      label: "Unconfirmed",
      explanation: "Available evidence is insufficient to independently corroborate the reported claims.",
      reasonCodes,
    };
  }

  // 7. "Partly true"
  if (veracityVerdict === "mixed" || veracityVerdict === "mostly_false") {
    reasonCodes.push("MIXED_OR_PARTIALLY_TRUE_EVIDENCE");
    return {
      label: "Partly true",
      explanation: "Some claims are corroborated, while other aspects are unproven or inaccurate.",
      reasonCodes,
    };
  }

  // Fallback based on score
  if (overallTrustScore >= 75) {
    reasonCodes.push("HIGH_SCORE_FALLBACK");
    return {
      label: "Mostly true",
      explanation: "The core event is corroborated by independent reporting.",
      reasonCodes,
    };
  }

  if (overallTrustScore >= 45) {
    reasonCodes.push("MODERATE_SCORE_FALLBACK");
    return {
      label: "Partly true",
      explanation: "Evidence is mixed with some claims confirmed and others unverified.",
      reasonCodes,
    };
  }

  reasonCodes.push("LOW_SCORE_UNVERIFIED_FALLBACK");
  return {
    label: "Unconfirmed",
    explanation: "Evidence is insufficient to corroborate the story.",
    reasonCodes,
  };
}
