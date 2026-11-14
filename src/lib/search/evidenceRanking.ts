import {
  EvidenceQuality,
  EvidenceRelevance,
  SourceRelationship,
  SourceType,
} from "@/schemas/evidence";

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE QUALITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base quality mapping by source type.
 *
 * CRITICAL: This is a structural quality signal, NOT a truth score.
 * A "high" quality source can publish inaccurate information.
 * A "low" quality source can contain authentic primary documentation.
 * Phase 5 will weigh this signal appropriately during claim evaluation.
 */
const QUALITY_BY_SOURCE_TYPE: Record<SourceType, EvidenceQuality> = {
  primary_document:   "high",    // Court docs, gazettes, official filings = direct primary evidence
  official:           "high",    // Government/institutional records
  wire:               "high",    // Wire services (Reuters, PTI) typically have direct sourcing
  research:           "high",    // Academic/research publications
  fact_check:         "medium",  // Fact-checkers add analysis but are secondary sources
  international_news: "medium",  // Established international press
  national_news:      "medium",  // Established national press
  regional_news:      "medium",  // Regional publications (varies widely)
  blog:               "low",     // Blogs lack editorial standards by default
  social:             "low",     // Social posts typically lack sourcing
  specialized_trade:  "medium",  // Trade journals and industry reporting
  legal_court:        "high",    // Direct court records
  legal_database:     "high",    // Legal repositories
  other:              "medium",  // Standard indexed publishers treated fairly without bias
};

/**
 * Source relationship adjustment to base quality.
 * Relationship signals can upgrade or downgrade the base quality assessment.
 *
 * IMPORTANT: This reflects SOURCE CHARACTERISTICS only — not veracity.
 */
const QUALITY_ADJUSTMENT_BY_RELATIONSHIP: Record<SourceRelationship, number> = {
  original:           1,   // Being an original source slightly upgrades quality signal
  independent:        0,   // No adjustment (it may still be unreliable independently)
  unknown:            0,   // No adjustment
  cites_other_source: -1,  // Secondary sourcing (citing) is less primary evidence
  syndicated:         -1,  // Republished content is less primary evidence
};

const QUALITY_LEVELS: EvidenceQuality[] = ["unknown", "low", "medium", "high"];

/**
 * Computes observable evidence quality based on source characteristics.
 *
 * This is NOT a truth score. It does NOT determine whether evidence:
 * - supports a claim
 * - contradicts a claim
 * - is factually accurate
 *
 * It reflects the structural quality of the source from an evidential perspective.
 */
export function computeEvidenceQuality(
  sourceType: SourceType,
  sourceRelationship: SourceRelationship
): EvidenceQuality {
  const baseQuality = QUALITY_BY_SOURCE_TYPE[sourceType] ?? "unknown";

  if (baseQuality === "unknown") return "unknown";

  const adjustment = QUALITY_ADJUSTMENT_BY_RELATIONSHIP[sourceRelationship] ?? 0;
  const currentIndex = QUALITY_LEVELS.indexOf(baseQuality);

  if (currentIndex === -1) return "unknown";

  const newIndex = Math.max(1, Math.min(3, currentIndex + adjustment));
  return QUALITY_LEVELS[newIndex];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RELEVANCE
// ─────────────────────────────────────────────────────────────────────────────

const RELEVANCE_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
  "by", "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "of", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "should", "now", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "it", "its", "they", "them", "their"
]);

/**
 * Extracts significant tokens from claim text for relevance matching.
 * Focuses on content words, named entities, numbers, and currency symbols.
 */
function extractSignificantTokens(text: string): string[] {
  const allTokens = text
    .replace(/["""''']/g, "")
    .replace(/[,;:.!?()[\]{}]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2);

  const nonStopTokens = allTokens.filter((t) => !RELEVANCE_STOP_WORDS.has(t));
  return nonStopTokens.length > 0 ? nonStopTokens : allTokens;
}

/**
 * Extracts factual/named tokens (numbers, currencies, capitalized proper nouns)
 * from claim text. These are high-precision relevance signals.
 */
function extractFactualTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(
      (t) =>
        /[0-9₹$€£%]/.test(t) ||   // Numbers, currencies, percentages
        /^[A-Z][a-zA-Z]{1,}/.test(t)  // Proper nouns / capitalized terms
    )
    .map((t) => t.toLowerCase().replace(/[,;:.!?]/g, ""));
}

/**
 * Estimates topical relevance of evidence to a specific atomic claim.
 * Uses keyword/entity overlap between claim text and evidence title+snippet.
 *
 * IMPORTANT: This is a TOPICAL/STRUCTURAL relevance estimate only.
 * "direct" relevance does NOT mean the evidence proves the claim.
 * Phase 5 will determine whether evidence ENTAILS, CONTRADICTS, or QUALIFIES the claim.
 *
 * Classification:
 * - "direct": Strong keyword overlap including specific factual details
 * - "related": Topical overlap but claim-specific details may be absent
 * - "weak": Minimal overlap; loosely related to claim subject
 * - "unknown": Cannot determine relevance from available metadata
 */
export function estimateRelevance(
  claimText: string,
  evidence: { title: string; snippet: string }
): EvidenceRelevance {
  const significantTokens = extractSignificantTokens(claimText);
  const factualTokens = extractFactualTokens(claimText);

  if (significantTokens.length === 0) return "unknown";

  const evidenceText = `${evidence.title} ${evidence.snippet}`.toLowerCase();

  // Count significant token matches
  const significantMatches = significantTokens.filter((t) =>
    evidenceText.includes(t)
  ).length;

  // Count factual token matches (numbers, currency, proper nouns)
  const factualMatches = factualTokens.filter((t) =>
    evidenceText.includes(t)
  ).length;

  const significantRatio = significantMatches / significantTokens.length;

  // Direct relevance: strong overall overlap OR specific factual details present
  const hasSpecificFactuals =
    factualTokens.length > 0 &&
    factualMatches >= Math.min(1, factualTokens.length);

  if (hasSpecificFactuals && significantRatio >= 0.15) return "direct";
  if (significantRatio >= 0.30) return "direct";
  if (significantRatio >= 0.15 || (factualTokens.length > 0 && factualMatches > 0)) return "related";
  if (significantMatches > 0) return "weak";

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING SCORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ranking score components — used to sort evidence in Phase 4.
 * Higher score = ranked first in the output list.
 *
 * Score reflects SOURCE QUALITY and TOPICAL RELEVANCE only.
 * It does NOT reflect veracity, truthfulness, or political alignment.
 *
 * Important caveats:
 * - Search engine position is explicitly NOT used as a scoring signal.
 * - Political orientation is NOT a factor.
 * - "first Google result" is NOT assumed to be most accurate.
 */

const SOURCE_TYPE_SCORE: Record<SourceType, number> = {
  primary_document:   5,
  official:           5,
  wire:               4,
  research:           4,
  fact_check:         4,
  international_news: 3,
  national_news:      3,
  regional_news:      2,
  other:              2,
  specialized_trade:  3,
  legal_court:        5,
  legal_database:     5,
  blog:               1,
  social:             1,
};

const QUALITY_SCORE: Record<EvidenceQuality, number> = {
  high:    4,
  medium:  3,
  low:     1,
  unknown: 0,
};

const RELEVANCE_SCORE: Record<EvidenceRelevance, number> = {
  direct:  3,
  related: 2,
  weak:    1,
  unknown: 0,
};

const RELATIONSHIP_BONUS: Record<SourceRelationship, number> = {
  original:           2,
  independent:        1,
  unknown:            0,
  cites_other_source: -1,
  syndicated:         -2,
};

export interface RankingInput {
  sourceType: SourceType;
  sourceRelationship: SourceRelationship;
  evidenceQuality: EvidenceQuality;
  relevance: EvidenceRelevance;
  publishedAt: string | null;
}

/**
 * Computes a composite ranking score for evidence sorting.
 * Returns a numeric score — higher = ranked earlier in output.
 */
export function computeRankScore(ev: RankingInput): number {
  return (
    SOURCE_TYPE_SCORE[ev.sourceType] +
    QUALITY_SCORE[ev.evidenceQuality] +
    RELEVANCE_SCORE[ev.relevance] +
    RELATIONSHIP_BONUS[ev.sourceRelationship] +
    (ev.publishedAt ? 1 : 0)
  );
}
