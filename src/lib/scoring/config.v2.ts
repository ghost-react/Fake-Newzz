import { Verdict, Confidence } from "@/schemas/evaluation";
import { VerificationConfidence } from "@/schemas/verification";
import { ComparisonDimension } from "@/schemas/comparison";

export type ScoringV2Mode = "off" | "shadow" | "on";

/**
 * Returns the current scoring v2 mode from environment.
 * Default is "off".
 */
export function getScoringV2Mode(): ScoringV2Mode {
  const mode = process.env.SCORING_V2?.toLowerCase().trim();
  if (mode === "on" || mode === "shadow") {
    return mode;
  }
  return "off";
}

export interface ScoringV2Config {
  /** Base importance multipliers for claims */
  importanceWeights: Record<string, number>;

  /** Base values for evaluated verdicts */
  verdictBaseValues: Record<Verdict, number>;

  /** Evaluator confidence multipliers */
  confidenceMultipliers: Record<Confidence, number>;

  /** Corroboration multiplier table based on independent cluster count */
  corroborationMultipliers: {
    zero: number;
    one: number;
    two: number;
    threePlus: number;
  };

  /** Confidence discounts for clusters with originType 'unknown' */
  unknownOriginConfidenceMultipliers: Record<string, number>;

  /** Material dimensions that trigger conflict adjustments and unresolved detail penalties */
  materialDimensions: ComparisonDimension[];

  /** Multiplier applied to claim positive contribution when a material conflict is detected */
  materialConflictReductionFactor: number;

  /** Maximum confidence allowed when evidence is snippet-only */
  snippetOnlyMaxConfidence: Confidence;

  /** Penalties for unresolved or unsupported material details by claim importance */
  unresolvedDetailPenalties: Record<string, number>;

  /** Maximum cumulative penalty for unresolved / unsupported details */
  maxUnresolvedDetailPenalty: number;

  /** Base penalties for evidence-backed omissions by severity */
  omissionBasePenalties: Record<string, number>;

  /** Confidence multipliers for omissions */
  omissionConfidenceMultipliers: Record<string, number>;

  /** Maximum cumulative context omission penalty */
  maxOmissionPenalty: number;

  /** Overall confidence adjustments */
  confidenceAdjustments: Record<VerificationConfidence, number>;

  /** Neutral baseline score when claims are unverified or neutral */
  neutralBaseline: number;

  /** Maximum score allowed when 100/100 gate conditions fail */
  gateFailureMaxScore: number;

  /** Independence confidence weights for consensus agreement calculation */
  consistencyIndependenceWeights: Record<string, number>;

  /** Multipliers applied to v2 score based on article-level consistency score */
  consistencyMultipliers: {
    high: number;
    moderate: number;
    low: number;
    veryLow: number;
  };

  /** Consistency score tier thresholds */
  consistencyThresholds: {
    high: number;
    moderate: number;
    low: number;
  };

  /** Base penalty per extra distinct version beyond the first (versionCount - 1) */
  baseExtraVersionPenalty: number;

  /** Multipliers for version penalties per dimension */
  dimensionVersionMultipliers: Record<ComparisonDimension, number>;

  /** Multipliers for version penalties per claim importance */
  importanceVersionMultipliers: Record<string, number>;

  /** Consistency threshold below which verdict is capped at 'mixed' */
  consistencyLowVerdictCapThreshold: number;

  /** Maximum score allowed when version variation exists on material dimensions */
  maxScoreWithVariation: number;

  /** Minimum independent clusters required for consistency to be assessable */
  minClustersForAssessable: number;

  /** Minimum clusters required to satisfy the core-event gate */
  coreEventGateMinClusters: number;

  /** Minimum verdict when the core-event gate passes and no contradictions exist */
  coreEventGateMinVerdict: string;

  /** Multiplier for clusters containing official / primary source evidence on core claims */
  officialPrimarySourceClusterMultiplier: number;

  /** Temporal window in days to consider an evidence item as same_event */
  eventDateWindowDays: number;
}

export const DEFAULT_SCORING_V2_CONFIG: ScoringV2Config = {
  importanceWeights: {
    high: 3.0,
    medium: 2.0,
    low: 1.0,
  },

  verdictBaseValues: {
    supporting: 1.0,
    qualifying: 0.25,
    insufficient: 0.0,
    contradicting: -1.0,
  },

  confidenceMultipliers: {
    high: 1.0,
    medium: 0.75,
    low: 0.5,
  },

  corroborationMultipliers: {
    zero: 0.8,
    one: 1.0,
    two: 1.25,
    threePlus: 1.5,
  },

  unknownOriginConfidenceMultipliers: {
    high: 1.0,
    medium: 0.75,
    low: 0.5,
  },

  materialDimensions: [
    "event",
    "names",
    "date",
    "location",
    "numbers",
    "quotations",
    "official_statements",
  ],

  materialConflictReductionFactor: 0.5,

  snippetOnlyMaxConfidence: "medium",

  unresolvedDetailPenalties: {
    high: 6,
    medium: 3,
    low: 1,
  },

  maxUnresolvedDetailPenalty: 15,

  omissionBasePenalties: {
    high: 15,
    medium: 8,
    low: 3,
  },

  omissionConfidenceMultipliers: {
    high: 1.0,
    medium: 0.75,
    low: 0.5,
  },

  maxOmissionPenalty: 25,

  confidenceAdjustments: {
    high: 0,
    medium: -3,
    low: -7,
  },

  neutralBaseline: 50,

  gateFailureMaxScore: 95,

  consistencyIndependenceWeights: {
    high: 1.0,
    medium: 0.75,
    low: 0.5,
  },

  consistencyMultipliers: {
    high: 1.0,
    moderate: 0.9,
    low: 0.75,
    veryLow: 0.6,
  },

  consistencyThresholds: {
    high: 85,
    moderate: 65,
    low: 45,
  },

  baseExtraVersionPenalty: 12,

  dimensionVersionMultipliers: {
    numbers: 1.5,
    names: 1.25,
    date: 1.25,
    quotations: 1.25,
    event: 1.0,
    official_statements: 1.0,
    location: 1.0,
    allegations: 0.0,
    context: 0.5,
  },

  importanceVersionMultipliers: {
    high: 1.5,
    medium: 1.0,
    low: 0.5,
  },

  consistencyLowVerdictCapThreshold: 65,

  maxScoreWithVariation: 95,

  minClustersForAssessable: 2,

  coreEventGateMinClusters: 2,

  coreEventGateMinVerdict: "mostly_true",

  officialPrimarySourceClusterMultiplier: 1.25,

  eventDateWindowDays: 14,
};

