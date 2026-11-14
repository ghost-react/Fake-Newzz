import { ComparisonDimension, ComparisonReport, ClaimComparisonResult } from "@/schemas/comparison";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { OriginCluster } from "../comparison/independence";
import { DEFAULT_SCORING_V2_CONFIG, ScoringV2Config } from "./config.v2";
import { ScoreFactorV2 } from "@/schemas/verification";
import { normalizeCurrencyToEur, extractRangeInfo } from "../comparison/normalization";

export interface DimensionConsistencyResult {
  dimension: ComparisonDimension;
  versionCount: number;
  distinctVersions: string[];
  agreementShare: number;
  isPossibleUpdate: boolean;
  score: number; // 0-100
  penalty: number;
  reportingClusterCount: number;
}

export interface ClaimConsistencyResult {
  claimId: string;
  assessable: boolean;
  clusterCount: number;
  score: number | null; // 0-100 or null if unassessable
  dimensions: DimensionConsistencyResult[];
  unassessedReason?: string;
}

export interface ConsensusConsistencyResult {
  consistencyScore: number | null; // 0-100 or null
  assessable: boolean;
  assessableClaimCount: number;
  totalClaimsCount: number;
  totalDistinctVersions: number;
  dimensionsWithMostVariation: Array<{
    dimension: ComparisonDimension;
    versionCount: number;
    claimId: string;
  }>;
  claimConsistencies: ClaimConsistencyResult[];
  multiplier: number;
  tier: "high" | "moderate" | "low" | "very_low" | "not_assessable";
  lowConsistencyVerdictCapApplied: boolean;
  factors: ScoreFactorV2[];
}

/**
 * Normalizes dimension values (numbers, dates, text) so semantically identical
 * representations ("7 lakh" and "700,000") yield the exact same string version.
 */
export function normalizeDimensionValue(
  value: string | undefined | null,
  dimension: ComparisonDimension
): string {
  if (!value) return "";
  let clean = value.trim().toLowerCase();

  // Non-mentions are returned as empty string so cluster is excluded
  if (
    clean === "" ||
    clean === "n/a" ||
    clean === "none" ||
    clean === "null" ||
    clean === "unknown" ||
    clean === "unspecified" ||
    clean === "not mentioned" ||
    clean === "not reported" ||
    clean === "unsupported" ||
    clean === "no mention"
  ) {
    return "";
  }

  // ─── 1. NUMBERS ──────────────────────────────────────────────────────────
  if (dimension === "numbers" || dimension === "event") {
    // Range normalization (e.g. "up to five years" vs "two to five years")
    const range = extractRangeInfo(value);
    if (range && range.max !== undefined) {
      return `range_max_${range.max}_${range.unit || "unit"}`;
    }

    // Currency normalization (e.g. "EUR 20,000" vs "INR 21 lakh" vs "USD 22,500")
    const curr = normalizeCurrencyToEur(value);
    if (curr) {
      return `eur_${Math.round(curr.amountEur)}`;
    }
  }

  if (dimension === "numbers") {
    // Strip common non-committal prefixes
    clean = clean.replace(
      /\b(about|around|approx|approximately|nearly|over|more than|at least|up to|total of|roughly|estimated|reported to be)\b/gi,
      ""
    ).trim();

    // Indian Lakh / Crore conversion
    // e.g. "7 lakh" / "7 lac" / "7.5 lakhs"
    const lakhMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/i);
    if (lakhMatch) {
      const num = parseFloat(lakhMatch[1]) * 100000;
      return Math.round(num).toString();
    }

    // e.g. "1.5 crore" / "2 cr"
    const croreMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:crores?|cr)\b/i);
    if (croreMatch) {
      const num = parseFloat(croreMatch[1]) * 10000000;
      return Math.round(num).toString();
    }

    // Western million / billion / thousand conversion
    const millionMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:million|m)\b/i);
    if (millionMatch) {
      const num = parseFloat(millionMatch[1]) * 1000000;
      return Math.round(num).toString();
    }

    const billionMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:billion|b)\b/i);
    if (billionMatch) {
      const num = parseFloat(billionMatch[1]) * 1000000000;
      return Math.round(num).toString();
    }

    const thousandMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:thousand|k)\b/i);
    if (thousandMatch) {
      const num = parseFloat(thousandMatch[1]) * 1000;
      return Math.round(num).toString();
    }

    // Percentages: "25 percent" or "25 per cent" -> "25%"
    const percentMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)/i);
    if (percentMatch) {
      return `${percentMatch[1]}%`;
    }

    // Standard digit extraction with comma stripping: "700,000" -> "700000"
    const commaNumMatch = clean.match(/(\d[\d,]*\d|\d+)/);
    if (commaNumMatch) {
      const plainNum = commaNumMatch[1].replace(/,/g, "");
      return plainNum;
    }
  }

  // ─── 2. DATES ────────────────────────────────────────────────────────────
  if (dimension === "date") {
    // Check YYYY-MM-DD
    const isoMatch = clean.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = String(Number(isoMatch[2])).padStart(2, "0");
      const d = String(Number(isoMatch[3])).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const monthNames: Record<string, string> = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12",
    };

    const monthDayYear = clean.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
    if (monthDayYear && monthNames[monthDayYear[1].toLowerCase()]) {
      const m = monthNames[monthDayYear[1].toLowerCase()];
      const d = String(Number(monthDayYear[2])).padStart(2, "0");
      const y = monthDayYear[3];
      return `${y}-${m}-${d}`;
    }

    const dayMonthYear = clean.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s+(\d{4})\b/i);
    if (dayMonthYear && monthNames[dayMonthYear[2].toLowerCase()]) {
      const m = monthNames[dayMonthYear[2].toLowerCase()];
      const d = String(Number(dayMonthYear[1])).padStart(2, "0");
      const y = dayMonthYear[3];
      return `${y}-${m}-${d}`;
    }

    // Fallback: parse date using local parts
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    // Clean noise
    clean = clean.replace(/\b(on|dated|morning of|night of|evening of)\b/g, "").trim();
  }

  // ─── 3. NAMES ────────────────────────────────────────────────────────────
  if (dimension === "names") {
    // Strip titles and honorifics
    clean = clean.replace(
      /\b(mr|mrs|ms|dr|prof|justice|chief justice|cji|judge|minister|prime minister|pm|president|shri|smt)\.?\s+/gi,
      ""
    );
  }

  // ─── 4. QUOTATIONS ───────────────────────────────────────────────────────
  if (dimension === "quotations") {
    // Strip surrounding and inner quotes
    clean = clean.replace(/["'“”‘’]/g, "").trim();
  }

  // ─── 5. ALLEGATIONS ──────────────────────────────────────────────────────
  // "Allegation vs established fact differences are not variation"
  if (dimension === "allegations") {
    return "";
  }

  // Strip punctuation and collapse whitespace
  return clean
    .replace(/[^\w\s%.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface EvaluateConsensusConsistencyOptions {
  claims: ClaimInput[];
  comparison?: ComparisonReport;
  clusters?: OriginCluster[];
  evidence?: Evidence[];
  config?: ScoringV2Config;
}

/**
 * Evaluates deterministic Consensus Consistency for a set of claims across
 * independent origin clusters.
 */
export function evaluateConsensusConsistency(
  options: EvaluateConsensusConsistencyOptions
): ConsensusConsistencyResult {
  const config = options.config || DEFAULT_SCORING_V2_CONFIG;
  const comparison = options.comparison;
  const clusters = options.clusters || [];
  const evidenceList = options.evidence || [];

  // Cluster confidence map
  const clusterConfidenceMap = new Map<string, string>();
  clusters.forEach((c) => {
    clusterConfidenceMap.set(c.clusterId, c.independenceConfidence);
  });

  // Evidence to publishedAt map
  const evidencePublishDateMap = new Map<string, string | null>();
  evidenceList.forEach((e) => {
    evidencePublishDateMap.set(e.id, e.publishedAt || null);
  });

  const comparisonClaimMap = new Map<string, ClaimComparisonResult>();
  if (comparison) {
    comparison.claims.forEach((cc) => comparisonClaimMap.set(cc.claimId, cc));
  }

  const claimConsistencies: ClaimConsistencyResult[] = [];
  const allDimensionVariations: Array<{
    dimension: ComparisonDimension;
    versionCount: number;
    claimId: string;
  }> = [];

  const factors: ScoreFactorV2[] = [];
  const materialSet = new Set(config.materialDimensions);

  let assessableClaimCount = 0;
  let weightedConsistencySum = 0;
  let totalAssessableWeight = 0;
  let totalDistinctVersionsCount = 0;

  for (const claim of options.claims) {
    // Exclude interpretation claims and opinion_analysis certainty from factual consistency
    if (claim.layer === "interpretation" || claim.certainty === "opinion_analysis") {
      continue;
    }

    const claimComp = comparisonClaimMap.get(claim.id);
    const clusterCount = claimComp ? claimComp.independentClusterCount : 0;

    // Rule 2: If fewer than 2 independent clusters exist, consistency is "not assessable"
    if (clusterCount < config.minClustersForAssessable) {
      claimConsistencies.push({
        claimId: claim.id,
        assessable: false,
        clusterCount,
        score: null,
        dimensions: [],
        unassessedReason: `Fewer than ${config.minClustersForAssessable} independent clusters available (${clusterCount})`,
      });
      continue;
    }

    // Evaluate material dimensions
    const dimensionsEvaluated: DimensionConsistencyResult[] = [];

    if (claimComp && claimComp.dimensions) {
      for (const dimResult of claimComp.dimensions) {
        if (!materialSet.has(dimResult.dimension)) {
          continue;
        }

        // Collect the value each independent origin cluster reports.
        // Syndicated copies belong to one cluster and cast only one vote.
        const clusterReportedValues = new Map<string, string>();
        const clusterEvidenceIds = new Map<string, string>();

        for (const sv of dimResult.sourceValues) {
          if (!clusterReportedValues.has(sv.clusterId)) {
            clusterReportedValues.set(sv.clusterId, sv.value);
            clusterEvidenceIds.set(sv.clusterId, sv.evidenceId);
          }
        }

        // Normalize values and filter out non-mentions
        const activeClusterNormalized = new Map<string, string>();

        for (const [clusterId, rawVal] of clusterReportedValues.entries()) {
          const normVal = normalizeDimensionValue(rawVal, dimResult.dimension);
          if (normVal !== "") {
            activeClusterNormalized.set(clusterId, normVal);
          }
        }

        const reportingClusterCount = activeClusterNormalized.size;
        if (reportingClusterCount === 0) {
          // Dimension not mentioned by any cluster, excluded from calculation
          continue;
        }

        const articleNorm = normalizeDimensionValue(dimResult.articleValue, dimResult.dimension);

        // Collect distinct versions
        const distinctVersionsSet = new Set<string>();
        if (articleNorm !== "") {
          distinctVersionsSet.add(articleNorm);
        }
        for (const normVal of activeClusterNormalized.values()) {
          distinctVersionsSet.add(normVal);
        }

        const distinctVersions = Array.from(distinctVersionsSet);
        const versionCount = distinctVersions.length;

        const isRumourVariation =
          dimResult.outcome === "unconfirmed_variation" ||
          dimResult.outcome === "denial" ||
          claim.certainty === "speculation" ||
          claim.certainty === "reported_claim";

        const isDetailVariation =
          dimResult.outcome === "detail_variation" ||
          (Boolean(dimResult.note) && dimResult.note!.toLowerCase().includes("detail variation"));

        const isExemptVariation = isRumourVariation || isDetailVariation;

        if (!isExemptVariation) {
          totalDistinctVersionsCount += Math.max(0, versionCount - 1);
          if (versionCount > 1) {
            allDimensionVariations.push({
              dimension: dimResult.dimension,
              versionCount,
              claimId: claim.id,
            });
          }
        }

        // Compute agreementShare
        // weight of clusters matching article's value / total reporting cluster weight
        let matchingClusterWeight = 0;
        let totalReportingWeight = 0;

        for (const [clusterId, normVal] of activeClusterNormalized.entries()) {
          const conf = clusterConfidenceMap.get(clusterId) || "medium";
          const weight = config.consistencyIndependenceWeights[conf] ?? 0.75;

          totalReportingWeight += weight;
          if (articleNorm !== "" && normVal === articleNorm) {
            matchingClusterWeight += weight;
          }
        }

        const agreementShare =
          totalReportingWeight > 0 ? matchingClusterWeight / totalReportingWeight : 0;

        // Check if differences are explained by publication timing (possible_update)
        const isExplicitUpdate =
          dimResult.note?.toLowerCase().includes("possible_update") ||
          dimResult.note?.toLowerCase().includes("changed between reports") ||
          false;

        let hasTimingDifference = false;
        if (versionCount > 1 && !isExplicitUpdate) {
          const dates: string[] = [];
          for (const evId of clusterEvidenceIds.values()) {
            const pubDate = evidencePublishDateMap.get(evId);
            if (pubDate) dates.push(pubDate);
          }
          const uniqueDates = new Set(dates);
          if (uniqueDates.size > 1) {
            hasTimingDifference = true;
          }
        }

        const isPossibleUpdate = isExplicitUpdate || hasTimingDifference;

        // Calculate dimension score
        let baseScore = agreementShare * 100;
        let penalty = 0;

        if (versionCount > 1 && !isPossibleUpdate && !isExemptVariation) {
          const extraVersions = versionCount - 1;
          const dimMultiplier = config.dimensionVersionMultipliers[dimResult.dimension] ?? 1.0;
          const impMultiplier = config.importanceVersionMultipliers[claim.importance] ?? 1.0;
          penalty = extraVersions * config.baseExtraVersionPenalty * dimMultiplier * impMultiplier;
        } else if (versionCount > 1 && isDetailVariation) {
          // Minor detail variation penalty (proportional to importance)
          penalty = 3 * (config.importanceVersionMultipliers[claim.importance] ?? 1.0);
        }

        const dimScore = Math.max(0, Math.min(100, Math.round(baseScore - penalty)));

        dimensionsEvaluated.push({
          dimension: dimResult.dimension,
          versionCount,
          distinctVersions,
          agreementShare: Math.round(agreementShare * 100) / 100,
          isPossibleUpdate,
          score: dimScore,
          penalty: Math.round(penalty * 10) / 10,
          reportingClusterCount,
        });

        // Emit breakdown factor entries
        if (dimResult.outcome === "detail_variation" || isDetailVariation) {
          factors.push({
            code: "DETAIL_VARIATION",
            effect: -Math.round(penalty),
            claimId: claim.id,
            dimension: dimResult.dimension,
            note: dimResult.note || `Detail variation on ${dimResult.dimension} across independent reporting`,
          });
        } else if (dimResult.outcome === "unconfirmed_variation") {
          factors.push({
            code: "UNCONFIRMED_VARIATION",
            effect: 0,
            claimId: claim.id,
            dimension: dimResult.dimension,
            note: `Expected rumour variation on ${dimResult.dimension} (${versionCount} versions) across developing reports; no penalty applied`,
          });
        } else if (dimResult.outcome === "denial") {
          factors.push({
            code: "DENIAL_CONTEXT",
            effect: 0,
            claimId: claim.id,
            dimension: dimResult.dimension,
            note: `Party denial recorded on ${dimResult.dimension} as additional context, not a contradiction`,
          });
        } else if (isPossibleUpdate && versionCount > 1) {
          factors.push({
            code: "CONSISTENCY_POSSIBLE_UPDATE",
            effect: 0,
            claimId: claim.id,
            dimension: dimResult.dimension,
            note: `Variation in ${dimResult.dimension} (${versionCount} versions) explained by publication timing; no penalty applied`,
          });
        } else if (versionCount > 1) {
          factors.push({
            code: "CONSISTENCY_VERSION_VARIATION",
            effect: -Math.round(penalty * 10) / 10,
            claimId: claim.id,
            dimension: dimResult.dimension,
            note: `${versionCount} distinct versions found for ${dimResult.dimension} across independent clusters`,
          });
        }
      }
    }

    if (dimensionsEvaluated.length === 0) {
      // No material dimensions with active clusters
      claimConsistencies.push({
        claimId: claim.id,
        assessable: false,
        clusterCount,
        score: null,
        dimensions: [],
        unassessedReason: "No material dimensions reported across independent clusters",
      });
      continue;
    }

    // Per-claim consistency score (average of assessable dimensions)
    const claimAvgScore = Math.round(
      dimensionsEvaluated.reduce((sum, d) => sum + d.score, 0) / dimensionsEvaluated.length
    );

    const impWeight = config.importanceWeights[claim.importance] ?? 2.0;
    weightedConsistencySum += claimAvgScore * impWeight;
    totalAssessableWeight += impWeight;
    assessableClaimCount++;

    claimConsistencies.push({
      claimId: claim.id,
      assessable: true,
      clusterCount,
      score: claimAvgScore,
      dimensions: dimensionsEvaluated,
    });
  }

  // Article-level consistency score
  let articleConsistencyScore: number | null = null;
  const assessable = assessableClaimCount > 0;

  if (assessable && totalAssessableWeight > 0) {
    articleConsistencyScore = Math.round(weightedConsistencySum / totalAssessableWeight);
  }

  // Multiplier table lookup
  let multiplier = 1.0;
  let tier: ConsensusConsistencyResult["tier"] = "not_assessable";

  if (articleConsistencyScore !== null) {
    if (articleConsistencyScore >= config.consistencyThresholds.high) {
      tier = "high";
      multiplier = config.consistencyMultipliers.high;
    } else if (articleConsistencyScore >= config.consistencyThresholds.moderate) {
      tier = "moderate";
      multiplier = config.consistencyMultipliers.moderate;
    } else if (articleConsistencyScore >= config.consistencyThresholds.low) {
      tier = "low";
      multiplier = config.consistencyMultipliers.low;
    } else {
      tier = "very_low";
      multiplier = config.consistencyMultipliers.veryLow;
    }
  } else {
    factors.push({
      code: "CONSISTENCY_NOT_ASSESSABLE",
      effect: 0,
      note: "Consensus consistency is not assessable due to fewer than 2 independent reporting clusters",
    });
  }

  // Sort dimensions with most variation
  allDimensionVariations.sort((a, b) => b.versionCount - a.versionCount);

  return {
    consistencyScore: articleConsistencyScore,
    assessable,
    assessableClaimCount,
    totalClaimsCount: options.claims.length,
    totalDistinctVersions: totalDistinctVersionsCount,
    dimensionsWithMostVariation: allDimensionVariations.slice(0, 5),
    claimConsistencies,
    multiplier,
    tier,
    lowConsistencyVerdictCapApplied: false,
    factors,
  };
}
