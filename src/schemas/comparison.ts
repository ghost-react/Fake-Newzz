import { z } from "zod";

/**
 * Legacy Finding classification for cross-source comparison.
 */
export const ComparisonFindingTypeSchema = z.enum([
  "agreement",
  "partial_agreement",
  "contradiction",
  "additional_context",
  "unsupported_detail",
  "unresolved_information",
  "detail_variation",
]);
export type ComparisonFindingType = z.infer<typeof ComparisonFindingTypeSchema>;

/**
 * Legacy Factual dimension evaluated across multiple sources.
 */
export const LegacyComparisonDimensionSchema = z.enum([
  "event_description",
  "names_identities",
  "dates_timelines",
  "locations",
  "numerical_figures",
  "direct_quotations",
  "official_statements",
  "allegations_vs_facts",
  "reported_outcomes",
  "qualifications_context",
]);
export type LegacyComparisonDimension = z.infer<typeof LegacyComparisonDimensionSchema>;

/**
 * Information on an individual cited source in cross-source comparison.
 */
export const CitedSourceInfoSchema = z.object({
  title: z.string(),
  domain: z.string(),
  url: z.string(),
  sourceType: z.string().optional(),
  relationship: z.string(), // independent, original, syndicated, cites_other_source, unknown
  stance: z.enum(["agrees", "conflicts", "neutral", "qualifies"]).optional(),
});
export type CitedSourceInfo = z.infer<typeof CitedSourceInfoSchema>;

/**
 * Legacy cross-source comparison record for an individual factual claim.
 */
export const ClaimComparisonSchema = z.object({
  claimId: z.string(),
  claimText: z.string(),
  findingType: ComparisonFindingTypeSchema,
  dimension: LegacyComparisonDimensionSchema,
  summary: z.string(),
  agreedPoints: z.array(z.string()),
  conflictingPoints: z.array(z.string()),
  unresolvedPoints: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  independentSourcesCount: z.number().int().nonnegative(),
  syndicatedSourcesCount: z.number().int().nonnegative(),
  sources: z.array(CitedSourceInfoSchema),
});
export type ClaimComparison = z.infer<typeof ClaimComparisonSchema>;

/**
 * Metadata for a publication examined during verification.
 */
export const PublicationExaminedSchema = z.object({
  domain: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  sourceType: z.string(),
  relationship: z.string(),
  isIndependent: z.boolean(),
  isWireSyndicated: z.boolean(),
});
export type PublicationExamined = z.infer<typeof PublicationExaminedSchema>;

/**
 * Overall Cross-Source Comparison Report structure (legacy).
 */
export const CrossSourceComparisonSchema = z.object({
  originalPublisher: z.string(),
  totalPublicationsExamined: z.number().int().nonnegative(),
  independentSourcesCount: z.number().int().nonnegative(),
  syndicatedSourcesCount: z.number().int().nonnegative(),
  wireAgenciesDetected: z.array(z.string()),
  publications: z.array(PublicationExaminedSchema),
  claimsCompared: z.array(ClaimComparisonSchema),
  claimsAgreedCount: z.number().int().nonnegative(),
  claimsConflictingCount: z.number().int().nonnegative(),
  claimsUnresolvedCount: z.number().int().nonnegative(),
  hasNumericalConflict: z.boolean(),
  hasDirectQuoteConflict: z.boolean(),
  summary: z.string(),
});
export type CrossSourceComparison = z.infer<typeof CrossSourceComparisonSchema>;

/**
 * Transparent explanation of score dimensions grounded in actual report data.
 */
export const TransparentScoreExplanationSchema = z.object({
  claimSupportExplanation: z.string(),
  crossSourceAgreementExplanation: z.string(),
  contradictingEvidenceExplanation: z.string(),
  sourceIndependenceExplanation: z.string(),
  missingContextExplanation: z.string(),
  unresolvedInformationExplanation: z.string(),
  hundredScoreJustification: z.string().optional(),
});
export type TransparentScoreExplanation = z.infer<typeof TransparentScoreExplanationSchema>;

/* =========================================================================
 * NEW Cross-Source Comparison Engine Schemas (Prompt 10)
 * ========================================================================= */

/**
 * Dimensional evaluation dimensions for cross-source comparison.
 */
export const ComparisonDimensionSchema = z.enum([
  "event",
  "names",
  "date",
  "location",
  "numbers",
  "quotations",
  "official_statements",
  "allegations",
  "context",
]);
export type ComparisonDimension = z.infer<typeof ComparisonDimensionSchema>;

/**
 * Outcome of comparing a dimension across independent clusters.
 */
export const ComparisonOutcomeSchema = z.enum([
  "agreement",
  "partial_agreement",
  "contradiction",
  "additional_context",
  "unsupported_detail",
  "unresolved",
  "unconfirmed_variation",
  "denial",
  "detail_variation",
]);
export type ComparisonOutcome = z.infer<typeof ComparisonOutcomeSchema>;

/**
 * Source value reported by a specific cluster / evidence item for a dimension.
 */
export const SourceValueSchema = z.object({
  clusterId: z.string(),
  evidenceId: z.string(),
  value: z.string(),
  quote: z
    .string()
    .refine(
      (q) => !q || q.trim().split(/\s+/).filter(Boolean).length <= 15,
      { message: "quote must be at most 15 words" }
    )
    .optional(),
});
export type SourceValue = z.infer<typeof SourceValueSchema>;

/**
 * Result of comparing a single dimension across sources.
 */
export const ComparisonDimensionResultSchema = z.object({
  dimension: ComparisonDimensionSchema,
  outcome: ComparisonOutcomeSchema,
  articleValue: z.string(),
  sourceValues: z.array(SourceValueSchema),
  note: z.string().optional(),
});
export type ComparisonDimensionResult = z.infer<typeof ComparisonDimensionResultSchema>;

/**
 * Conflict identified across sources for a dimension.
 */
export const ComparisonConflictSchema = z.object({
  dimension: ComparisonDimensionSchema,
  description: z.string(),
  evidenceIds: z.array(z.string()),
  conflictType: z.enum(["contradiction", "unconfirmed_variation", "denial", "detail_variation"]).optional(),
});
export type ComparisonConflict = z.infer<typeof ComparisonConflictSchema>;

/**
 * Agreement summary classification for a claim.
 */
export const AgreementSummarySchema = z.enum(["strong", "moderate", "weak", "none"]);
export type AgreementSummary = z.infer<typeof AgreementSummarySchema>;

/**
 * Structured cross-source comparison result for a single claim.
 */
export const ClaimComparisonResultSchema = z.object({
  claimId: z.string(),
  dimensions: z.array(ComparisonDimensionResultSchema),
  independentClusterCount: z.number().int().nonnegative(),
  agreementSummary: AgreementSummarySchema,
  conflicts: z.array(ComparisonConflictSchema),
});
export type ClaimComparisonResult = z.infer<typeof ClaimComparisonResultSchema>;

/**
 * Top-level Cross-Source Comparison Report structure.
 */
export const ComparisonReportSchema = z.object({
  claims: z.array(ClaimComparisonResultSchema),
  totalIndependentClusters: z.number().int().nonnegative(),
  totalConflicts: z.number().int().nonnegative(),
  totalUnresolvedDimensions: z.number().int().nonnegative(),
  coverageLimited: z.boolean(), // true if fewer than 2 independent clusters available
});
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;
