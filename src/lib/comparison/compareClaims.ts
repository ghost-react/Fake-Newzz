import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import {
  ComparisonDimensionResult,
  ComparisonDimensionResultSchema,
  ComparisonConflict,
  ComparisonConflictSchema,
  ClaimComparisonResult,
  ComparisonReport,
  AgreementSummary,
  SourceValue,
  ComparisonDimension,
  ComparisonOutcome,
} from "@/schemas/comparison";
import { DEFAULT_COMPARISON_CONFIG, ComparisonConfig } from "./config";
import { OriginCluster, clusterEvidenceIndependence } from "./independence";
import { isSocialOrAggregator } from "./socialExclusion";
import { traceStage } from "../debug/trace";
import {
  areRangesPartiallyAgreeing,
  areCurrenciesEquivalent,
  isDetailVariation,
} from "./normalization";
import { tagEvidenceWithEventMatch } from "./eventMatching";

/**
 * Intermediate schema for LLM structured output.
 * The LLM produces dimensional comparison and conflicts, but MUST NOT choose agreementSummary.
 */
export const LlmDimensionalComparisonSchema = z.object({
  dimensions: z.array(
    z.object({
      dimension: z.enum([
        "event",
        "names",
        "date",
        "location",
        "numbers",
        "quotations",
        "official_statements",
        "allegations",
        "context",
      ]),
      outcome: z.enum([
        "agreement",
        "partial_agreement",
        "contradiction",
        "additional_context",
        "unsupported_detail",
        "unresolved",
        "unconfirmed_variation",
        "denial",
        "detail_variation",
      ]),
      articleValue: z.string(),
      sourceValues: z.array(
        z.object({
          clusterId: z.string(),
          evidenceId: z.string(),
          value: z.string(),
          quote: z.string().optional(),
        })
      ),
      note: z.string().optional(),
    })
  ),
  conflicts: z.array(
    z.object({
      dimension: z.enum([
        "event",
        "names",
        "date",
        "location",
        "numbers",
        "quotations",
        "official_statements",
        "allegations",
        "context",
      ]),
      description: z.string(),
      evidenceIds: z.array(z.string()),
      conflictType: z.enum(["contradiction", "unconfirmed_variation", "denial", "detail_variation"]).optional(),
    })
  ),
});

export type LlmDimensionalComparison = z.infer<typeof LlmDimensionalComparisonSchema>;

export interface CompareClaimsOptions {
  config?: ComparisonConfig;
  articleText?: string;
  customComparator?: (
    claim: ClaimInput,
    articleClaimText: string,
    evidenceByCluster: Map<string, Array<{ evidence: Evidence; passage: string }>>,
    clusters: OriginCluster[]
  ) => Promise<LlmDimensionalComparison>;
}

const COMPARISON_SYSTEM_INSTRUCTION = `You are an expert news verification engine specialized in multi-source cross-examination.
Your task is to compare an article's factual claim against passages reported by multiple independent source clusters across specific dimensions.

Dimensions to inspect:
- event: did the core action happen?
- names: who was involved, their titles/roles?
- date: when did it happen?
- location: where did it happen?
- numbers: counts, amounts, percentages (compare values; if they differ across publication dates, check if it's a developing update).
- quotations: direct quotes attributed to people (check exact wording; do not penalize for minor translation or ellipsis unless meaning changes).
- official_statements: police, government, corporate statements cited.
- allegations: framed as allegation vs stated as proven fact.
- context: background or qualifiers reported by other clusters but omitted in the article.

Outcomes per dimension:
- "agreement": independent clusters report the same value.
- "partial_agreement": core matches, secondary details differ slightly.
- "contradiction": conflicting values across independent clusters that cannot be explained by publication timestamp.
- "additional_context": other clusters include relevant context the article lacks.
- "unsupported_detail": detail present in the article but found in no other cluster (uncorroborated, NOT a contradiction).
- "unresolved": conflicting reports with no resolution yet.

Strict rules:
1. ONLY cite evidence IDs and cluster IDs that were provided in the input. Never invent IDs.
2. If quotes are cited, keep them under 15 words.
3. If publication timestamps differ and later reports give a revised number (e.g. rising count), mark as outcome "partial_agreement" with note "possible_update", NOT "contradiction".
4. Do NOT choose an overall agreement summary. Only output dimensions and conflicts.`;

/**
 * Returns configured AI model for dimensional comparison.
 */
function getComparisonModel() {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleKey && googleKey.trim() !== "" && !googleKey.includes("YOUR_")) {
    return google("gemini-2.5-flash");
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.trim() !== "" && !anthropicKey.includes("YOUR_")) {
    return anthropic("claude-3-5-sonnet-latest");
  }

  return null;
}

/**
 * Truncates quote to maximum 15 words.
 */
function sanitizeQuote(quote?: string): string | undefined {
  if (!quote) return undefined;
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 15) return quote.trim();
  return words.slice(0, 15).join(" ");
}

const WORD_NUMBER_MAP: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70",
  eighty: "80", ninety: "90", hundred: "100", thousand: "1000",
  million: "1000000", billion: "1000000000", lakh: "100000", crore: "10000000",
};

/**
 * Extracts numbers and monetary amounts from text, including spelled-out numbers.
 */
function extractNumbers(text: string): string[] {
  const matches = text.match(/[₹$€£]?\b\d+(?:[.,]\d+)?%?\b/g) || [];
  const digits = matches
    .map((m) => m.replace(/[%₹$€£]/g, "").trim().toLowerCase())
    .filter(Boolean);

  const wordMatches =
    text.match(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|lakh|crore)\b/gi
    ) || [];
  const wordDigits = wordMatches
    .map((w) => WORD_NUMBER_MAP[w.toLowerCase()])
    .filter(Boolean);

  return Array.from(new Set([...digits, ...wordDigits]));
}

/**
 * Extracts quoted substrings from text.
 */
function extractQuotes(text: string): string[] {
  const matches = text.match(/["“'‘](.+?)["”'’]/g) || [];
  return matches
    .map((q) => q.replace(/["“'‘”]/g, "").trim())
    .filter((q) => q.length > 5);
}

/**
 * Checks whether evidence item is usable (not failed, blocked, timeout, or empty).
 */
export function isUsableEvidence(e: Evidence): boolean {
  if (e.fetchFailed || e.sourceContentStatus === "failed") {
    return false;
  }
  const text = (e.sourceContentExcerpt || e.snippet || "").trim();
  return text.length > 0;
}

/**
 * Computes deterministic agreementSummary according to strict boundary rules:
 * - "strong": 3+ independent clusters, no conflicts, no unresolved material dimensions.
 * - "moderate": 2 independent clusters, no conflicts.
 * - "weak": 1 independent cluster, or conflicts exist.
 * - "none": no usable sources.
 */
export function computeAgreementSummary(
  independentClusterCount: number,
  conflicts: ComparisonConflict[],
  dimensions: ComparisonDimensionResult[],
  config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG
): AgreementSummary {
  if (independentClusterCount === 0) {
    return "none";
  }

  // Only true contradictions break agreement; detail variations and unconfirmed variations do not
  const hasContradictionConflicts = conflicts.some(
    (c) => !c.conflictType || c.conflictType === "contradiction"
  );
  const hasContradictionDimensions = dimensions.some(
    (d) => d.outcome === "contradiction"
  );

  if (hasContradictionConflicts || hasContradictionDimensions) {
    return "weak";
  }

  const hasUnresolvedDimensions = dimensions.some(
    (d) => d.outcome === "unresolved"
  );

  if (
    independentClusterCount >= config.agreementThresholds.minClustersForStrong
  ) {
    return hasUnresolvedDimensions ? "moderate" : "strong";
  }

  if (
    independentClusterCount >= config.agreementThresholds.minClustersForModerate
  ) {
    return "moderate";
  }

  return "weak";
}

/**
 * Deterministic fallback for dimensional comparison when no LLM is configured or LLM fails.
 */
export function deterministicCompareClaim(
  claim: ClaimInput,
  articleClaimText: string,
  evidenceByCluster: Map<string, Array<{ evidence: Evidence; passage: string }>>,
  clusters: OriginCluster[]
): LlmDimensionalComparison {
  const dimensions: ComparisonDimensionResult[] = [];
  const conflicts: ComparisonConflict[] = [];

  const allUsableEvidence: Array<{ clusterId: string; evidence: Evidence; passage: string }> = [];
  for (const [clusterId, items] of evidenceByCluster.entries()) {
    for (const item of items) {
      allUsableEvidence.push({ clusterId, evidence: item.evidence, passage: item.passage });
    }
  }

  // If no usable evidence at all, emit unsupported_detail for the event
  if (allUsableEvidence.length === 0) {
    dimensions.push({
      dimension: "event",
      outcome: "unsupported_detail",
      articleValue: claim.text,
      sourceValues: [],
      note: "No independent reporting found corroborating this claim",
    });
    return { dimensions, conflicts };
  }

  // 1. Core Event Dimension
  const eventSourceValues: SourceValue[] = [];
  for (const [clusterId, items] of evidenceByCluster.entries()) {
    const primary = items[0];
    if (primary) {
      eventSourceValues.push({
        clusterId,
        evidenceId: primary.evidence.id,
        value: primary.evidence.title || primary.passage.slice(0, 100),
        quote: sanitizeQuote(primary.passage.slice(0, 80)),
      });
    }
  }

  dimensions.push({
    dimension: "event",
    outcome: "agreement",
    articleValue: claim.text,
    sourceValues: eventSourceValues,
  });

  // 2. Numerical figures dimension
  const articleNumbers = extractNumbers(articleClaimText || claim.text);
  if (articleNumbers.length > 0) {
    const numberSourceValues: SourceValue[] = [];
    const sourceNumberMap = new Map<string, { numbers: string[]; publishedAt?: string | null; evidenceId: string }>();

    for (const [clusterId, items] of evidenceByCluster.entries()) {
      for (const item of items) {
        const found = extractNumbers(item.passage + " " + (item.evidence.title || ""));
        if (found.length > 0) {
          sourceNumberMap.set(clusterId, {
            numbers: found,
            publishedAt: item.evidence.publishedAt,
            evidenceId: item.evidence.id,
          });
          numberSourceValues.push({
            clusterId,
            evidenceId: item.evidence.id,
            value: found.join(", "),
            quote: sanitizeQuote(item.passage.slice(0, 80)),
          });
          break;
        }
      }
    }

    if (numberSourceValues.length > 0) {
      // Check if numbers differ
      const distinctNumbers = new Set(
        Array.from(sourceNumberMap.values()).flatMap((v) => v.numbers)
      );

      // Check if any source differs from article or from each other
      const articleNumSet = new Set(articleNumbers);
      let numbersDiffer = false;
      for (const num of distinctNumbers) {
        if (!articleNumSet.has(num)) {
          numbersDiffer = true;
          break;
        }
      }

      if (numbersDiffer) {
        const articleTextStr = articleClaimText || claim.text;
        const allSourcePassages = numberSourceValues.map((v) => `${v.value} ${v.quote || ""}`).join(" ");

        // Check for range equivalence / partial agreement ("up to five years" vs "two to five years")
        if (areRangesPartiallyAgreeing(articleTextStr, allSourcePassages)) {
          dimensions.push({
            dimension: "numbers",
            outcome: "partial_agreement",
            articleValue: articleNumbers.join(", "),
            sourceValues: numberSourceValues,
            note: "range_partial_agreement",
          });
        }
        // Check for currency conversion equivalence (EUR 20,000 vs INR 21 lakh vs USD 22,500)
        else if (areCurrenciesEquivalent(articleTextStr, allSourcePassages)) {
          dimensions.push({
            dimension: "numbers",
            outcome: "agreement",
            articleValue: articleNumbers.join(", "),
            sourceValues: numberSourceValues,
            note: "currency_equivalent",
          });
        }
        // Check for detail variation (age thresholds 14-17 vs 16+, or small count margins < 20%)
        else {
          let detailVarInfo = isDetailVariation(articleTextStr, allSourcePassages);
          if (!detailVarInfo.isVariation) {
            for (const sv of numberSourceValues) {
              const check =
                isDetailVariation(articleTextStr, sv.value) ||
                isDetailVariation(articleTextStr, sv.quote || "");
              if (check.isVariation) {
                detailVarInfo = check;
                break;
              }
            }
          }

          if (detailVarInfo.isVariation) {
            dimensions.push({
              dimension: "numbers",
              outcome: "detail_variation",
              articleValue: articleNumbers.join(", "),
              sourceValues: numberSourceValues,
              note: detailVarInfo.reason,
            });
            conflicts.push({
              dimension: "numbers",
              description:
                detailVarInfo.reason ||
                `Detail variation: article reported ${articleNumbers.join(", ")} vs ${Array.from(distinctNumbers).join(", ")}`,
              evidenceIds: numberSourceValues.map((v) => v.evidenceId),
              conflictType: "detail_variation",
            });
          } else {
            // Check if publication timestamps differ (developing story / possible update)
            const timestamps = Array.from(sourceNumberMap.values())
              .map((v) => v.publishedAt)
              .filter(Boolean) as string[];

            const uniqueTimestamps = new Set(timestamps);
            const hasDifferingDates = uniqueTimestamps.size > 1;

            if (hasDifferingDates) {
              dimensions.push({
                dimension: "numbers",
                outcome: "partial_agreement",
                articleValue: articleNumbers.join(", "),
                sourceValues: numberSourceValues,
                note: "possible_update",
              });
            } else {
              dimensions.push({
                dimension: "numbers",
                outcome: "contradiction",
                articleValue: articleNumbers.join(", "),
                sourceValues: numberSourceValues,
                note: "Conflicting figures reported across publications",
              });
              conflicts.push({
                dimension: "numbers",
                description: `Conflicting figures: article reported ${articleNumbers.join(", ")} vs ${Array.from(distinctNumbers).join(", ")}`,
                evidenceIds: numberSourceValues.map((v) => v.evidenceId),
                conflictType: "contradiction",
              });
            }
          }
        }
      } else {
        dimensions.push({
          dimension: "numbers",
          outcome: "agreement",
          articleValue: articleNumbers.join(", "),
          sourceValues: numberSourceValues,
        });
      }
    } else {
      dimensions.push({
        dimension: "numbers",
        outcome: "unsupported_detail",
        articleValue: articleNumbers.join(", "),
        sourceValues: [],
        note: "Numbers cited in article not found in independent sources",
      });
    }
  }

  // 3. Direct Quotations dimension
  const articleQuotes = extractQuotes(articleClaimText || claim.text);
  if (articleQuotes.length > 0) {
    const quoteSourceValues: SourceValue[] = [];
    for (const [clusterId, items] of evidenceByCluster.entries()) {
      for (const item of items) {
        const passageLower = item.passage.toLowerCase();
        const found = articleQuotes.find((q) =>
          passageLower.includes(q.toLowerCase().slice(0, 20))
        );
        if (found) {
          quoteSourceValues.push({
            clusterId,
            evidenceId: item.evidence.id,
            value: found,
            quote: sanitizeQuote(found),
          });
          break;
        }
      }
    }

    if (quoteSourceValues.length > 0) {
      dimensions.push({
        dimension: "quotations",
        outcome: "agreement",
        articleValue: articleQuotes[0],
        sourceValues: quoteSourceValues,
      });
    } else {
      dimensions.push({
        dimension: "quotations",
        outcome: "unsupported_detail",
        articleValue: articleQuotes[0],
        sourceValues: [],
        note: "Direct quote not corroborated across other outlets",
      });
    }
  }

  return { dimensions, conflicts };
}

/**
 * Validates, filters, and sanitizes dimensional comparison output.
 * - Drops hallucinated evidenceIds and clusterIds not in supplied input
 * - Enforces max 15 words per quote
 * - Resolves differing numbers across publication dates to possible_update
 * - Strips dimensions with empty sourceValues (except unsupported_detail)
 */
export function validateComparisonOutput(
  raw: LlmDimensionalComparison,
  validEvidenceIds: Set<string>,
  validClusterIds: Set<string>,
  evidenceMap: Map<string, Evidence>
): {
  dimensions: ComparisonDimensionResult[];
  conflicts: ComparisonConflict[];
  validationMetrics: {
    droppedEvidenceIds: string[];
    droppedClusterIds: string[];
    truncatedQuotesCount: number;
    strippedDimensionsCount: number;
  };
} {
  const droppedEvidenceIds: string[] = [];
  const droppedClusterIds: string[] = [];
  let truncatedQuotesCount = 0;
  let strippedDimensionsCount = 0;

  const sanitizedDimensions: ComparisonDimensionResult[] = [];
  const sanitizedConflicts: ComparisonConflict[] = [];

  for (const dim of raw.dimensions) {
    const validSourceValues: SourceValue[] = [];

    for (const sv of dim.sourceValues) {
      if (!validEvidenceIds.has(sv.evidenceId)) {
        droppedEvidenceIds.push(sv.evidenceId);
        continue;
      }
      if (!validClusterIds.has(sv.clusterId)) {
        droppedClusterIds.push(sv.clusterId);
        continue;
      }

      let quote = sv.quote;
      if (quote) {
        const words = quote.trim().split(/\s+/).filter(Boolean);
        if (words.length > 15) {
          truncatedQuotesCount++;
          quote = words.slice(0, 15).join(" ");
        }
      }

      validSourceValues.push({
        clusterId: sv.clusterId,
        evidenceId: sv.evidenceId,
        value: sv.value,
        quote: quote ? quote.trim() : undefined,
      });
    }

    // Defense: strip any dimension where sourceValues is empty, unless unsupported_detail
    if (validSourceValues.length === 0 && dim.outcome !== "unsupported_detail") {
      strippedDimensionsCount++;
      continue;
    }

    // Defense: differing numbers across publication dates flagged as possible_update, not contradiction
    let outcome: ComparisonOutcome = dim.outcome;
    let note = dim.note;

    if (dim.dimension === "numbers" && (outcome === "contradiction" || outcome === "partial_agreement")) {
      const dates = validSourceValues
        .map((sv) => evidenceMap.get(sv.evidenceId)?.publishedAt)
        .filter(Boolean) as string[];

      const uniqueDates = new Set(dates);
      if (uniqueDates.size > 1) {
        outcome = "partial_agreement";
        note = "possible_update";
      }
    }

    sanitizedDimensions.push({
      dimension: dim.dimension,
      outcome,
      articleValue: dim.articleValue,
      sourceValues: validSourceValues,
      note,
    });
  }

  // Sanitize conflicts: exclude any conflict resolved to possible_update, and strip conflicts from related_background or different_event
  for (const conflict of raw.conflicts) {
    const relatedDim = sanitizedDimensions.find(
      (d) => d.dimension === conflict.dimension
    );

    if (relatedDim?.note === "possible_update" || relatedDim?.outcome === "partial_agreement") {
      continue;
    }

    const validIds = conflict.evidenceIds.filter((id) => {
      if (!validEvidenceIds.has(id)) return false;
      const ev = evidenceMap.get(id);
      if (ev?.eventMatch === "different_event" || ev?.eventMatch === "related_background") {
        return false;
      }
      return true;
    });

    if (validIds.length > 0) {
      sanitizedConflicts.push({
        dimension: conflict.dimension,
        description: conflict.description,
        evidenceIds: validIds,
        conflictType:
          conflict.conflictType ||
          (relatedDim?.outcome === "detail_variation" ? "detail_variation" : "contradiction"),
      });
    }
  }

  return {
    dimensions: sanitizedDimensions,
    conflicts: sanitizedConflicts,
    validationMetrics: {
      droppedEvidenceIds,
      droppedClusterIds,
      truncatedQuotesCount,
      strippedDimensionsCount,
    },
  };
}

/**
 * Concurrency helper: processes items with bounded parallelism.
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Compares claims across independent source clusters (Prompt 10 Cross-Source Comparison Engine).
 *
 * Runs in shadow mode without affecting overallTrustScore or verdicts.
 */
export async function compareClaimsAcrossClusters(
  claims: ClaimInput[],
  evidence: Evidence[],
  clusters?: OriginCluster[],
  options?: CompareClaimsOptions
): Promise<ComparisonReport> {
  const config = options?.config || DEFAULT_COMPARISON_CONFIG;

  // 1. Source Independence Clustering
  const originClusters = clusters || clusterEvidenceIndependence(evidence, config);
  traceStage("comparison_clustering", {
    clusterCount: originClusters.length,
    clusters: originClusters.map((c) => ({
      clusterId: c.clusterId,
      originType: c.originType,
      confidence: c.independenceConfidence,
      memberCount: c.memberEvidenceIds.length,
    })),
  });

  // Map evidenceId -> clusterId
  const evidenceToClusterMap = new Map<string, string>();
  for (const cluster of originClusters) {
    for (const evId of cluster.memberEvidenceIds) {
      evidenceToClusterMap.set(evId, cluster.clusterId);
    }
  }

  // Filter out failed, blocked, timeout, or empty evidence items
  const usableEvidence = evidence.filter(isUsableEvidence);
  const hasEstablishedFact = claims.some((c) => c.claimKind === "established_fact");
  // Tag usable evidence with event matching (14-day window default, skipped for established facts)
  const taggedEvidence = tagEvidenceWithEventMatch(
    usableEvidence,
    {
      title: options?.articleText ? options.articleText.slice(0, 100) : undefined,
      contentExcerpt: options?.articleText ? options.articleText.slice(0, 500) : undefined,
    },
    {
      isEstablishedFact: hasEstablishedFact,
    }
  );
  const evidenceMap = new Map(taggedEvidence.map((e) => [e.id, e]));

  // Ensure each usable evidence has a cluster mapping
  for (const ev of taggedEvidence) {
    if (!evidenceToClusterMap.has(ev.id)) {
      evidenceToClusterMap.set(ev.id, `cluster-${ev.id}`);
    }
  }

  const validClusterIds = new Set(originClusters.map((c) => c.clusterId));
  for (const cId of evidenceToClusterMap.values()) {
    validClusterIds.add(cId);
  }

  // 2. Select claims for comparison (high & medium importance, capped at maxComparisonClaims)
  let candidateClaims = claims.filter(
    (c) => c.importance === "high" || c.importance === "medium"
  );
  if (candidateClaims.length === 0) {
    candidateClaims = claims;
  }
  const claimsToCompare = candidateClaims.slice(0, config.maxComparisonClaims);

  // 3. Compare each claim across clusters with bounded concurrency
  const claimResults = await mapConcurrent(
    claimsToCompare,
    config.concurrency,
    async (claim) => {
      // Find usable evidence relevant to this claim, excluding different_event
      const hasClaimIds = taggedEvidence.some((e) => Boolean(e.claimId));
      const activeEvidence = (hasClaimIds
        ? taggedEvidence.filter((e) => e.claimId === claim.id)
        : taggedEvidence
      ).filter((e) => e.eventMatch !== "different_event");

      const validEvidenceIds = new Set(activeEvidence.map((e) => e.id));

      // Group passages by cluster
      const evidenceByCluster = new Map<string, Array<{ evidence: Evidence; passage: string }>>();
      for (const ev of activeEvidence) {
        const cId = evidenceToClusterMap.get(ev.id) || `cluster-${ev.id}`;
        if (!evidenceByCluster.has(cId)) {
          evidenceByCluster.set(cId, []);
        }
        const passage = (ev.sourceContentExcerpt || ev.snippet || "").trim();
        evidenceByCluster.get(cId)!.push({ evidence: ev, passage });
      }

      // Independent clusters count for this claim (excluding social platforms & aggregators)
      const independentClusterCount = Array.from(evidenceByCluster.keys()).filter((cId) => {
        const cluster = originClusters.find((c) => c.clusterId === cId);
        if (cluster) {
          return cluster.originType !== "social_reference" && !isSocialOrAggregator(cluster.primaryDomain);
        }
        const memberEvs = evidenceByCluster.get(cId) || [];
        return !memberEvs.every((m) => isSocialOrAggregator(m.evidence.domain));
      }).length;

      // Prepare LLM / custom comparator input
      const articleClaimText = claim.text;
      let rawComparison: LlmDimensionalComparison;
      let fallbackUsed = false;

      traceStage("comparison_input", {
        claimId: claim.id,
        claimText: claim.text,
        clusterCount: independentClusterCount,
      });

      if (options?.customComparator) {
        rawComparison = await options.customComparator(
          claim,
          articleClaimText,
          evidenceByCluster,
          originClusters
        );
      } else {
        const model = getComparisonModel();
        if (!model) {
          rawComparison = deterministicCompareClaim(
            claim,
            articleClaimText,
            evidenceByCluster,
            originClusters
          );
          fallbackUsed = true;
        } else {
          try {
            const clusterSummaries = Array.from(evidenceByCluster.entries()).map(
              ([cId, items]) => ({
                clusterId: cId,
                evidenceItems: items.map((i) => ({
                  evidenceId: i.evidence.id,
                  domain: i.evidence.domain,
                  title: i.evidence.title,
                  publishedAt: i.evidence.publishedAt,
                  passage: i.passage.slice(0, 500),
                })),
              })
            );

            const result = await generateObject({
              model,
              schema: LlmDimensionalComparisonSchema,
              system: COMPARISON_SYSTEM_INSTRUCTION,
              prompt: `Compare this claim against evidence across independent clusters:\nClaim: "${claim.text}"\n\nClusters:\n${JSON.stringify(clusterSummaries, null, 2)}`,
              temperature: 0.0,
            });

            rawComparison = result.object;
          } catch (err) {
            rawComparison = deterministicCompareClaim(
              claim,
              articleClaimText,
              evidenceByCluster,
              originClusters
            );
            fallbackUsed = true;
          }
        }
      }

      traceStage("comparison_output", {
        claimId: claim.id,
        fallbackUsed,
        dimensionsCount: rawComparison.dimensions.length,
        conflictsCount: rawComparison.conflicts.length,
      });

      // 4. Output Validation & Sanitation
      const { dimensions, conflicts, validationMetrics } = validateComparisonOutput(
        rawComparison,
        validEvidenceIds,
        validClusterIds,
        evidenceMap
      );

      traceStage("comparison_validation", {
        claimId: claim.id,
        ...validationMetrics,
      });

      // 5. Deterministic agreementSummary calculation
      const agreementSummary = computeAgreementSummary(
        independentClusterCount,
        conflicts,
        dimensions,
        config
      );

      const claimResult: ClaimComparisonResult = {
        claimId: claim.id,
        dimensions,
        independentClusterCount,
        agreementSummary,
        conflicts,
      };

      return claimResult;
    }
  );

  // 4. Top-level Comparison Report (excluding social platforms & aggregators from independent outlet count)
  const totalIndependentClusters = originClusters.filter(
    (c) => c.originType !== "social_reference" && !isSocialOrAggregator(c.primaryDomain)
  ).length;
  const totalConflicts = claimResults.reduce((acc, c) => acc + c.conflicts.length, 0);
  const totalUnresolvedDimensions = claimResults.reduce(
    (acc, c) => acc + c.dimensions.filter((d) => d.outcome === "unresolved").length,
    0
  );
  const coverageLimited = totalIndependentClusters < 2;

  return {
    claims: claimResults,
    totalIndependentClusters,
    totalConflicts,
    totalUnresolvedDimensions,
    coverageLimited,
  };
}
