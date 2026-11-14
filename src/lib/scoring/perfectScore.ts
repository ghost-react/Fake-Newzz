import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import { ComparisonReport, ClaimComparisonResult } from "@/schemas/comparison";
import { DEFAULT_SCORING_V2_CONFIG, ScoringV2Config } from "./config.v2";

export interface GateConditionFailure {
  code: string;
  condition: string;
  details: string;
}

export interface Gate100Result {
  canReach100: boolean;
  failedConditions: GateConditionFailure[];
  allowedMaxScore: number;
}

export interface PerfectScoreInput {
  claims: ClaimInput[];
  evaluations: ClaimEvaluation[];
  comparison?: ComparisonReport;
  omissions: Omission[];
  evidence?: Evidence[];
  config?: ScoringV2Config;
}

/**
 * Evaluates whether an article satisfies all 8 mandatory conditions to reach a perfect 100/100 score.
 * If any condition fails, returns canReach100: false, the list of failed conditions, and the allowed cap (e.g. 95).
 */
export function scoreCanReach100(input: PerfectScoreInput): Gate100Result {
  const config = input.config || DEFAULT_SCORING_V2_CONFIG;
  const failedConditions: GateConditionFailure[] = [];

  const evalMap = new Map<string, ClaimEvaluation>();
  input.evaluations.forEach((e) => evalMap.set(e.claimId, e));

  const comparisonMap = new Map<string, ClaimComparisonResult>();
  if (input.comparison) {
    input.comparison.claims.forEach((c) => comparisonMap.set(c.claimId, c));
  }

  const evidenceMap = new Map<string, Evidence>();
  (input.evidence || []).forEach((e) => evidenceMap.set(e.id, e));

  const highAndMedClaims = input.claims.filter(
    (c) => (c.importance === "high" || c.importance === "medium") && c.layer !== "interpretation"
  );

  // Condition 1: Every high and medium importance claim is supporting
  const nonSupportingClaims = highAndMedClaims.filter((c) => {
    const ev = evalMap.get(c.id);
    return !ev || ev.verdict !== "supporting";
  });
  if (nonSupportingClaims.length > 0) {
    failedConditions.push({
      code: "NOT_ALL_MAJOR_CLAIMS_SUPPORTING",
      condition: "every high and medium importance claim supporting",
      details: `${nonSupportingClaims.length} major claim(s) do not have a supporting verdict: ${nonSupportingClaims.map((c) => c.id).join(", ")}`,
    });
  }

  // Condition 2: Each high/med claim has independentClusterCount >= 2 OR official/primary-document cluster
  const insufficientlyCorroborated = highAndMedClaims.filter((c) => {
    const comp = comparisonMap.get(c.id);
    const clusterCount = comp ? comp.independentClusterCount : 0;
    if (clusterCount >= 2) return false;

    // Check if backed by official or primary-document evidence
    const ev = evalMap.get(c.id);
    const citedEvidence = (ev?.evidenceIds || []).map((id) => evidenceMap.get(id)).filter(Boolean) as Evidence[];
    const hasOfficial = citedEvidence.some(
      (e) => e.sourceType === "official" || e.sourceType === "primary_document"
    );
    return !hasOfficial;
  });
  if (insufficientlyCorroborated.length > 0) {
    failedConditions.push({
      code: "INSUFFICIENT_CLUSTER_CORROBORATION",
      condition: "each high and medium claim has independentClusterCount >= 2 OR official/primary source",
      details: `${insufficientlyCorroborated.length} major claim(s) lack 2+ clusters or official source: ${insufficientlyCorroborated.map((c) => c.id).join(", ")}`,
    });
  }

  // Condition 3: Evaluator confidence high for all high and medium claims
  const nonHighConfidence = highAndMedClaims.filter((c) => {
    const ev = evalMap.get(c.id);
    return !ev || ev.confidence !== "high";
  });
  if (nonHighConfidence.length > 0) {
    failedConditions.push({
      code: "EVALUATOR_CONFIDENCE_NOT_HIGH",
      condition: "evaluator confidence high for all high and medium claims",
      details: `${nonHighConfidence.length} major claim(s) have confidence below high: ${nonHighConfidence.map((c) => c.id).join(", ")}`,
    });
  }

  // Condition 4: Evidence is full_text not snippet-only
  const snippetOnlyClaims = highAndMedClaims.filter((c) => {
    const ev = evalMap.get(c.id);
    if (!ev || !ev.evidenceIds || ev.evidenceIds.length === 0) return true;
    const citedEvidence = ev.evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean) as Evidence[];
    if (citedEvidence.length === 0) return false;
    // If every cited evidence item is snippet-only or lacking retrieved content
    return citedEvidence.every(
      (e) =>
        e.sourceContentStatus === "snippet_only" ||
        (e.sourceContentStatus !== "retrieved" && e.sourceType !== "official" && e.sourceType !== "primary_document")
    );
  });
  if (snippetOnlyClaims.length > 0) {
    failedConditions.push({
      code: "EVIDENCE_SNIPPET_ONLY",
      condition: "evidence is full_text not snippet-only",
      details: `${snippetOnlyClaims.length} major claim(s) rely solely on snippet-only evidence: ${snippetOnlyClaims.map((c) => c.id).join(", ")}`,
    });
  }

  // Condition 5: No conflicts across all dimensions
  const totalConflicts = input.comparison ? input.comparison.totalConflicts : 0;
  if (totalConflicts > 0) {
    failedConditions.push({
      code: "CONFLICTS_PRESENT",
      condition: "no conflicts between independent clusters",
      details: `${totalConflicts} conflict(s) detected across comparison dimensions`,
    });
  }

  // Condition 6: No unresolved or unsupported material details
  const materialDims = new Set(config.materialDimensions);
  let materialUnresolvedCount = 0;
  let materialUnsupportedCount = 0;

  if (input.comparison) {
    for (const claimComp of input.comparison.claims) {
      for (const dim of claimComp.dimensions) {
        if (materialDims.has(dim.dimension)) {
          if (dim.outcome === "unresolved") {
            materialUnresolvedCount++;
          }
          if (dim.outcome === "unsupported_detail") {
            materialUnsupportedCount++;
          }
        }
      }
    }
  }

  if (materialUnresolvedCount > 0 || materialUnsupportedCount > 0) {
    failedConditions.push({
      code: "UNRESOLVED_OR_UNSUPPORTED_MATERIAL_DETAILS",
      condition: "no unresolved or unsupported material details",
      details: `${materialUnresolvedCount} unresolved and ${materialUnsupportedCount} unsupported material details found`,
    });
  }

  // Condition 7: No omissions of any severity
  if (input.omissions.length > 0) {
    failedConditions.push({
      code: "OMISSIONS_PRESENT",
      condition: "no omissions of any severity",
      details: `${input.omissions.length} contextual omission(s) present`,
    });
  }

  // Condition 8: No interpretation claim presented as fact
  // Interpretation claims must not have verdict supporting as a factual claim without layer qualification
  const interpretationAsFact = input.claims.filter((c) => {
    if (c.layer === "interpretation") {
      const ev = evalMap.get(c.id);
      return ev && ev.verdict === "supporting";
    }
    return false;
  });
  if (interpretationAsFact.length > 0) {
    failedConditions.push({
      code: "INTERPRETATION_PRESENTED_AS_FACT",
      condition: "no interpretation claim presented as fact",
      details: `${interpretationAsFact.length} interpretation-layer claim(s) evaluated as supported factual events`,
    });
  }

  const canReach100 = failedConditions.length === 0;
  const allowedMaxScore = canReach100 ? 100 : config.gateFailureMaxScore;

  return {
    canReach100,
    failedConditions,
    allowedMaxScore,
  };
}

