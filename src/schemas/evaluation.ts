import { z } from "zod";
import { ClaimInputSchema, EvidenceSchema, ClaimCertaintySchema, ClaimCertainty, ClaimKindSchema, ClaimKind } from "./evidence";
import { ClaimLayerSchema, ClaimLayer } from "./claim";

export * from "./claim";

/**
 * Strict verdict enum for atomic claim evaluations:
 * - supporting: evidence directly supports the claim
 * - contradicting: evidence directly conflicts with the claim
 * - qualifying: evidence materially limits, changes, or adds conditions/context to the claim without fully contradicting it
 * - insufficient: available evidence cannot reliably determine the claim
 */
export const VerdictSchema = z.enum([
  "supporting",
  "contradicting",
  "qualifying",
  "insufficient",
]);
export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Strict confidence enum:
 * - high: strong direct evidence with little meaningful conflict
 * - medium: useful evidence with limitations or some uncertainty
 * - low: weak, indirect, incomplete, or conflicting evidence
 */
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * Strict ClaimEvaluation schema representing evidence-grounded verification of a single claim.
 */
export const ClaimEvaluationSchema = z
  .object({
    claimId: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
    verdict: VerdictSchema,
    confidence: ConfidenceSchema,
    explanation: z.string().trim().min(1, { message: "Explanation cannot be empty" }),
    evidenceIds: z.array(z.string().trim().min(1)),
    citedPassage: z.string().trim().optional(),
    importantNotes: z.array(z.string().trim()).default([]),
    layer: ClaimLayerSchema.default("underlying_fact").optional(),
    certainty: ClaimCertaintySchema.default("asserted_fact").optional(),
    claimKind: ClaimKindSchema.default("news_event").optional(),
  })
  .strict();

export type ClaimEvaluation = z.infer<typeof ClaimEvaluationSchema>;

/**
 * Batch evaluations result
 */
export const ClaimEvaluationResultSchema = z
  .object({
    evaluations: z.array(ClaimEvaluationSchema),
  })
  .strict();

export type ClaimEvaluationResult = z.infer<typeof ClaimEvaluationResultSchema>;

/**
 * Request body schema for POST /api/evaluate
 */
export const EvaluateClaimsRequestSchema = z
  .object({
    claims: z
      .array(ClaimInputSchema)
      .min(1, { message: "At least one claim is required" })
      .max(20, { message: "Maximum of 20 claims allowed per evaluation request" }),
    evidence: z
      .array(EvidenceSchema)
      .max(200, { message: "Maximum of 200 evidence items allowed per evaluation request" }),
  })
  .strict()
  .refine(
    (data) => {
      const claimIdSet = new Set(data.claims.map((c) => c.id));
      return data.evidence.every((ev) => claimIdSet.has(ev.claimId));
    },
    {
      message: "Every evidence item must reference a valid claim ID from the supplied claims list",
      path: ["evidence"],
    }
  );

export type EvaluateClaimsRequest = z.infer<typeof EvaluateClaimsRequestSchema>;

/**
 * Standard Evaluation API response interfaces
 */
export interface EvaluateApiError {
  code: string;
  message: string;
}

export interface EvaluateSuccessResponse {
  success: true;
  evaluations: ClaimEvaluation[];
}

export interface EvaluateErrorResponse {
  success: false;
  error: EvaluateApiError;
}

export type EvaluateApiResponse = EvaluateSuccessResponse | EvaluateErrorResponse;
