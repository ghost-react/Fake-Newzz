import { z } from "zod";
import { ClaimEvaluationSchema } from "./evaluation";
import { OmissionSchema } from "./omission";
import {
  CrossSourceComparisonSchema,
  CrossSourceComparison,
  TransparentScoreExplanationSchema,
  TransparentScoreExplanation,
  ComparisonReportSchema,
  ComparisonReport,
} from "./comparison";

export * from "./comparison";

/**
 * Strict veracity verdict enum for article-wide determination:
 * - verified_true: Important claims strongly supported, no material contradictions or high-severity omissions.
 * - mostly_true: Important claims generally supported with minor errors or qualifications.
 * - mixed: Important claims contain meaningful support and contradiction without a clear dominant conclusion.
 * - misleading: Claims may be technically based on evidence but important omissions/qualifications materially distort interpretation.
 * - mostly_false: Major claims are predominantly contradicted but some peripheral claims are supported.
 * - false: High-importance central claim strongly contradicted with high confidence.
 * - unverified: Evidence cannot establish important claims (insufficient evidence != false).
 */
export const VeracityVerdictSchema = z.enum([
  "verified_true",
  "mostly_true",
  "mixed",
  "misleading",
  "mostly_false",
  "false",
  "unverified",
  "could_not_read",
]);
export type VeracityVerdict = z.infer<typeof VeracityVerdictSchema>;

/**
 * Overall verification confidence:
 * - high: Most important claims have high/medium confidence and no unresolved major conflicts.
 * - medium: Some important claims have medium/low confidence or evidence is incomplete.
 * - low: Major claims are insufficient, evidence is sparse, or strong conflicting evidence remains unresolved.
 */
export const VerificationConfidenceSchema = z.enum(["high", "medium", "low"]);
export type VerificationConfidence = z.infer<typeof VerificationConfidenceSchema>;

/**
 * Summary breakdown of claim evaluations by verdict.
 */
export const ClaimSummarySchema = z
  .object({
    total: z.number().int().nonnegative({ message: "Total claims must be non-negative" }),
    supporting: z.number().int().nonnegative({ message: "Supporting claims must be non-negative" }),
    contradicting: z.number().int().nonnegative({ message: "Contradicting claims must be non-negative" }),
    qualifying: z.number().int().nonnegative({ message: "Qualifying claims must be non-negative" }),
    insufficient: z.number().int().nonnegative({ message: "Insufficient claims must be non-negative" }),
  })
  .strict();
export type ClaimSummary = z.infer<typeof ClaimSummarySchema>;

/**
 * Explainable score breakdown calculated deterministically.
 */
export const ScoreBreakdownSchema = z
  .object({
    claimScore: z.number().min(0).max(100, { message: "Claim score must be between 0 and 100" }),
    contextPenalty: z.number().min(0).max(25, { message: "Context penalty is capped at 25" }),
    confidenceAdjustment: z.number(),
    finalScore: z.number().int().min(0).max(100, { message: "Final score must be an integer between 0 and 100" }),
  })
  .strict();
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

/**
 * Machine-readable factor contributing to v2 score calculation.
 */
export const ScoreFactorV2Schema = z.object({
  code: z.string(),
  effect: z.number(),
  claimId: z.string().optional(),
  dimension: z.string().optional(),
  layer: z.string().optional(),
  clusterCount: z.number().optional(),
  officialSourcePresent: z.boolean().optional(),
  note: z.string().optional(),
});
export type ScoreFactorV2 = z.infer<typeof ScoreFactorV2Schema>;

/**
 * Detailed v2 score breakdown listing every factor moving the score.
 */
export const ScoreBreakdownV2Schema = z.object({
  claimContributions: z.number(),
  conflictAdjustments: z.number(),
  unresolvedDetailPenalty: z.number(),
  omissionPenalty: z.number(),
  confidenceAdjustment: z.number(),
  finalScore: z.number(),
  factors: z.array(ScoreFactorV2Schema),
});
export type ScoreBreakdownV2 = z.infer<typeof ScoreBreakdownV2Schema>;

export const OverrideRecordSchema = z.object({
  name: z.string(),
  triggerValues: z.record(z.string(), z.any()),
  claimsInvolved: z.array(z.string()),
});
export type OverrideRecord = z.infer<typeof OverrideRecordSchema>;

export const Gate100ResultSchema = z.object({
  canReach100: z.boolean(),
  failedConditions: z.array(
    z.object({
      code: z.string(),
      condition: z.string(),
      details: z.string(),
    })
  ),
  allowedMaxScore: z.number(),
});
export type Gate100Result = z.infer<typeof Gate100ResultSchema>;

export const StoryStatusSchema = z.enum([
  "confirmed",
  "developing",
  "unconfirmed_reports",
]);
export type StoryStatus = z.infer<typeof StoryStatusSchema>;

export const ConclusionLabelSchema = z.enum([
  "True",
  "Mostly true",
  "Partly true",
  "Unconfirmed",
  "Misleading",
  "False",
  "Can't verify",
]);
export type ConclusionLabel = z.infer<typeof ConclusionLabelSchema>;

export const ConclusionSchema = z.object({
  label: ConclusionLabelSchema,
  explanation: z.string(),
  reasonCodes: z.array(z.string()),
});
export type Conclusion = z.infer<typeof ConclusionSchema>;

export const ScoreV2ResultSchema = z.object({
  overallTrustScore: z.number(),
  veracityVerdict: VeracityVerdictSchema,
  confidence: VerificationConfidenceSchema,
  scoreBreakdown: ScoreBreakdownV2Schema,
  overrideApplied: OverrideRecordSchema.optional(),
  gate100Result: Gate100ResultSchema,
  coverageLimited: z.boolean(),
  verifiedTrue: z.boolean().optional(),
  consistency: z.any().optional(),
  storyStatus: StoryStatusSchema.optional(),
  coreEventGatePassed: z.boolean().optional(),
  headlineSource: z.enum(["metadata", "url_search", "url_slug"]).nullable().optional(),
});
export type ScoreV2Result = z.infer<typeof ScoreV2ResultSchema>;

export const BackgroundImageMetadataSchema = z
  .object({
    url: z.string().nullable().optional(),
    sourceType: z.enum(["article", "evidence", "fallback"]).optional(),
    credit: z.string().nullable().optional(),
    luminance: z.number().min(0).max(1).optional(),
    alt: z.string().optional(),
  })
  .strict();
export type BackgroundImageMetadata = z.infer<typeof BackgroundImageMetadataSchema>;

/**
 * Strict VerificationReport schema representing article-wide deterministic verification.
 * Rejects invalid, missing, or malformed data types.
 */
export const VerificationReportSchema = z
  .object({
    articleTitle: z.string().trim().min(1, { message: "Article title cannot be empty" }),
    sourceDomain: z.string().trim().min(1, { message: "Source domain cannot be empty" }),
    articleUrl: z.string().nullable().optional(),
    featuredImage: z.string().nullable().optional(),
    backgroundImage: BackgroundImageMetadataSchema.optional(),
    author: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    overallTrustScore: z.number().int().min(0).max(100, { message: "Overall trust score must be between 0 and 100" }),
    veracityVerdict: VeracityVerdictSchema,
    confidence: VerificationConfidenceSchema,
    summary: z.string().trim().min(1, { message: "Verification summary cannot be empty" }),
    claimSummary: ClaimSummarySchema,
    evaluations: z.array(ClaimEvaluationSchema),
    omittedContext: z.array(OmissionSchema),
    scoreBreakdown: ScoreBreakdownSchema,
    crossSourceComparison: CrossSourceComparisonSchema.optional(),
    scoreExplanation: TransparentScoreExplanationSchema.optional(),
    comparison: ComparisonReportSchema.optional(),
    scoreV2Shadow: ScoreV2ResultSchema.optional(),
    scoreV1: z.any().optional(),
    verifiedTrue: z.boolean().optional(),
    consistency: z.any().optional(),
    storyStatus: StoryStatusSchema.optional(),
    sourceReadStatus: z.enum(["success", "partial", "failed", "insufficient", "readable", "unreadable", "could_not_read"]).optional(),
    sourceReadNote: z.string().optional(),
    finalUrl: z.string().optional(),
    canonicalUrl: z.string().nullable().optional(),
    extractionReason: z.string().optional(),
    coreEventGatePassed: z.boolean().optional(),
    headlineSource: z.enum(["metadata", "url_search", "url_slug"]).nullable().optional(),
    conclusion: ConclusionSchema.optional(),
    hasGatedEvidence: z.boolean().optional(),
  })
  .strict();

export type VerificationReport = z.infer<typeof VerificationReportSchema>;

/**
 * Request payload schema for POST /api/verify
 */
export const VerifyArticleRequestSchema = z
  .object({
    url: z.string().trim().url({ message: "A valid news article URL must be provided" }).optional(),
    input: z.string().trim().min(1, { message: "Input cannot be empty" }).optional(),
    inputType: z.enum(["url", "headline", "claim", "text"]).optional(),
  })
  .refine((data) => Boolean(data.url || data.input), {
    message: "Either 'input' or 'url' must be provided",
  });

export type VerifyArticleRequest = z.infer<typeof VerifyArticleRequestSchema>;

/**
 * API Standard Error Response Structure
 */
export interface VerifyApiError {
  code: string;
  message: string;
}

export interface VerifySuccessResponse {
  success: true;
  report: VerificationReport;
}

export interface VerifyErrorResponse {
  success: false;
  error: VerifyApiError;
}

export type VerifyApiResponse = VerifySuccessResponse | VerifyErrorResponse;

