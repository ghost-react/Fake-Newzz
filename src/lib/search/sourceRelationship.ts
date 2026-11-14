import { SourceRelationship, SourceType } from "@/schemas/evidence";
import { isSocialOrAggregator } from "../comparison/socialExclusion";

// ─────────────────────────────────────────────────────────────────────────────
// CITATION PHRASES
// Observable textual signals that an article cites an external source.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phrases that strongly suggest an article is citing another source
 * as the basis for its information.
 *
 * All phrase matching is case-insensitive.
 * Only used for observable text signals — NOT to infer veracity.
 */
const CITATION_PHRASES: string[] = [
  // Explicit wire/agency citations
  "according to reuters",
  "according to pti",
  "according to ani",
  "according to afp",
  "according to ap",
  "according to ians",
  "according to bloomberg",
  "according to press trust of india",
  "according to asian news international",
  "as per reuters",
  "as per pti",
  "as per ani",
  "as reported by reuters",
  "as reported by pti",
  "citing reuters",
  "citing pti",
  "citing ani",
  "citing afp",
  "citing ap",
  "quoting reuters",
  "quoting pti",
  // Wire markers
  "(pti)",
  "(ani)",
  "(reuters)",
  "(ap)",
  "(afp)",
  // Generic citation phrases
  "as reported by",
  "according to a statement",
  "according to an official statement",
  "according to official sources",
  "government sources said",
  "official sources told",
  "as per the statement",
  "citing sources",
  "quoting sources",
  "sources told",
  "officials told",
  // Unnamed source signals
  "unnamed source",
  "unnamed sources",
  "condition of anonymity",
  "speaking on condition of anonymity",
  "sources close to",
];

export const WIRE_AGENCIES = [
  { name: "PTI", patterns: ["pti", "press trust of india"] },
  { name: "ANI", patterns: ["ani", "asian news international"] },
  { name: "Reuters", patterns: ["reuters"] },
  { name: "AP", patterns: ["associated press", "ap news", "ap wire"] },
  { name: "AFP", patterns: ["afp", "agence france-presse"] },
  { name: "Bloomberg", patterns: ["bloomberg"] },
  { name: "IANS", patterns: ["ians", "indo-asian news service"] },
];

/**
 * Detects whether an evidence item text cites a known wire service.
 */
export function detectWireAgency(text: string): string | null {
  const lower = text.toLowerCase();
  for (const wire of WIRE_AGENCIES) {
    if (wire.patterns.some((p) => {
      const regex = new RegExp(`(^|\\W)(${p})(\\W|$)`, "i");
      return regex.test(lower);
    })) {
      return wire.name;
    }
  }
  return null;
}

/**
 * Detects whether an evidence item text relies primarily on an unnamed/anonymous source.
 */
export function detectUnnamedSource(text: string): boolean {
  const lower = text.toLowerCase();
  const unnamedSignals = [
    "unnamed source",
    "unnamed sources",
    "unnamed official",
    "condition of anonymity",
    "speaking on condition of anonymity",
    "sources close to",
    "sources familiar with the matter",
  ];
  return unnamedSignals.some((sig) => lower.includes(sig));
}

// Source types whose primary role is original news/document production
const ORIGINAL_SOURCE_TYPES = new Set<SourceType>([
  "official",
  "primary_document",
  "wire",
]);

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceForRelationship {
  id: string;
  title: string;
  snippet: string;
  domain: string;
  url: string;
  sourceType: SourceType;
}

// ─────────────────────────────────────────────────────────────────────────────
// CITATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects whether an evidence item explicitly cites another source
 * using observable textual signals (citation phrases in title/snippet).
 */
export function detectsCitedSource(evidence: EvidenceForRelationship): boolean {
  const text = `${evidence.title} ${evidence.snippet}`.toLowerCase();
  return CITATION_PHRASES.some((phrase) => text.includes(phrase));
}

// ─────────────────────────────────────────────────────────────────────────────
// TITLE/SNIPPET SIMILARITY (Jaccard token coefficient)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes token-level Jaccard similarity between two text strings.
 * Used to detect potential syndication across different domains.
 *
 * Tokens shorter than 3 characters are excluded to reduce noise from
 * common short words.
 */
export function computeJaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9₹$€£%]/g, ""))
        .filter((t) => t.length > 2)
    );

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE RELATIONSHIP ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes the source relationships across a collection of evidence items
 * retrieved for the same claim.
 *
 * Classification logic (in priority order):
 * 1. Citation phrase detection → "cites_other_source"
 * 2. Official/primary/wire source type, no citations → "original"
 * 3. High title similarity between different-domain items → "syndicated" (for lower-priority source)
 * 4. Recognized publication type, no citations, no similar titles → "independent"
 * 5. Insufficient signals → "unknown"
 *
 * IMPORTANT:
 * - "independent" does NOT mean more reliable.
 * - "original" does NOT mean factually correct.
 * - These classifications reflect observable textual signals only.
 * - Do NOT use these to infer political orientation or trustworthiness.
 */
export function analyzeSourceRelationships(
  evidenceList: EvidenceForRelationship[]
): Map<string, SourceRelationship> {
  const relationships = new Map<string, SourceRelationship>();

  if (evidenceList.length === 0) return relationships;

  // ── Pass 1: Per-item standalone analysis ──────────────────────────────────
  for (const ev of evidenceList) {
    // Social and aggregator sources are never independent or original
    if (isSocialOrAggregator(ev.domain) || isSocialOrAggregator(ev.url)) {
      if (detectsCitedSource(ev)) {
        relationships.set(ev.id, "cites_other_source");
      } else {
        relationships.set(ev.id, "unknown");
      }
      continue;
    }

    // Check for explicit citation phrases first
    if (detectsCitedSource(ev)) {
      relationships.set(ev.id, "cites_other_source");
      continue;
    }

    // Official/primary/wire sources without citation phrases → likely original
    if (ORIGINAL_SOURCE_TYPES.has(ev.sourceType)) {
      relationships.set(ev.id, "original");
      continue;
    }

    // Default for single-pass
    relationships.set(ev.id, "unknown");
  }

  // ── Pass 2: Cross-item title and snippet similarity (syndication detection) ──
  for (let i = 0; i < evidenceList.length; i++) {
    for (let j = i + 1; j < evidenceList.length; j++) {
      const a = evidenceList[i];
      const b = evidenceList[j];

      // Skip same-domain pairs (different articles from same publisher are valid)
      if (a.domain === b.domain) continue;

      const titleSim = computeJaccardSimilarity(a.title, b.title);
      const snippetSim =
        a.snippet && b.snippet
          ? computeJaccardSimilarity(a.snippet, b.snippet)
          : 0;

      // High similarity threshold: strong syndication signal
      const likelySyndicated = titleSim > 0.65 || snippetSim > 0.70;

      if (!likelySyndicated) continue;

      const aRel = relationships.get(a.id) || "unknown";
      const bRel = relationships.get(b.id) || "unknown";

      // If one is already "original", the similar-but-different-domain item is syndicated
      if (aRel === "original" && bRel !== "original" && bRel !== "cites_other_source") {
        relationships.set(b.id, "syndicated");
      } else if (bRel === "original" && aRel !== "original" && aRel !== "cites_other_source") {
        relationships.set(a.id, "syndicated");
      }
      // If both are "unknown" we cannot determine which is original — leave as unknown
    }
  }

  // ── Pass 3: Conservative independence detection ────────────────────────────
  // Only mark as "independent" when we have sufficient positive evidence:
  // - No citation phrases detected
  // - No high title similarity with any other evidence item
  // - Recognized publication type (not "other", "blog", "social")
  // - At least 2 evidence items retrieved (comparison is meaningful)
  const recognizedTypes = new Set<SourceType>([
    "wire", "national_news", "international_news", "regional_news",
    "fact_check", "research", "official",
  ]);

  if (evidenceList.length >= 2) {
    for (const ev of evidenceList) {
      if (isSocialOrAggregator(ev.domain) || isSocialOrAggregator(ev.url)) continue;
      const current = relationships.get(ev.id);
      if (current !== "unknown") continue;
      if (!recognizedTypes.has(ev.sourceType)) continue;

      // Verify no high similarity with any other item (regardless of domain)
      const noSimilarItems = evidenceList.every((other) => {
        if (other.id === ev.id) return true;
        return computeJaccardSimilarity(ev.title, other.title) <= 0.50;
      });

      if (noSimilarItems) {
        relationships.set(ev.id, "independent");
      }
    }
  }

  return relationships;
}

/**
 * Returns a single SourceRelationship for one evidence item in isolation.
 * Used when only one evidence item is available for a claim.
 */
export function classifySingleSourceRelationship(
  evidence: EvidenceForRelationship
): SourceRelationship {
  const result = analyzeSourceRelationships([evidence]);
  return result.get(evidence.id) || "unknown";
}
