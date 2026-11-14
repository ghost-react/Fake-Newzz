import { z } from "zod";

export const CLAIM_LAYERS = [
  "event_occurred",
  "statement_made",
  "quote_wording",
  "underlying_fact",
  "interpretation",
] as const;

export type ClaimLayer = (typeof CLAIM_LAYERS)[number];
export const ClaimLayerSchema = z.enum(CLAIM_LAYERS);

export const CLAIM_CERTAINTIES = [
  "asserted_fact",
  "reported_claim",
  "speculation",
  "opinion_analysis",
] as const;

export type ClaimCertainty = (typeof CLAIM_CERTAINTIES)[number];
export const ClaimCertaintySchema = z.enum(CLAIM_CERTAINTIES);

export const ClaimImportanceSchema = z.enum(["high", "medium", "low"]);
export type ClaimImportance = z.infer<typeof ClaimImportanceSchema>;

export const ClaimSchema = z
  .object({
    id: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
    text: z.string().trim().min(1, { message: "Claim text cannot be empty" }),
    importance: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      ClaimImportanceSchema
    ),
    claimType: z.string().trim().default("factual"),
    layer: ClaimLayerSchema.default("underlying_fact"),
    certainty: ClaimCertaintySchema.default("asserted_fact"),
    linkedClaimId: z.string().trim().nullable().optional(),
  })
  .strict();

export type Claim = z.infer<typeof ClaimSchema>;

