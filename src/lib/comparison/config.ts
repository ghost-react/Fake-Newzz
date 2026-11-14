/**
 * Configuration for Cross-Source Independence Clustering and Comparison Engine.
 */

export interface ComparisonConfig {
  /**
   * Known news agencies and wire services to detect in text, bylines, or snippets.
   */
  wireAgencies: Array<{
    id: string;
    name: string;
    patterns: RegExp[];
  }>;

  /**
   * Phrases indicating that one outlet explicitly cites another outlet.
   */
  citationPhrases: RegExp[];

  /**
   * Word shingle size (N-grams) for Jaccard similarity comparison.
   */
  shingleSize: number;

  /**
   * Minimum Jaccard similarity threshold on 5-word shingles to cluster near-duplicate reporting.
   */
  jaccardThreshold: number;

  /**
   * Thresholds for deterministic agreementSummary computation.
   */
  agreementThresholds: {
    minClustersForStrong: number;
    minClustersForModerate: number;
    minClustersForWeak: number;
  };

  /**
   * Maximum claims to submit to dimensional comparison per verification run.
   */
  maxComparisonClaims: number;

  /**
   * Maximum concurrent comparisons.
   */
  concurrency: number;
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  wireAgencies: [
    {
      id: "pti",
      name: "Press Trust of India",
      patterns: [/\bpti\b/i, /\bpress trust of india\b/i],
    },
    {
      id: "ani",
      name: "Asian News International",
      patterns: [/\bani\b/i, /\basian news international\b/i],
    },
    {
      id: "ians",
      name: "Indo-Asian News Service",
      patterns: [/\bians\b/i, /\bindo-asian news service\b/i],
    },
    {
      id: "reuters",
      name: "Reuters",
      patterns: [/\breuters\b/i],
    },
    {
      id: "ap",
      name: "Associated Press",
      patterns: [/\bap\b/i, /\bassociated press\b/i],
    },
    {
      id: "afp",
      name: "Agence France-Presse",
      patterns: [/\bafp\b/i, /\bagence france-presse\b/i, /\bagence france presse\b/i],
    },
    {
      id: "bloomberg",
      name: "Bloomberg",
      patterns: [/\bbloomberg\b/i, /\bbloomberg news\b/i],
    },
    {
      id: "uni",
      name: "United News of India",
      patterns: [/\buni\b/i, /\bunited news of india\b/i],
    },
  ],

  citationPhrases: [
    /\baccording to\s+([a-z0-9.-]+)/i,
    /\bas reported by\s+([a-z0-9.-]+)/i,
    /\breported by\s+([a-z0-9.-]+)/i,
    /\bciting\s+([a-z0-9.-]+)/i,
    /\bquotes\s+([a-z0-9.-]+)/i,
    /\bquoting\s+([a-z0-9.-]+)/i,
    /\btold\s+([a-z0-9.-]+)/i,
  ],

  shingleSize: 5,
  jaccardThreshold: 0.6,

  agreementThresholds: {
    minClustersForStrong: 3,
    minClustersForModerate: 2,
    minClustersForWeak: 1,
  },

  maxComparisonClaims: 8,
  concurrency: 4,
};

/**
 * Feature flag: whether the cross-source comparison engine runs in verification.
 * Enabled by default in dev/test, can be toggled via COMPARISON_ENABLED=false.
 */
export function isComparisonEnabled(): boolean {
  if (process.env.COMPARISON_ENABLED === "false") {
    return false;
  }
  return true;
}

