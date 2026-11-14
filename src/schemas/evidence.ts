import { z } from "zod";

/**
 * Claim importance levels controlling maximum search queries generated:
 * HIGH: up to 3 queries
 * MEDIUM: up to 2 queries
 * LOW: up to 1 query
 */
export const ClaimImportanceSchema = z.enum(["high", "medium", "low"]);
export type ClaimImportance = z.infer<typeof ClaimImportanceSchema>;

export const ClaimLayerSchema = z.enum([
  "event_occurred",
  "statement_made",
  "quote_wording",
  "underlying_fact",
  "interpretation",
]);
export type ClaimLayer = z.infer<typeof ClaimLayerSchema>;

export const CLAIM_CERTAINTIES = [
  "asserted_fact",
  "reported_claim",
  "speculation",
  "opinion_analysis",
] as const;

export type ClaimCertainty = (typeof CLAIM_CERTAINTIES)[number];
export const ClaimCertaintySchema = z.enum(CLAIM_CERTAINTIES);

/**
 * Input Atomic Claim for evidence search
 */
export const ClaimInputSchema = z
  .object({
    id: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
    text: z.string().trim().min(1, { message: "Claim text cannot be empty" }),
    importance: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      ClaimImportanceSchema
    ),
    claimType: z.string().trim().default("factual"),
    layer: ClaimLayerSchema.default("underlying_fact").optional(),
    certainty: ClaimCertaintySchema.default("asserted_fact").optional(),
    linkedClaimId: z.string().trim().nullable().optional(),
  })
  .strict();

export type ClaimInput = z.infer<typeof ClaimInputSchema>;

/**
 * Input request validation schema for POST /api/search
 * Maximum 20 claims per request to prevent accidental excessive API usage.
 */
export const SearchClaimsRequestSchema = z
  .object({
    claims: z
      .array(ClaimInputSchema)
      .min(1, { message: "At least one claim is required" })
      .max(20, { message: "Maximum of 20 claims allowed per search request" }),
  })
  .strict();

export type SearchClaimsRequest = z.infer<typeof SearchClaimsRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE TYPE  (lowercase — deterministic structural classification only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural source type classification.
 * Describes the NATURE of the source, not its political orientation or reliability.
 *
 * IMPORTANT: These categories carry NO veracity implication. An "official"
 * government source can contain inaccurate information; a "blog" can contain
 * accurate primary documentation.
 */
export const RAW_SOURCE_TYPES = [
  "official",         // Government websites, international organizations
  "primary_document", // Court judgments, gazettes, regulatory filings, official PDFs
  "wire",             // News wire services (Reuters, PTI, ANI, AFP, AP)
  "national_news",    // Major national newspapers and news portals
  "regional_news",    // Regional publications
  "international_news", // International newspapers and broadcasters
  "fact_check",       // Dedicated fact-checking organizations
  "research",         // Academic institutions, research journals
  "blog",             // Personal blogs, newsletters, opinion platforms
  "social",           // Social media platforms
  "specialized_trade", // Trade publications and industry journals
  "legal_court",      // Court databases, legal tracking portals
  "legal_database",   // Legal databases and case law repositories
  "other",            // Unrecognized or unclassifiable sources
] as const;

export const SourceTypeSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toLowerCase() : val),
  z.enum(RAW_SOURCE_TYPES)
);

export type SourceType = (typeof RAW_SOURCE_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE RELATIONSHIP  (Phase 4 — extended from Phase 3's literal "unknown")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observable relationship between a source and other retrieved sources.
 *
 * IMPORTANT:
 * - These are observable signals only, NOT certainties.
 * - "independent" does NOT mean "more reliable".
 * - "original" does NOT mean "factually correct".
 * - Source relationship carries no veracity claim.
 */
export const SourceRelationshipSchema = z.enum([
  "original",           // Strong evidence this is the original/primary publisher
  "independent",        // Appears to have reported independently
  "syndicated",         // Content appears republished from another retrieved source
  "cites_other_source", // Explicitly identifies another source as the basis
  "unknown",            // Insufficient evidence to determine relationship
]);

export type SourceRelationship = z.infer<typeof SourceRelationshipSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE QUALITY  (Phase 4 — observable quality signal, NOT a truth score)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observable evidence quality based on source characteristics.
 *
 * CRITICAL:
 * - evidenceQuality is NOT a truth score.
 * - A "high" quality source can report false information.
 * - A "low" quality source can contain primary documentation.
 * - This field informs Phase 5 weighting only.
 */
export const EvidenceQualitySchema = z.enum(["high", "medium", "low", "unknown"]);
export type EvidenceQuality = z.infer<typeof EvidenceQualitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RELEVANCE  (Phase 4 — topical relevance to the specific claim)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimated relevance of evidence to the specific atomic claim.
 * Determined by keyword/entity overlap between claim text and evidence title/snippet.
 *
 * IMPORTANT: This is a structural/topical relevance estimate only.
 * Phase 5 will determine whether the evidence ENTAILS, CONTRADICTS, or QUALIFIES the claim.
 */
export const EvidenceRelevanceSchema = z.enum([
  "direct",   // Evidence appears to directly address the specific claim
  "related",  // Evidence is topically related but may not directly establish the claim
  "weak",     // Minimal overlap; loosely related to claim subject
  "unknown",  // Cannot determine relevance from available metadata
]);

export type EvidenceRelevance = z.infer<typeof EvidenceRelevanceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RELATIONSHIP & SOURCE CONTENT STATUS  (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────

export const EvidenceRelationshipSchema = z.enum([
  "supporting",
  "contradicting",
  "qualifying",
  "neutral",
  "unknown",
]);
export type EvidenceRelationship = z.infer<typeof EvidenceRelationshipSchema>;

export const SourceContentStatusSchema = z.enum([
  "not_retrieved",
  "retrieved",
  "failed",
  "snippet_only",
]);
export type SourceContentStatus = z.infer<typeof SourceContentStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE SCHEMA  (Phase 5 extended — backward compatible with Phase 3/4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended Phase 5 Evidence Schema.
 *
 * Phase 5 determines whether evidence supports, contradicts, or qualifies a claim.
 *
 * Backward compatible with Phase 3 & 4:
 * - New fields default to safe defaults when absent.
 * - Existing evidence objects parse without modification.
 */
export const EvidenceSchema = z
  .object({
    id: z.string().trim().min(1, { message: "Evidence ID cannot be empty" }),
    claimId: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
    title: z.string().trim().min(1, { message: "Title cannot be empty" }),
    url: z.string().trim().url({ message: "URL must be a valid URL string" }),
    domain: z.string().trim().min(1, { message: "Domain cannot be empty" }),
    snippet: z.string().trim(),
    publishedAt: z.string().nullable().default(null).optional(),
    sourceRelationship: SourceRelationshipSchema.default("unknown"),
    // Phase 5: "supporting" | "contradicting" | "qualifying" | "neutral" | "unknown"
    relationship: EvidenceRelationshipSchema.default("unknown"),
    sourceType: SourceTypeSchema.default("other"),
    evidenceQuality: EvidenceQualitySchema.default("unknown"),
    relevance: EvidenceRelevanceSchema.default("unknown"),
    // Phase 5: selective source content retrieval fields
    sourceContent: z.string().nullable().optional(),
    sourceContentStatus: SourceContentStatusSchema.optional(),
    sourceContentExcerpt: z.string().nullable().optional(),
    contentDepth: z.enum(["full_text", "snippet"]).optional(),
    fetchFailed: z.boolean().optional(),
    eventMatch: z.enum(["same_event", "related_background", "different_event"]).default("same_event").optional(),
  })
  .strict();

export type Evidence = Omit<z.infer<typeof EvidenceSchema>, "publishedAt"> & {
  publishedAt?: string | null;
};

/**
 * List of Evidence items
 */
export const EvidenceListSchema = z.array(EvidenceSchema);
export type EvidenceList = z.infer<typeof EvidenceListSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 TYPES — Search result grouped by atomic claim
// ─────────────────────────────────────────────────────────────────────────────

export const ClaimSearchResultSchema = z.object({
  claimId: z.string(),
  queries: z.array(z.string()),
  evidence: EvidenceListSchema,
  status: z.enum(["success", "partial_failure", "no_results"]).optional(),
});

export type ClaimSearchResult = z.infer<typeof ClaimSearchResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 REQUEST/RESPONSE TYPES — Evidence Ranking API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal claim input for Phase 4 ranking (text needed for relevance estimation)
 */
export const RankClaimInputSchema = z.object({
  id: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
  text: z.string().trim().min(1, { message: "Claim text cannot be empty" }),
});
export type RankClaimInput = z.infer<typeof RankClaimInputSchema>;

/**
 * Permissive input evidence schema for POST /api/evidence/rank.
 * Accepts Phase 3 evidence objects (sourceType/sourceRelationship are reclassified server-side).
 * All source classifications will be IGNORED from the client and recalculated.
 */
export const RankEvidenceInputItemSchema = z.object({
  id: z.string().trim().min(1, { message: "Evidence ID cannot be empty" }),
  claimId: z.string().trim().min(1, { message: "Claim ID cannot be empty" }),
  title: z.string().trim().min(1, { message: "Title cannot be empty" }),
  url: z.string().trim().url({ message: "URL must be valid" }),
  domain: z.string().trim().min(1, { message: "Domain cannot be empty" }),
  snippet: z.string().trim(),
  publishedAt: z.string().nullable().optional(),
  // These are accepted but IGNORED — server reclassifies everything
  sourceRelationship: z.string().optional().default("unknown"),
  relationship: z.string().optional().default("unknown"),
  sourceType: z.string().optional(),
});
export type RankEvidenceInputItem = z.infer<typeof RankEvidenceInputItemSchema>;

/**
 * Request body schema for POST /api/evidence/rank
 */
export const RankEvidenceRequestSchema = z
  .object({
    claims: z
      .array(RankClaimInputSchema)
      .min(1, { message: "At least one claim is required" })
      .max(20, { message: "Maximum of 20 claims allowed per request" }),
    evidence: z
      .array(RankEvidenceInputItemSchema)
      .max(200, { message: "Maximum of 200 evidence items allowed per request" }),
  })
  .strict();
export type RankEvidenceRequest = z.infer<typeof RankEvidenceRequestSchema>;

/**
 * Ranked evidence result grouped by claim
 */
export const ClaimRankedEvidenceSchema = z.object({
  claimId: z.string(),
  evidence: EvidenceListSchema,
});
export type ClaimRankedEvidence = z.infer<typeof ClaimRankedEvidenceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchApiError {
  code: string;
  message: string;
}

/** Phase 3: Search */
export interface SearchSuccessResponse {
  success: true;
  results: ClaimSearchResult[];
}

export interface SearchErrorResponse {
  success: false;
  error: SearchApiError;
}

export type SearchApiResponse = SearchSuccessResponse | SearchErrorResponse;

/** Phase 4: Evidence Ranking */
export interface RankSuccessResponse {
  success: true;
  results: ClaimRankedEvidence[];
}

export interface RankErrorResponse {
  success: false;
  error: SearchApiError;
}

export type RankApiResponse = RankSuccessResponse | RankErrorResponse;
