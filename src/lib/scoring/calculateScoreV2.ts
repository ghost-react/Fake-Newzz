import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation, Verdict, Confidence } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import {
  VerificationConfidence,
  VeracityVerdict,
  ClaimSummary,
  ScoreBreakdownV2,
  ScoreFactorV2,
  ScoreV2Result,
  OverrideRecord,
} from "@/schemas/verification";
import { ComparisonReport, ClaimComparisonResult } from "@/schemas/comparison";
import { DEFAULT_SCORING_V2_CONFIG, ScoringV2Config } from "./config.v2";
import { scoreCanReach100, Gate100Result } from "./perfectScore";
import { getBaselineVerdict, determineStoryStatus } from "./determineVerdict";
import { calculateOverallConfidence } from "./calculateScore";
import { OriginCluster, clusterEvidenceIndependence } from "../comparison/independence";
import { evaluateConsensusConsistency, ConsensusConsistencyResult } from "./consistency";
import { isSocialOrAggregator } from "../comparison/socialExclusion";

export interface ScoreV2CalculationOptions {
  comparison?: ComparisonReport;
  clusters?: OriginCluster[];
  evidence?: Evidence[];
  coverageLimited?: boolean;
  config?: ScoringV2Config;
}

/**
 * Checks whether an evidence item represents full text or snippet-only content.
 */
function isSnippetOnlyEvidence(ev: Evidence): boolean {
  if (ev.sourceContentStatus === "snippet_only") return true;
  if (ev.sourceType === "official" || ev.sourceType === "primary_document") return false;
  if (ev.sourceContentStatus === "retrieved" && ev.sourceContentExcerpt && ev.sourceContentExcerpt.trim().length > 0) {
    return false;
  }
  return true;
}

/**
 * Deterministically calculates scoring v2 using cross-source comparison data.
 */
export function calculateScoreV2(
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: ScoreV2CalculationOptions
): ScoreV2Result {
  const config = options?.config || DEFAULT_SCORING_V2_CONFIG;
  const comparison = options?.comparison;
  const evidenceList = options?.evidence || [];

  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  const comparisonMap = new Map<string, ClaimComparisonResult>();
  if (comparison) {
    comparison.claims.forEach((c) => comparisonMap.set(c.claimId, c));
  }

  const evidenceMap = new Map<string, Evidence>();
  evidenceList.forEach((e) => evidenceMap.set(e.id, e));

  const factors: ScoreFactorV2[] = [];
  const materialDims = new Set(config.materialDimensions);

  // 1. Claim Weighting & Normalization (excluding interpretation layer claims)
  let totalWeightedClaimContribution = 0;
  let maxAchievable = 0;

  for (const claim of claims) {
    // Exclude interpretation layer claims and opinion_analysis certainty claims
    if (claim.layer === "interpretation" || claim.certainty === "opinion_analysis") {
      factors.push({
        code: claim.certainty === "opinion_analysis" ? "OPINION_ANALYSIS_CLAIM_EXCLUDED" : "INTERPRETATION_CLAIM_EXCLUDED",
        effect: 0,
        claimId: claim.id,
        layer: claim.layer,
        note: claim.certainty === "opinion_analysis"
          ? "Opinion/analysis claim excluded from factual score calculation"
          : "Interpretation-layer claim excluded from factual score calculation",
      });
      continue;
    }

    const importanceWeight = config.importanceWeights[claim.importance] ?? 2.0;
    const maxCorroboration = config.corroborationMultipliers.threePlus;
    const maxConfidence = config.confidenceMultipliers.high;
    maxAchievable += importanceWeight * config.verdictBaseValues.supporting * maxCorroboration * maxConfidence;

    const evaluation = evalMap.get(claim.id);
    const verdict: Verdict = evaluation?.verdict || "insufficient";
    let confidence: Confidence = evaluation?.confidence || "low";

    // Check evidence depth behind this evaluation
    const citedEvidence = (evaluation?.evidenceIds || [])
      .map((id) => evidenceMap.get(id))
      .filter((e): e is Evidence => Boolean(e));

    const isSnippetOnly =
      citedEvidence.length > 0 && citedEvidence.every(isSnippetOnlyEvidence);

    // Rule 3d: Snippet-only evidence caps contribution at medium confidence level
    let snippetCapped = false;
    if (isSnippetOnly) {
      if (confidence === "high") {
        confidence = config.snippetOnlyMaxConfidence; // "medium"
        snippetCapped = true;
      }
    }

    const verdictBase = config.verdictBaseValues[verdict] ?? 0.0;
    const confMultiplier = config.confidenceMultipliers[confidence] ?? 0.75;

    // Rule 3a: Base contribution
    let claimContribution = verdictBase * importanceWeight * confMultiplier;

    if (snippetCapped) {
      factors.push({
        code: "SNIPPET_ONLY_CONFIDENCE_CAP",
        effect: 0,
        claimId: claim.id,
        note: "Evaluator confidence capped at medium due to snippet-only evidence depth",
      });
    }

    // Rule 3b: Corroboration multiplier from independentClusterCount
    const claimComp = comparisonMap.get(claim.id);
    let clusterCount = claimComp ? claimComp.independentClusterCount : (citedEvidence.length > 0 ? 1 : 0);

    let corroborationMultiplier = config.corroborationMultipliers.one;
    if (clusterCount === 0) {
      corroborationMultiplier = config.corroborationMultipliers.zero;
    } else if (clusterCount === 1) {
      corroborationMultiplier = config.corroborationMultipliers.one;
    } else if (clusterCount === 2) {
      corroborationMultiplier = config.corroborationMultipliers.two;
    } else {
      corroborationMultiplier = config.corroborationMultipliers.threePlus;
    }

    // Official/primary source weighting
    const isCoreClaim =
      claim.layer === "event_occurred" ||
      claim.layer === "statement_made" ||
      claim.claimType === "event" ||
      claim.claimType === "statement_attribution" ||
      claim.claimType === "legal_policy";

    const hasOfficialEvidence = citedEvidence.some(
      (ev) =>
        ev.sourceType === "official" ||
        ev.sourceType === "primary_document" ||
        (ev.domain || "").toLowerCase().includes(".gov") ||
        (ev.domain || "").toLowerCase().includes(".nic.in") ||
        (ev.domain || "").toLowerCase().includes(".europa.eu")
    );

    if (claimContribution > 0) {
      const rawContribution = claimContribution;
      let effectiveMultiplier = corroborationMultiplier;
      if (isCoreClaim && hasOfficialEvidence && config.officialPrimarySourceClusterMultiplier) {
        effectiveMultiplier *= config.officialPrimarySourceClusterMultiplier;
        factors.push({
          code: "OFFICIAL_SOURCE_BOOST",
          effect: 0,
          claimId: claim.id,
          officialSourcePresent: true,
          note: `Official/primary source cluster boosted corroboration weight (${config.officialPrimarySourceClusterMultiplier}x)`,
        });
      }
      claimContribution *= effectiveMultiplier;
      factors.push({
        code: "CORROBORATION_MULTIPLIER",
        effect: Math.round((claimContribution - rawContribution) * 10) / 10,
        claimId: claim.id,
        clusterCount,
        note: `Applied ${effectiveMultiplier}x corroboration multiplier for ${clusterCount} cluster(s)`,
      });
    }

    // Rule 3c: Conflict adjustment on material dimensions
    let hadMaterialConflict = false;
    let hasUnconfirmedRumourVariation = false;
    if (claimComp && claimComp.conflicts.length > 0) {
      for (const conflict of claimComp.conflicts) {
        if (
          conflict.conflictType === "detail_variation" ||
          claimComp.dimensions.some(
            (d) => d.dimension === conflict.dimension && d.outcome === "detail_variation"
          )
        ) {
          if (confidence === "high") {
            confidence = "medium";
          }
          factors.push({
            code: "DETAIL_VARIATION",
            effect: 0,
            claimId: claim.id,
            dimension: conflict.dimension,
            note: `Detail variation on '${conflict.dimension}': ${conflict.description}; lowers confidence to medium, not a contradiction`,
          });
          continue;
        }

        if (
          conflict.conflictType === "unconfirmed_variation" ||
          claimComp.dimensions.some(
            (d) => d.dimension === conflict.dimension && d.outcome === "unconfirmed_variation"
          )
        ) {
          hasUnconfirmedRumourVariation = true;
          factors.push({
            code: "UNCONFIRMED_VARIATION",
            effect: 0,
            claimId: claim.id,
            dimension: conflict.dimension,
            note: `Expected rumour variation on '${conflict.dimension}' across developing reports; lowers confidence only, not counted as contradiction`,
          });
          continue;
        }

        if (
          conflict.conflictType === "denial" ||
          claimComp.dimensions.some(
            (d) => d.dimension === conflict.dimension && d.outcome === "denial"
          )
        ) {
          factors.push({
            code: "DENIAL_CONTEXT",
            effect: 0,
            claimId: claim.id,
            dimension: conflict.dimension,
            note: `Denial by interested party recorded on '${conflict.dimension}' as additional context, not a contradiction`,
          });
          continue;
        }

        if (materialDims.has(conflict.dimension)) {
          hadMaterialConflict = true;
          factors.push({
            code: "MATERIAL_CONFLICT",
            effect: 0,
            claimId: claim.id,
            dimension: conflict.dimension,
            note: `Conflict detected on material dimension: ${conflict.dimension}`,
          });
        }
      }
    }

    if (hadMaterialConflict && claimContribution > 0) {
      const beforeConflict = claimContribution;
      claimContribution = Math.max(0, claimContribution * config.materialConflictReductionFactor);
      factors.push({
        code: "MATERIAL_CONFLICT_ADJUSTMENT",
        effect: Math.round((claimContribution - beforeConflict) * 10) / 10,
        claimId: claim.id,
        note: `Reduced positive contribution due to conflicting reports on material dimension`,
      });
    }

    totalWeightedClaimContribution += claimContribution;

    factors.push({
      code: "CLAIM_CONTRIBUTION",
      effect: Math.round(claimContribution * 10) / 10,
      claimId: claim.id,
      layer: claim.layer,
      clusterCount,
      note: `Verdict: ${verdict}, confidence: ${confidence}, importance: ${claim.importance}`,
    });
  }

  // 2. Article-level Normalization
  let normalizedClaimScore = config.neutralBaseline;
  if (claims.length > 0 && maxAchievable > 0) {
    const ratio = totalWeightedClaimContribution / maxAchievable;
    normalizedClaimScore = config.neutralBaseline + (100 - config.neutralBaseline) * ratio;
  }
  normalizedClaimScore = Math.max(0, Math.min(100, normalizedClaimScore));

  // 3. Unresolved Material Details Rule (Rule 4)
  let rawUnresolvedPenalty = 0;
  if (comparison) {
    for (const claimComp of comparison.claims) {
      const claim = claims.find((c) => c.id === claimComp.claimId);
      const importance = claim?.importance || "medium";
      const penaltyAmount = config.unresolvedDetailPenalties[importance] ?? 3;

      for (const dim of claimComp.dimensions) {
        if (materialDims.has(dim.dimension)) {
          if (dim.outcome === "unresolved" || dim.outcome === "unsupported_detail") {
            rawUnresolvedPenalty += penaltyAmount;
            factors.push({
              code: dim.outcome === "unresolved" ? "UNRESOLVED_DETAIL" : "UNSUPPORTED_DETAIL",
              effect: -penaltyAmount,
              claimId: claimComp.claimId,
              dimension: dim.dimension,
              note: `${dim.outcome} on material dimension '${dim.dimension}' (-${penaltyAmount} pts)`,
            });
          }
        }
      }
    }
  }
  const clampedUnresolvedPenalty = Math.min(config.maxUnresolvedDetailPenalty, rawUnresolvedPenalty);

  // 4. Evidence-backed Omissions Penalty (Rule 4)
  let rawOmissionPenalty = 0;
  for (const o of omissions) {
    // Only evidence-backed omissions count
    const hasEvidence =
      Boolean((o as any).evidenceId && (o as any).evidenceId.trim().length > 0) ||
      (Array.isArray(o.evidenceIds) && o.evidenceIds.length > 0);

    if (!hasEvidence) {
      continue;
    }

    const basePen = config.omissionBasePenalties[o.severity] ?? 8;
    const confMult = config.omissionConfidenceMultipliers[o.confidence] ?? 0.75;
    const pen = basePen * confMult;
    rawOmissionPenalty += pen;

    factors.push({
      code: "OMISSION_PENALTY",
      effect: -Math.round(pen * 10) / 10,
      note: `Omission (${o.severity} severity, ${o.confidence} conf): -${Math.round(pen)} pts`,
    });
  }
  const clampedOmissionPenalty = Math.min(config.maxOmissionPenalty, rawOmissionPenalty);

  // 5. Overall Confidence & Adjustment
  const baseConfidence = calculateOverallConfidence(claims, evaluations, omissions);
  const coverageLimited =
    options?.coverageLimited ?? (comparison ? comparison.coverageLimited : false);

  let reportedConfidence = baseConfidence;
  if (coverageLimited) {
    // coverageLimited does NOT reduce score; lowers reported confidence and adds note
    if (reportedConfidence === "high") {
      reportedConfidence = "medium";
    }
    factors.push({
      code: "COVERAGE_LIMITED",
      effect: 0,
      note: "Coverage is limited across independent outlets; reported confidence capped at medium",
    });
  }

  // Developing rumour variation lowers reported confidence only
  const hasDevelopingRumourVariation = comparison?.claims.some((c) =>
    c.dimensions.some((d) => d.outcome === "unconfirmed_variation") ||
    c.conflicts.some((cf) => cf.conflictType === "unconfirmed_variation")
  );
  if (hasDevelopingRumourVariation && reportedConfidence === "high") {
    reportedConfidence = "medium";
  }

  const confidenceAdjustment = config.confidenceAdjustments[baseConfidence] ?? -3;
  if (confidenceAdjustment !== 0) {
    factors.push({
      code: "CONFIDENCE_ADJUSTMENT",
      effect: confidenceAdjustment,
      note: `Article confidence '${baseConfidence}': ${confidenceAdjustment} pts`,
    });
  }

  // Raw score accumulation
  let rawScore =
    normalizedClaimScore -
    clampedUnresolvedPenalty -
    clampedOmissionPenalty +
    confidenceAdjustment;

  // Invariant 4: Insufficient never reduces score below neutral baseline (50)
  const hasContradicting = evaluations.some((e) => e.verdict === "contradicting");
  if (!hasContradicting && clampedOmissionPenalty === 0 && rawScore < config.neutralBaseline) {
    const allInsufficientOrNeutral = evaluations.every(
      (e) => e.verdict === "insufficient" || (e.verdict as string) === "neutral"
    );
    if (allInsufficientOrNeutral) {
      rawScore = config.neutralBaseline;
    }
  }

  // 5.5 Consensus Consistency Evaluation
  const clusters =
    options?.clusters ||
    (evidenceList.length > 0 ? clusterEvidenceIndependence(evidenceList) : []);

  const consistencyResult = evaluateConsensusConsistency({
    claims,
    comparison,
    clusters,
    evidence: evidenceList,
    config,
  });

  // Incorporate consistency factors
  consistencyResult.factors.forEach((f) => factors.push(f));

  // Non-social independent clusters
  const nonSocialClusters = clusters.filter(
    (c) => c.originType !== "social_reference" && !isSocialOrAggregator(c.primaryDomain)
  );

  const independentSameEventClusters = nonSocialClusters.filter((c) => {
    return c.memberEvidenceIds.some((id) => {
      const item = evidenceMap.get(id);
      return item && item.eventMatch !== "different_event" && item.eventMatch !== "related_background";
    });
  });

  const totalIndependentClustersCount =
    comparison?.totalIndependentClusters ??
    (options?.clusters
      ? nonSocialClusters.length
      : options?.evidence
      ? nonSocialClusters.length
      : undefined);

  // Confidence gating (Step 4):
  // - "High" confidence requires at least 2 independent same-event clusters with full text.
  // - 0 independent clusters: confidence is "Low".
  // - 1 independent cluster: confidence is "Medium".
  const fullTextSameEventClustersCount = nonSocialClusters.filter((c) => {
    return c.memberEvidenceIds.some((id) => {
      const item = evidenceMap.get(id);
      return (
        item &&
        !isSnippetOnlyEvidence(item) &&
        item.eventMatch !== "different_event" &&
        item.eventMatch !== "related_background"
      );
    });
  }).length;

  if (totalIndependentClustersCount === 0) {
    reportedConfidence = "low";
  } else if (totalIndependentClustersCount === 1) {
    if (reportedConfidence === "high") {
      reportedConfidence = "medium";
    }
  } else if (
    totalIndependentClustersCount !== undefined &&
    fullTextSameEventClustersCount < 2 &&
    options?.evidence &&
    options.evidence.length > 0
  ) {
    if (reportedConfidence === "high") {
      reportedConfidence = "medium";
    }
  }

  // If consistency is not assessable (fewer than 2 independent clusters), reduce reported confidence
  if (!consistencyResult.assessable) {
    if (reportedConfidence === "high") {
      reportedConfidence = "medium";
    }
  }

  const rawV2Score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const consistencyMultiplier = consistencyResult.assessable ? consistencyResult.multiplier : 1.0;
  let scoreAfterConsistency = Math.min(rawV2Score, Math.round(rawV2Score * consistencyMultiplier));

  if (scoreAfterConsistency < rawV2Score) {
    const reduction = scoreAfterConsistency - rawV2Score;
    factors.push({
      code: "CONSISTENCY_MULTIPLIER",
      effect: reduction,
      note: `Consistency adjustment (${consistencyResult.tier} consistency, ${consistencyResult.consistencyScore}/100): ${consistencyMultiplier}x multiplier applied`,
    });
  }

  // 6. 100/100 Gate Evaluation & "True" outcome
  const gate100Result = scoreCanReach100({
    claims,
    evaluations,
    comparison,
    omissions,
    evidence: evidenceList,
    config,
  });

  let finalScore = scoreAfterConsistency;
  let verifiedTrue = false;

  if (finalScore >= 100) {
    const hasVariationOnMaterial = consistencyResult.totalDistinctVersions > 0;
    const has2AssessableClusters = consistencyResult.assessable;
    const has100Consistency = consistencyResult.consistencyScore === 100;

    if (gate100Result.canReach100 && has2AssessableClusters && has100Consistency && !hasVariationOnMaterial) {
      finalScore = 100;
      verifiedTrue = true;
      factors.push({
        code: "GATE_100_PASSED",
        effect: 0,
        note: "All 100/100 gate verification conditions satisfied with 100% consensus consistency",
      });
      factors.push({
        code: "VERIFIED_TRUE",
        effect: 0,
        note: "Passed 100/100 gate and achieved 100% consensus consistency across independent sources",
      });
    } else {
      const cap = Math.min(config.maxScoreWithVariation, gate100Result.allowedMaxScore);
      const reduction = finalScore - cap;
      finalScore = cap;

      if (!gate100Result.canReach100) {
        for (const fc of gate100Result.failedConditions) {
          factors.push({
            code: `GATE_100_FAILURE_${fc.code}`,
            effect: -reduction,
            note: `Gate condition failed: ${fc.condition} (${fc.details})`,
          });
        }
      } else if (hasVariationOnMaterial) {
        factors.push({
          code: "CONSISTENCY_VERSION_VARIATION_GATE",
          effect: -reduction,
          note: `Perfect score not allowed: variation detected across independent reporting versions (max ${cap})`,
        });
      } else {
        factors.push({
          code: "CONSISTENCY_PERFECT_SCORE_GATE",
          effect: -reduction,
          note: `Perfect score not allowed: consistency is ${consistencyResult.consistencyScore}/100 (max ${cap})`,
        });
      }
    }
  } else {
    if (!gate100Result.canReach100 && finalScore > gate100Result.allowedMaxScore) {
      finalScore = gate100Result.allowedMaxScore;
    }
  }

  // 7. Determine Baseline Verdict & Low Consistency Cap
  let veracityVerdict = getBaselineVerdict(finalScore);

  // Rule 4: Low consistency caps the verdict at "Mixed Evidence" unless a contradicting verdict independently justifies something lower.
  // Many versions with weak evidence does not mean false: it must never produce "False" or "Mostly False" by itself.
  if (
    consistencyResult.assessable &&
    consistencyResult.consistencyScore !== null &&
    consistencyResult.consistencyScore < config.consistencyLowVerdictCapThreshold
  ) {
    if (veracityVerdict === "verified_true" || veracityVerdict === "mostly_true") {
      veracityVerdict = "mixed";
      consistencyResult.lowConsistencyVerdictCapApplied = true;
      factors.push({
        code: "CONSISTENCY_VERDICT_CAP",
        effect: 0,
        note: `Verdict capped at Mixed Evidence due to low consensus consistency (${consistencyResult.consistencyScore}/100)`,
      });
    }
  }
  let overrideApplied: OverrideRecord | undefined;

  // Evaluate v2 overrides with machine-readable tracking
  const highClaims = claims.filter((c) => c.importance === "high");
  const primaryClaims = highClaims.length > 0 ? highClaims : claims;
  const primaryEvaluations = primaryClaims
    .map((c) => evalMap.get(c.id))
    .filter((e): e is ClaimEvaluation => Boolean(e));

  const primaryContradicting = primaryEvaluations.filter((e) => e.verdict === "contradicting");
  const primaryHighConfContradicting = primaryContradicting.filter((e) => e.confidence === "high");
  const primarySupporting = primaryEvaluations.filter((e) => e.verdict === "supporting");
  const anyContradicting = evaluations.filter((e) => e.verdict === "contradicting");
  const anyHighConfContradicting = anyContradicting.filter((e) => e.confidence === "high");

  // Core-Event Gate (Prompt 10):
  // If the main event_occurred or statement_made claim is supported by 2+ independent origin clusters,
  // OR by one official/primary-source cluster plus one independent cluster, the overall verdict cannot be "Unable to Verify".
  // It must be at least "Mostly Trustworthy" (mostly_true) unless contradicting evidence exists.
  const coreClaims = claims.filter(
    (c) =>
      c.layer === "event_occurred" ||
      c.layer === "statement_made" ||
      c.claimType === "event" ||
      c.claimType === "statement_attribution"
  );
  const primaryCoreClaims = coreClaims.filter((c) => c.importance === "high");
  const candidatesForGate = primaryCoreClaims.length > 0 ? primaryCoreClaims : coreClaims;

  let coreEventGatePassed = false;
  let coreEventGateClusterCount = 0;
  let coreEventGateOfficialPresent = false;
  let coreEventGateClaimId: string | undefined;

  for (const c of candidatesForGate) {
    const ev = evalMap.get(c.id);
    if (ev?.verdict !== "supporting") continue;

    const comp = comparisonMap.get(c.id);
    const citedEvidence = (ev.evidenceIds || [])
      .map((id) => evidenceMap.get(id))
      .filter((e): e is Evidence => Boolean(e));

    const clusterCount = comp
      ? comp.independentClusterCount
      : (clusters.length > 0 ? clusters.length : citedEvidence.length > 0 ? 1 : 0);

    const hasOfficialCluster = clusters.some((cluster) =>
      cluster.memberEvidenceIds.some((id) => {
        const item = evidenceMap.get(id);
        if (!item) return false;
        if (item.sourceType === "official" || item.sourceType === "primary_document") return true;
        const dom = (item.domain || "").toLowerCase();
        return dom.includes(".gov") || dom.includes(".nic.in") || dom.includes(".europa.eu");
      })
    );

    const hasDirectOfficial = citedEvidence.some(
      (item) =>
        item.sourceType === "official" ||
        item.sourceType === "primary_document" ||
        (item.domain || "").toLowerCase().includes(".gov") ||
        (item.domain || "").toLowerCase().includes(".nic.in") ||
        (item.domain || "").toLowerCase().includes(".europa.eu")
    );

    const officialPresent = hasOfficialCluster || hasDirectOfficial;

    if (clusterCount >= 2 || (officialPresent && (clusterCount >= 2 || clusters.length >= 2))) {
      coreEventGatePassed = true;
      coreEventGateClusterCount = clusterCount;
      coreEventGateOfficialPresent = officialPresent;
      coreEventGateClaimId = c.id;
      break;
    }
  }

  if (coreEventGatePassed) {
    factors.push({
      code: "CORE_EVENT_GATE_PASSED",
      effect: 0,
      claimId: coreEventGateClaimId,
      clusterCount: coreEventGateClusterCount,
      officialSourcePresent: coreEventGateOfficialPresent,
      note: `Core event supported by ${coreEventGateClusterCount} cluster(s) (official: ${coreEventGateOfficialPresent}); verdict cannot be unverified`,
    });
  }

  const anyHighSupportingOrQualifying = highClaims.some((c) => {
    const ev = evalMap.get(c.id);
    return ev?.verdict === "supporting" || ev?.verdict === "qualifying";
  });

  const allClaimsInsufficient = evaluations.every((e) => e.verdict === "insufficient");

  const anyContradictingAcrossAll = evaluations.some((e) => e.verdict === "contradicting");

  if (allClaimsInsufficient && !coreEventGatePassed) {
    veracityVerdict = "unverified";
    overrideApplied = {
      name: "OVERRIDE_ALL_CLAIMS_INSUFFICIENT",
      triggerValues: { totalEvaluations: evaluations.length, insufficientCount: evaluations.length },
      claimsInvolved: evaluations.map((e) => e.claimId),
    };
  } else if (!anyHighSupportingOrQualifying && !anyContradictingAcrossAll && !coreEventGatePassed && highClaims.length > 0) {
    veracityVerdict = "unverified";
    overrideApplied = {
      name: "OVERRIDE_ALL_MAJOR_CLAIMS_INSUFFICIENT",
      triggerValues: { highClaimsCount: highClaims.length, supportingCount: 0 },
      claimsInvolved: highClaims.map((c) => c.id),
    };
  } else if (primaryHighConfContradicting.length > 0) {
    if (
      primaryContradicting.length === primaryClaims.length ||
      (primaryClaims.length === 1 && primaryHighConfContradicting.length === 1) ||
      (primaryContradicting.length > primarySupporting.length && primarySupporting.length === 0)
    ) {
      veracityVerdict = "false";
      overrideApplied = {
        name: "OVERRIDE_CENTRAL_CLAIM_CONTRADICTED",
        triggerValues: { primaryContradicting: primaryContradicting.length },
        claimsInvolved: primaryHighConfContradicting.map((e) => e.claimId),
      };
    } else if (veracityVerdict === "verified_true" || veracityVerdict === "mostly_true") {
      veracityVerdict = "mostly_false";
      overrideApplied = {
        name: "OVERRIDE_MAJOR_HIGH_CONF_CONTRADICTION",
        triggerValues: { highConfContradicting: primaryHighConfContradicting.length },
        claimsInvolved: primaryHighConfContradicting.map((e) => e.claimId),
      };
    }
  } else if (anyHighConfContradicting.length > 0 && (veracityVerdict === "verified_true" || veracityVerdict === "mostly_true")) {
    veracityVerdict = "mostly_true";
    overrideApplied = {
      name: "OVERRIDE_PREVENT_CONTRADICTION_HIDING",
      triggerValues: { anyHighConfContradicting: anyHighConfContradicting.length },
      claimsInvolved: anyHighConfContradicting.map((e) => e.claimId),
    };
  } else if (
    omissions.some(
      (o) =>
        (o.type === "misleading_framing" ||
          o.type === "missing_qualification" ||
          o.type === "missing_context") &&
        o.severity === "high"
    ) &&
    (veracityVerdict === "verified_true" ||
      veracityVerdict === "mostly_true" ||
      veracityVerdict === "mixed")
  ) {
    veracityVerdict = "misleading";
    overrideApplied = {
      name: "OVERRIDE_DISTORTING_OMISSION_MISLEADING",
      triggerValues: { omissionsCount: omissions.length },
      claimsInvolved: omissions.map((o) => o.claimId).filter((id): id is string => Boolean(id)),
    };
  }

  // Core-Event Gate Enforcement:
  // Must be at least "mostly_true" unless contradicting evidence exists.
  // Detail variations / peripheral disagreements must NOT override this gate.
  if (coreEventGatePassed && primaryHighConfContradicting.length === 0 && primaryContradicting.length === 0) {
    if (veracityVerdict !== "mostly_true" && veracityVerdict !== "verified_true") {
      veracityVerdict = "mostly_true";
      overrideApplied = undefined;
    }
    if (finalScore < 70) {
      finalScore = 70;
    }
  }

  // Specialized Rule: Hedged Speculation & Developing Rumour Reports
  const primarySpecOrReported = primaryClaims.filter(
    (c) => c.certainty === "speculation" || c.certainty === "reported_claim"
  );
  const isPredominantlyHedged =
    primarySpecOrReported.length > 0 &&
    primarySpecOrReported.length >= Math.ceil(primaryClaims.length / 2);
  const allPrimaryHedgedSupported =
    isPredominantlyHedged &&
    primarySpecOrReported.every((c) => evalMap.get(c.id)?.verdict === "supporting");

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
    veracityVerdict = "mostly_true";
    factors.push({
      code: "HEDGED_SPECULATION_MOSTLY_TRUSTWORTHY",
      effect: 0,
      note: "This story reports unconfirmed developments. The reporting is consistent with available sources; the outcome is not confirmed.",
    });
  }

  // Step 4: Positive verdict gating
  // A positive verdict ("verified_true", "mostly_true") requires at least ONE independent, non-social, same_event cluster supporting the core event claim.
  // If zero independent same-event clusters exist:
  // - Verdict is "unverified" ("Unable to Verify").
  // - Note: "No independent reporting of this event was found."
  // - Score can reflect whatever signals exist, but the verdict cannot claim verified.
  if (totalIndependentClustersCount === 0) {
    if (
      anyContradicting.length === 0 ||
      veracityVerdict === "verified_true" ||
      veracityVerdict === "mostly_true" ||
      veracityVerdict === "mixed"
    ) {
      veracityVerdict = "unverified";
      factors.push({
        code: "NO_INDEPENDENT_SAME_EVENT_CLUSTERS",
        effect: 0,
        note: "No independent reporting of this event was found.",
      });
    }
  }

  const storyStatus = determineStoryStatus(claims, evaluations, evidenceList, comparison);

  if (overrideApplied) {
    factors.push({
      code: `OVERRIDE_${overrideApplied.name}`,
      effect: 0,
      note: `Verdict adjusted to '${veracityVerdict}' by override rule: ${overrideApplied.name}`,
    });
  }

  const scoreBreakdown: ScoreBreakdownV2 = {
    claimContributions: Math.round(normalizedClaimScore * 10) / 10,
    conflictAdjustments: Math.round(clampedUnresolvedPenalty * 10) / 10,
    unresolvedDetailPenalty: clampedUnresolvedPenalty,
    omissionPenalty: clampedOmissionPenalty,
    confidenceAdjustment,
    finalScore,
    factors,
  };

  return {
    overallTrustScore: finalScore,
    veracityVerdict,
    confidence: reportedConfidence,
    scoreBreakdown,
    overrideApplied,
    gate100Result,
    coverageLimited,
    verifiedTrue,
    consistency: consistencyResult,
    storyStatus,
    coreEventGatePassed,
  };
}
