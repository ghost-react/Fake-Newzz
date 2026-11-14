import { z } from "zod";
import { ArticleSchema } from "./article";
import { ClaimInputSchema, EvidenceSchema } from "./evidence";
import { ClaimEvaluationSchema } from "./evaluation";

/**
 * Strict enumeration of allowed omission types:
 * - missing_context: Important factual context is absent.
 * - missing_qualification: The article presents a claim without an important condition, limitation, exception, or qualification.
 * - missing_counter_evidence: Strong relevant evidence materially contradicts or challenges the presentation but is absent from the article.
 * - missing_source_context: The article uses a source, statistic, quote, study, document, or statement without an important context about what that source actually establishes.
 * - misleading_framing: The individual facts may be real, but their presentation materially creates a misleading interpretation when compared with the supplied evidence.
 */
export const OmissionTypeSchema = z.enum([
  "missing_context",
  "missing_qualification",
  "missing_counter_evidence",
  "missing_source_context",
  "misleading_framing",
]);
export type OmissionType = z.infer<typeof OmissionTypeSchema>;

/**
 * Strict enumeration of omission severity:
 * - high: Omission is likely to substantially change interpretation of a major claim.
 * - medium: Omission materially changes understanding but does not completely alter the central story.
 * - low: Relevant contextual limitation exists but has relatively small impact.
 */
export const OmissionSeveritySchema = z.enum(["high", "medium", "low"]);
export type OmissionSeverity = z.infer<typeof OmissionSeveritySchema>;

/**
 * Strict enumeration of omission confidence (evidence strength):
 * - high: Direct, strong evidence establishes both the omitted context and its material relevance.
 * - medium: Evidence reasonably supports the omission but has limitations.
 * - low: Potential omission exists but evidence is incomplete.
 */
export const OmissionConfidenceSchema = z.enum(["high", "medium", "low"]);
export type OmissionConfidence = z.infer<typeof OmissionConfidenceSchema>;

/**
 * Strict Omission schema representing a single materially important missing piece of context.
 */
export const OmissionSchema = z
  .object({
    id: z.string().trim().min(1, { message: "Omission ID cannot be empty" }),
    claimId: z.string().trim().nullable(),
    type: OmissionTypeSchema,
    severity: OmissionSeveritySchema,
    description: z
      .string()
      .trim()
      .min(1, { message: "Omission description cannot be empty" }),
    whyItMatters: z
      .string()
      .trim()
      .min(1, { message: "whyItMatters cannot be empty" }),
    evidenceIds: z
      .array(z.string().trim().min(1))
      .min(1, { message: "At least one evidence ID must be cited" }),
    confidence: OmissionConfidenceSchema,
  })
  .strict();

export type Omission = z.infer<typeof OmissionSchema>;

/**
 * Result schema containing an array of validated omissions.
 */
export const OmissionResultSchema = z
  .object({
    omissions: z.array(OmissionSchema),
  })
  .strict();

export type OmissionResult = z.infer<typeof OmissionResultSchema>;

/**
 * Input request validation schema for POST /api/context
 */
export const AnalyzeContextRequestSchema = z
  .object({
    article: ArticleSchema,
    claims: z
      .array(ClaimInputSchema)
      .min(1, { message: "At least one claim is required" })
      .max(20, { message: "Maximum of 20 claims allowed" }),
    evidence: z
      .array(EvidenceSchema)
      .max(200, { message: "Maximum of 200 evidence items allowed" }),
    evaluations: z
      .array(ClaimEvaluationSchema)
      .max(50, { message: "Maximum of 50 evaluations allowed" }),
  })
  .strict();

export type AnalyzeContextRequest = z.infer<typeof AnalyzeContextRequestSchema>;

/**
 * Standard API responses for context & omission analysis
 */
export interface ContextApiError {
  code: string;
  message: string;
}

export interface ContextSuccessResponse {
  success: true;
  omissions: Omission[];
}

export interface ContextErrorResponse {
  success: false;
  error: ContextApiError;
}

export type ContextApiResponse = ContextSuccessResponse | ContextErrorResponse;
