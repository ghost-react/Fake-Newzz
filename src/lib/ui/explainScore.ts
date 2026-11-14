import { ScoreBreakdown, ScoreBreakdownV2, ScoreFactorV2 } from "@/schemas/verification";
import { ComparisonReport, CrossSourceComparison, TransparentScoreExplanation } from "@/schemas/comparison";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { ClaimInput } from "@/schemas/evidence";

export interface ScoreExplanationItem {
  id: string;
  effect: number;
  direction: "positive" | "negative" | "neutral";
  text: string;
  claimId?: string;
  claimText?: string;
  dimension?: string;
  code?: string;
}

/**
 * Pure function to generate human-readable, templated contributing factors
 * for the "Why this score?" section.
 * Supports both v1 and v2 score breakdowns.
 */
export function explainScore(
  scoreBreakdown?: ScoreBreakdown | ScoreBreakdownV2 | any,
  comparison?: ComparisonReport | CrossSourceComparison | null,
  evaluations?: ClaimEvaluation[] | null,
  claims?: (ClaimInput | { id: string; text: string; [key: string]: any })[] | null,
  scoreExplanation?: TransparentScoreExplanation | null
): ScoreExplanationItem[] {
  if (!scoreBreakdown) {
    return [];
  }

  const claimMap = new Map<string, string>();
  if (claims && Array.isArray(claims)) {
    claims.forEach((c) => {
      if (c?.id && c?.text) {
        claimMap.set(c.id, c.text);
      }
    });
  }

  const items: ScoreExplanationItem[] = [];

  // ─── CASE A: v2 Score Breakdown (factors array present) ────────────────────
  if (Array.isArray(scoreBreakdown.factors) && scoreBreakdown.factors.length > 0) {
    const factors: ScoreFactorV2[] = scoreBreakdown.factors;

    factors.forEach((factor, idx) => {
      const claimText = factor.claimId ? claimMap.get(factor.claimId) : undefined;
      const effect = typeof factor.effect === "number" ? Math.round(factor.effect * 10) / 10 : 0;
      const sign = effect > 0 ? `+${effect}` : `${effect}`;
      const direction: "positive" | "negative" | "neutral" =
        effect > 0 ? "positive" : effect < 0 ? "negative" : "neutral";

      let text = "";

      switch (factor.code) {
        case "INTERPRETATION_CLAIM_EXCLUDED":
          text = "Not scored — opinions and framing are not verified as facts";
          break;

        case "OPINION_ANALYSIS_CLAIM_EXCLUDED":
          text = "Not scored — opinions, predictions, and analytical framing are not verified as facts";
          break;

        case "UNCONFIRMED_VARIATION":
          text = factor.note || "Expected rumour variation across developing reports (lowers confidence only)";
          break;

        case "DENIAL_CONTEXT":
          text = factor.note || "Party denial recorded as additional context, not a contradiction";
          break;

        case "HEDGED_SPECULATION_MOSTLY_TRUSTWORTHY":
          text = "This story reports unconfirmed developments. The reporting is consistent with available sources; the outcome is not confirmed.";
          break;

        case "SNIPPET_ONLY_CONFIDENCE_CAP":
          text = "Confidence capped at medium due to snippet-only evidence depth";
          break;

        case "CORROBORATION_MULTIPLIER": {
          const count = factor.clusterCount ?? 2;
          const outletLabel = count === 1 ? "1 outlet" : `${count} independent outlets`;
          const claimSnippet = claimText ? ` on "${truncate(claimText, 35)}"` : "";
          text = `${sign}: Confirmed by ${outletLabel}${claimSnippet}`;
          break;
        }

        case "MATERIAL_CONFLICT": {
          const dim = factor.dimension ? formatDimension(factor.dimension) : "Key details";
          text = `${sign}: ${dim} contradicts reporting from other outlets`;
          break;
        }

        case "CONFLICT_PENALTY": {
          const dim = factor.dimension ? formatDimension(factor.dimension) : "reported facts";
          text = `${sign}: Direct conflict on ${dim} between independent sources`;
          break;
        }

        case "UNRESOLVED_DETAIL": {
          const dim = factor.dimension ? formatDimension(factor.dimension) : "details";
          text = `${sign}: Unresolved differences regarding ${dim}`;
          break;
        }

        case "OMISSION_PENALTY":
          text = `${sign}: Missing critical context or key background details`;
          break;

        case "CONFIDENCE_ADJUSTMENT":
          text = `${sign}: Adjustment based on evidence depth and source independence`;
          break;

        case "COVERAGE_LIMITED":
          text = "Coverage limited across independent sources";
          break;

        case "CONSISTENCY_AGREEMENT_SHARE":
          text = `${sign}: Consensus agreement across independent origin clusters`;
          break;

        case "CONSISTENCY_VERSION_VARIATION": {
          const dim = factor.dimension ? formatDimension(factor.dimension) : "reported details";
          text = factor.note
            ? (effect !== 0 ? `${sign}: ${factor.note}` : factor.note)
            : `${sign}: Variation in ${dim} across independent clusters`;
          break;
        }

        case "CONSISTENCY_POSSIBLE_UPDATE":
          text = factor.note || "Differences explained by publication timing; no penalty applied";
          break;

        case "CONSISTENCY_NOT_ASSESSABLE":
          text = "Consensus consistency not assessable (fewer than 2 independent clusters)";
          break;

        case "CONSISTENCY_MULTIPLIER":
          text = factor.note
            ? (effect !== 0 ? `${sign}: ${factor.note}` : factor.note)
            : `${sign}: Adjusted by consensus consistency multiplier`;
          break;

        case "CONSISTENCY_VERDICT_CAP":
          text = "Verdict capped at Mixed Evidence due to low consensus consistency";
          break;

        case "VERIFIED_TRUE":
          text = "Verified True: 100% consensus consistency across independent sources";
          break;

        default:
          if (factor.note) {
            text = effect !== 0 ? `${sign}: ${factor.note}` : factor.note;
          } else {
            text = effect !== 0 ? `${sign}: Adjustment for ${factor.code}` : factor.code;
          }
      }

      items.push({
        id: `factor-${idx}-${factor.code}`,
        effect,
        direction,
        text,
        claimId: factor.claimId,
        claimText,
        dimension: factor.dimension,
        code: factor.code,
      });
    });

    return items;
  }

  // ─── CASE B: v1 Score Breakdown ───────────────────────────────────────────
  if (typeof scoreBreakdown.claimScore === "number") {
    // 1. Base claim score
    const claimScore = Math.round(scoreBreakdown.claimScore);
    const supportingEvals = (evaluations || []).filter((e) => e.verdict === "supporting");
    const contradictingEvals = (evaluations || []).filter((e) => e.verdict === "contradicting");

    if (claimScore > 0) {
      const summaryPart =
        supportingEvals.length > 0
          ? `${supportingEvals.length} claim(s) corroborated by evidence`
          : "Corroborated claims";
      items.push({
        id: "v1-claim-score",
        effect: claimScore,
        direction: "positive",
        text: `+${claimScore}: ${summaryPart}`,
        claimId: supportingEvals[0]?.claimId,
        claimText: supportingEvals[0] ? claimMap.get(supportingEvals[0].claimId) : undefined,
        code: "CLAIM_SCORE",
      });
    }

    if (contradictingEvals.length > 0) {
      items.push({
        id: "v1-contradictions",
        effect: -15,
        direction: "negative",
        text: `-15: ${contradictingEvals.length} claim(s) directly contradicted by evidence`,
        claimId: contradictingEvals[0]?.claimId,
        claimText: contradictingEvals[0] ? claimMap.get(contradictingEvals[0].claimId) : undefined,
        code: "CONTRADICTION",
      });
    }

    // 2. Context penalty
    if (scoreBreakdown.contextPenalty && scoreBreakdown.contextPenalty > 0) {
      const penalty = Math.round(scoreBreakdown.contextPenalty);
      items.push({
        id: "v1-context-penalty",
        effect: -penalty,
        direction: "negative",
        text: `-${penalty}: Omitted context penalty applied for missing background information`,
        code: "CONTEXT_PENALTY",
      });
    }

    // 3. Confidence adjustment
    if (scoreBreakdown.confidenceAdjustment && scoreBreakdown.confidenceAdjustment !== 0) {
      const adj = Math.round(scoreBreakdown.confidenceAdjustment);
      items.push({
        id: "v1-confidence-adjustment",
        effect: adj,
        direction: adj > 0 ? "positive" : "negative",
        text: `${adj > 0 ? "+" : ""}${adj}: Adjustment for evidence confidence and depth`,
        code: "CONFIDENCE_ADJUSTMENT",
      });
    }
  }

  // ─── CASE C: Fallback Synthesis (when neither v1 nor v2 produced factors) ─
  if (items.length === 0) {
    if (evaluations && evaluations.length > 0) {
      const supporting = evaluations.filter((e) => e.verdict === "supporting");
      const contradicting = evaluations.filter((e) => e.verdict === "contradicting");
      const unverified = evaluations.filter((e) => e.verdict === "qualifying");

      if (supporting.length > 0) {
        items.push({
          id: "synth-supporting",
          effect: Math.round(50 + 50 * (supporting.length / evaluations.length)),
          direction: "positive",
          text: `Corroborated: ${supporting.length} of ${evaluations.length} claim(s) corroborated by independent reporting`,
          code: "CORROBORATION",
        });
      }

      if (contradicting.length > 0) {
        items.push({
          id: "synth-contradicting",
          effect: -20,
          direction: "negative",
          text: `Contradicted: ${contradicting.length} claim(s) contradicted by independent evidence`,
          code: "CONTRADICTION",
        });
      }

      if (unverified.length > 0) {
        items.push({
          id: "synth-unverified",
          effect: 0,
          direction: "neutral",
          text: `Unconfirmed: ${unverified.length} claim(s) lack sufficient corroborating primary evidence`,
          code: "UNCONFIRMED",
        });
      }
    }

    const clusterCount =
      comparison && "totalIndependentClusters" in comparison
        ? comparison.totalIndependentClusters
        : comparison && "independentSourcesCount" in comparison
        ? comparison.independentSourcesCount
        : 0;

    if (clusterCount > 0) {
      items.push({
        id: "synth-clusters",
        effect: 0,
        direction: "positive",
        text: `Cross-Source Consensus: Corroborated across ${clusterCount} independent outlet cluster(s)`,
        code: "CONSENSUS_CLUSTERS",
      });
    }

    if (scoreExplanation) {
      if (scoreExplanation.crossSourceAgreementExplanation) {
        items.push({
          id: "synth-agreement",
          effect: 0,
          direction: "positive",
          text: scoreExplanation.crossSourceAgreementExplanation,
          code: "CROSS_SOURCE_AGREEMENT",
        });
      }
      if (scoreExplanation.unresolvedInformationExplanation) {
        items.push({
          id: "synth-unresolved",
          effect: 0,
          direction: "neutral",
          text: scoreExplanation.unresolvedInformationExplanation,
          code: "UNRESOLVED_INFO",
        });
      }
      if (scoreExplanation.missingContextExplanation) {
        items.push({
          id: "synth-omissions",
          effect: 0,
          direction: "negative",
          text: scoreExplanation.missingContextExplanation,
          code: "MISSING_CONTEXT",
        });
      }
    }
  }

  return items;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? `${str.slice(0, maxLen).trim()}...` : str;
}

function formatDimension(dim: string): string {
  return dim
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

