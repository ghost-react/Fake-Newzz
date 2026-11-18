import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import { VeracityVerdict, StoryStatus } from "@/schemas/verification";
import { ComparisonReport } from "@/schemas/comparison";

/**
 * Maps a numeric score (0-100) to its baseline veracity verdict:
 * 90-100 -> verified_true
 * 75-89  -> mostly_true
 * 55-74  -> mixed
 * 40-54  -> misleading
 * 25-39  -> mostly_false
 * 0-24   -> false
 */
export function getBaselineVerdict(score: number): VeracityVerdict {
  if (score >= 90) return "verified_true";
  if (score >= 75) return "mostly_true";
  if (score >= 55) return "mixed";
  if (score >= 40) return "misleading";
  if (score >= 25) return "mostly_false";
  return "false";
}

/**
 * Derives storyStatus ("confirmed" | "developing" | "unconfirmed_reports")
 * strictly from claims certainty and evidence, never chosen by the LLM alone.
 */
export function determineStoryStatus(
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  evidence?: Evidence[],
  comparison?: ComparisonReport
): StoryStatus {
  if (claims.length === 0) {
    return "unconfirmed_reports";
  }

  const highAndMedClaims = claims.filter(
    (c) => c.importance === "high" || c.importance === "medium"
  );
  const primaryClaims = highAndMedClaims.length > 0 ? highAndMedClaims : claims;

  const allSpecOrReported = primaryClaims.every(
    (c) => c.certainty === "speculation" || c.certainty === "reported_claim"
  );
  const anySpecOrReported = primaryClaims.some(
    (c) => c.certainty === "speculation" || c.certainty === "reported_claim"
  );

  // Check if comparison contains unconfirmed variations or denials
  const hasUnconfirmedVariation = comparison?.claims.some((c) =>
    c.dimensions.some((d) => d.outcome === "unconfirmed_variation" || d.outcome === "denial")
  );

  const hasDevelopingSignals = primaryClaims.some((c) => {
    const text = c.text.toLowerCase();
    return (
      text.includes("investigat") ||
      text.includes("developing") ||
      text.includes("search continues") ||
      text.includes("probe") ||
      text.includes("talks")
    );
  });

  if (allSpecOrReported || hasUnconfirmedVariation) {
    return "unconfirmed_reports";
  }

  if (hasDevelopingSignals || anySpecOrReported) {
    return "developing";
  }

  const evalMap = new Map(evaluations.map((e) => [e.claimId, e]));
  const primarySupported = primaryClaims.every(
    (c) => evalMap.get(c.id)?.verdict === "supporting"
  );

  if (primarySupported) {
    return "confirmed";
  }

  return "developing";
}

/**
 * Deterministically determines the final article-wide verdict.
 *
 * Implements Important-Claim Overrides and Core Principles:
 * 1. Score alone must NOT determine the verdict.
 * 2. Insufficient evidence != false (unverified handling).
 * 3. Minor claims cannot hide a major contradiction (prevent contradiction hiding).
 * 4. High-importance central claim contradicted with high confidence overrides positive scores.
 * 5. Minor contradictions do not automatically make an article false.
 * 6. Material omissions and qualifications create 'misleading' without false inflation.
 */
export function determineVerdictWithRule(
  finalScore: number,
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: { coreEventGatePassed?: boolean; independentSameEventClustersCount?: number }
): { verdict: VeracityVerdict; rule: string } {
  const result = determineVerdictInternal(finalScore, claims, evaluations, omissions, options);

  // Positive verdict gating (Step 4):
  // A positive verdict ("verified_true", "mostly_true") requires at least ONE independent, non-social, same_event cluster.
  // If zero independent same-event clusters exist, the verdict is unverified ("Unable to Verify").
  if (options?.independentSameEventClustersCount !== undefined && options.independentSameEventClustersCount === 0) {
    const anyContradicting = evaluations.filter((e) => e.verdict === "contradicting");
    if (
      anyContradicting.length === 0 ||
      result.verdict === "verified_true" ||
      result.verdict === "mostly_true" ||
      result.verdict === "mixed"
    ) {
      return { verdict: "unverified", rule: "GATE_NO_INDEPENDENT_SAME_EVENT_CLUSTERS" };
    }
  }

  return result;
}

function determineVerdictInternal(
  finalScore: number,
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: { coreEventGatePassed?: boolean; independentSameEventClustersCount?: number }
): { verdict: VeracityVerdict; rule: string } {
  // Edge Case 1: No claims
  if (claims.length === 0 || evaluations.length === 0) {
    return { verdict: "unverified", rule: "NO_CLAIMS_OR_EVALUATIONS" };
  }

  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  // Check total evidence availability
  const totalCitations = evaluations.reduce(
    (sum, e) => sum + (e.evidenceIds ? e.evidenceIds.length : 0),
    0
  );
  if (totalCitations === 0 && !options?.coreEventGatePassed) {
    return { verdict: "unverified", rule: "ZERO_EVIDENCE_CITATIONS" };
  }

  // Group claims by importance
  const highClaims = claims.filter((c) => c.importance === "high");
  const mediumClaims = claims.filter((c) => c.importance === "medium");
  const lowClaims = claims.filter((c) => c.importance === "low");

  // If no high claims exist, treat medium claims as the primary claims
  const primaryClaims = highClaims.length > 0 ? highClaims : mediumClaims.length > 0 ? mediumClaims : claims;

  const primaryEvaluations = primaryClaims
    .map((c) => evalMap.get(c.id))
    .filter((e): e is ClaimEvaluation => Boolean(e));

  // Edge Case 2: All claims insufficient, or primary claims insufficient with no corroborating evidence anywhere
  const allInsufficient = evaluations.every((e) => e.verdict === "insufficient");
  const anySupporting = evaluations.some((e) => e.verdict === "supporting");
  const anyContradictingAcrossAll = evaluations.some((e) => e.verdict === "contradicting");
  const allPrimaryInsufficient =
    primaryEvaluations.length > 0 &&
    primaryEvaluations.every((e) => e.verdict === "insufficient");

  // An article is only "unverified" if ALL claims lack evidence, or if primary claims are insufficient
  // and no other claim has supporting or contradicting evidence.
  if (allInsufficient && !options?.coreEventGatePassed) {
    return { verdict: "unverified", rule: "ALL_CLAIMS_INSUFFICIENT" };
  }

  if (allPrimaryInsufficient && !anySupporting && !anyContradictingAcrossAll && !options?.coreEventGatePassed) {
    return { verdict: "unverified", rule: "PRIMARY_CLAIMS_INSUFFICIENT_AND_NO_CORROBORATION" };
  }

  // Count primary verdicts
  const primaryContradicting = primaryEvaluations.filter((e) => e.verdict === "contradicting");
  const primaryHighConfContradicting = primaryContradicting.filter((e) => e.confidence === "high");
  const primarySupporting = primaryEvaluations.filter((e) => e.verdict === "supporting");
  const primaryQualifying = primaryEvaluations.filter((e) => e.verdict === "qualifying");

  // All contradicting claims across the whole article
  const anyContradicting = evaluations.filter((e) => e.verdict === "contradicting");
  const anyHighConfContradicting = anyContradicting.filter((e) => e.confidence === "high");

  // Omission indicators
  const highSeverityOmissions = omissions.filter((o) => o.severity === "high");
  const highSeverityHighConfOmissions = highSeverityOmissions.filter((o) => o.confidence === "high");

  // Baseline verdict from numeric score
  let verdict = getBaselineVerdict(finalScore);
  let rule = `BASELINE_SCORE_${finalScore}`;

  // ── OVERRIDE RULE 1: FALSE ────────────────────────────────────────────────
  if (
    primaryHighConfContradicting.length > 0 ||
    primaryContradicting.some((e) => e.evidenceIds.length >= 2)
  ) {
    if (
      primaryContradicting.length === primaryClaims.length ||
      (primaryClaims.length === 1 && (primaryHighConfContradicting.length >= 1 || primaryContradicting.some((e) => e.evidenceIds.length >= 2))) ||
      (primaryContradicting.length > primarySupporting.length && primarySupporting.length === 0)
    ) {
      return { verdict: "false", rule: "OVERRIDE_RULE_1_CENTRAL_CLAIM_CONTRADICTED" };
    }

    if (primaryContradicting.length >= primarySupporting.length) {
      return { verdict: "mostly_false", rule: "OVERRIDE_RULE_1_PREDOMINANTLY_CONTRADICTED" };
    }

    if (verdict === "verified_true" || verdict === "mostly_true") {
      if (primaryHighConfContradicting.length >= 1 && primarySupporting.length <= 1) {
        return { verdict: "mostly_false", rule: "OVERRIDE_RULE_1_MAJOR_HIGH_CONF_CONTRADICTION" };
      }
      return { verdict: "mixed", rule: "OVERRIDE_RULE_1_HIGH_CONF_CONTRADICTION_CAP_MIXED" };
    }
  }

  // ── OVERRIDE RULE 2: PREVENT CONTRADICTION HIDING ──────────────────────────
  if (verdict === "verified_true" || verdict === "mostly_true") {
    if (primaryContradicting.length > 0) {
      const v = primaryContradicting.some((e) => e.confidence === "high") ? "mostly_false" : "mixed";
      return { verdict: v, rule: "OVERRIDE_RULE_2_PRIMARY_CONTRADICTION_PREVENTS_POSITIVE" };
    }

    if (anyHighConfContradicting.length > 0) {
      if (verdict === "verified_true") {
        verdict = "mostly_true";
        rule = "OVERRIDE_RULE_2_ANY_HIGH_CONF_CONTRADICTION_CAP_MOSTLY_TRUE";
      }
      const mediumContradicted = mediumClaims.some(
        (c) => evalMap.get(c.id)?.verdict === "contradicting" && evalMap.get(c.id)?.confidence === "high"
      );
      if (mediumContradicted) {
        return { verdict: "mixed", rule: "OVERRIDE_RULE_2_MEDIUM_CLAIM_CONTRADICTED_CAP_MIXED" };
      }
    }

    if (highSeverityOmissions.length > 0 || primaryQualifying.length > 0) {
      if (highSeverityHighConfOmissions.length > 0) {
        return { verdict: "misleading", rule: "OVERRIDE_RULE_2_HIGH_CONF_OMISSION_MISLEADING" };
      }
      if (highSeverityOmissions.length > 0) {
        return { verdict: "misleading", rule: "OVERRIDE_RULE_2_HIGH_SEVERITY_OMISSION_MISLEADING" };
      }
      verdict = "mostly_true";
      rule = "OVERRIDE_RULE_2_QUALIFYING_CLAIM_CAP_MOSTLY_TRUE";
    }
  }

  // ── OVERRIDE RULE: HEDGED SPECULATION & DEVELOPING REPORTS ────────────────
  const primarySpecOrReported = primaryClaims.filter(
    (c) => c.certainty === "speculation" || c.certainty === "reported_claim"
  );
  const isPredominantlyHedged =
    primarySpecOrReported.length > 0 &&
    primarySpecOrReported.length >= Math.ceil(primaryClaims.length / 2);
  const allPrimaryHedgedSupported =
    isPredominantlyHedged &&
    primarySpecOrReported.every((c) => evalMap.get(c.id)?.verdict === "supporting");

  // Check for framing mismatch: an unhedged asserted_fact claim when evidence only shows speculation
  const hasFramingMismatch = claims.some((c) => {
    if (c.certainty === "asserted_fact" && (c.importance === "high" || c.importance === "medium")) {
      const ev = evalMap.get(c.id);
      const notes = (ev?.importantNotes || []).join(" ").toLowerCase();
      const expl = (ev?.explanation || "").toLowerCase();
      return (
        notes.includes("framing mismatch") ||
        notes.includes("only talks") ||
        expl.includes("only talks") ||
        omissions.some(
          (o) =>
            o.type === "misleading_framing" &&
            (o.claimId === c.id || o.claimId === null)
        )
      );
    }
    return false;
  });

  if (
    isPredominantlyHedged &&
    allPrimaryHedgedSupported &&
    !hasFramingMismatch &&
    anyContradicting.length === 0
  ) {
    return {
      verdict: "mostly_true",
      rule: "OVERRIDE_HEDGED_SPECULATION_MOSTLY_TRUSTWORTHY",
    };
  }

  // ── OVERRIDE RULE 3: MISLEADING ───────────────────────────────────────────
  if (primarySupporting.length > 0 || primaryQualifying.length > 0) {
    const hasDistortingOmission = highSeverityOmissions.some(
      (o) =>
        o.type === "missing_qualification" ||
        o.type === "misleading_framing" ||
        o.type === "missing_context"
    );

    const hasMajorQualifyingClaim = primaryQualifying.length > 0;

    const hasAttributionConfirmed = primaryClaims.some(
      (c) => c.claimType === "statement_attribution" && evalMap.get(c.id)?.verdict === "supporting"
    );

    // If an attributed statement was genuinely spoken, do not force a misleading override
    // merely because of paradoxical phrasing or rhetorical interpretation in the quotation.
    if (!hasAttributionConfirmed && (hasDistortingOmission || hasMajorQualifyingClaim) && (verdict === "verified_true" || verdict === "mostly_true")) {
      return { verdict: "misleading", rule: "OVERRIDE_RULE_3_DISTORTING_OMISSION_OR_QUALIFICATION" };
    }
  }

  // ── OVERRIDE RULE 4: MOSTLY TRUE ──────────────────────────────────────────
  if (
    primarySupporting.length === primaryClaims.length &&
    primaryClaims.length > 0 &&
    anyContradicting.length === 0 &&
    highSeverityOmissions.length === 0
  ) {
    const hasMediumOmissions = omissions.some((o) => o.severity === "medium");
    const hasQualifying = evaluations.some((e) => e.verdict === "qualifying");

    if (finalScore >= 90 && !hasMediumOmissions && !hasQualifying) {
      return { verdict: "verified_true", rule: "OVERRIDE_RULE_4_ALL_PRIMARY_SUPPORTED_VERIFIED_TRUE" };
    }
    return { verdict: "mostly_true", rule: "OVERRIDE_RULE_4_PRIMARY_SUPPORTED_MOSTLY_TRUE" };
  }

  // ── OVERRIDE RULE 5: MINOR CONTRADICTION SAFETY ───────────────────────────
  if (
    anyContradicting.length > 0 &&
    primaryContradicting.length === 0 &&
    primarySupporting.length > 0
  ) {
    if (finalScore >= 60 && verdict !== "false" && verdict !== "mostly_false") {
      return { verdict, rule: "OVERRIDE_RULE_5_MINOR_CONTRADICTION_RETAINS_SCORE_VERDICT" };
    }
  }

  // ── OVERRIDE: CORE-EVENT GATE ─────────────────────────────────────────────
  if (options?.coreEventGatePassed && primaryHighConfContradicting.length === 0 && primaryContradicting.length === 0) {
    if (verdict === "unverified" || verdict === "misleading" || verdict === "mostly_false" || verdict === "false") {
      return { verdict: "mostly_true", rule: "CORE_EVENT_GATE_OVERRIDE_MOSTLY_TRUE" };
    }
  }

  // ── POSITIVE VERDICT GATING ───────────────────────────────────────────────
  // A positive verdict ("verified_true", "mostly_true") requires at least ONE independent, non-social, same_event cluster.
  // If zero independent same-event clusters exist, the verdict is unverified ("Unable to Verify").
  if (options?.independentSameEventClustersCount !== undefined && options.independentSameEventClustersCount === 0) {
    if (anyContradicting.length === 0 || verdict === "verified_true" || verdict === "mostly_true" || verdict === "mixed") {
      return { verdict: "unverified", rule: "GATE_NO_INDEPENDENT_SAME_EVENT_CLUSTERS" };
    }
  }

  return { verdict, rule };
}

export function determineVerdict(
  finalScore: number,
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: { coreEventGatePassed?: boolean; independentSameEventClustersCount?: number }
): VeracityVerdict {
  return determineVerdictWithRule(finalScore, claims, evaluations, omissions, options).verdict;
}

