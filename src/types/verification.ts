import { z } from "zod";

export const VeracityStatusSchema = z.enum([
  "VERIFIED",
  "CONTRADICTED",
  "CONTEXT_MISSING",
  "UNVERIFIED",
]);
export type VeracityStatus = z.infer<typeof VeracityStatusSchema>;

export const ConfidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const SourceTypeSchema = z.enum([
  "OFFICIAL",
  "PRIMARY_DOCUMENT",
  "WIRE",
  "NATIONAL_NEWS",
  "REGIONAL_NEWS",
  "INTERNATIONAL_NEWS",
  "FACT_CHECK",
  "RESEARCH",
  "BLOG",
  "SOCIAL",
  "OTHER",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceTierSchema = z.enum([
  "PRIMARY_RECORD",
  "TIER_1_WIRE",
  "INDEPENDENT_PRESS",
  "FACT_CHECK_ARCHIVE",
  "COMMERCIAL_MEDIA",
]);
export type SourceTier = z.infer<typeof SourceTierSchema>;

export const SourceStanceSchema = z.enum([
  "SUPPORTS",
  "CONTRADICTS",
  "NEUTRAL",
  "MENTIONS",
]);
export type SourceStance = z.infer<typeof SourceStanceSchema>;

export const CoverageStanceSchema = z.enum([
  "SUPPORTIVE",
  "CRITICAL",
  "NEUTRAL",
  "OMITTED_COVERAGE",
]);
export type CoverageStance = z.infer<typeof CoverageStanceSchema>;

export const EvidenceSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  domain: z.string(),
  tier: SourceTierSchema,
  tierLabel: z.string(),
  stance: SourceStanceSchema,
  extractedSnippet: z.string(),
  publishDate: z.string().optional(),
  isPrimaryDocument: z.boolean().default(false),
});
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const AtomicClaimSchema = z.object({
  id: z.string(),
  claimText: z.string(),
  originalQuote: z.string().optional(),
  status: VeracityStatusSchema,
  confidence: ConfidenceLevelSchema,
  evidenceSummary: z.string(),
  counterEvidence: z.string().optional(),
  sources: z.array(EvidenceSourceSchema),
});
export type AtomicClaim = z.infer<typeof AtomicClaimSchema>;

export const OmittedContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  impact: z.enum(["CRITICAL", "MODERATE", "SUBTLE"]),
  substantiatedBy: z.string(),
  sourceUrl: z.string().url().optional(),
});
export type OmittedContext = z.infer<typeof OmittedContextSchema>;

export const MediaCoverageItemSchema = z.object({
  id: z.string(),
  outletName: z.string(),
  outletCategory: z.enum([
    "International Wire",
    "State / Public Record",
    "Independent Investigative",
    "Commercial Broadcaster",
    "Regional Press",
  ]),
  stance: CoverageStanceSchema,
  headline: z.string(),
  framingAnalysis: z.string(),
  url: z.string().url(),
  publishDate: z.string(),
  keyEmphasis: z.string(),
});
export type MediaCoverageItem = z.infer<typeof MediaCoverageItemSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventTitle: z.string(),
  description: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().url().optional(),
  isMilestone: z.boolean().default(false),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const VerificationReportSchema = z.object({
  id: z.string(),
  inputQuery: z.string(),
  inputType: z.enum(["url", "claim"]),
  articleTitle: z.string(),
  articleAuthor: z.string().optional(),
  sourceDomain: z.string(),
  publicationDate: z.string(),
  readTimeMinutes: z.number().optional(),
  featuredImageUrl: z.string().optional(),
  overallTrustScore: z.number().min(0).max(100),
  verdict: VeracityStatusSchema,
  verdictLabel: z.string(),
  confidence: ConfidenceLevelSchema,
  executiveSummary: z.string(),
  atomicClaims: z.array(AtomicClaimSchema),
  omittedContext: z.array(OmittedContextSchema),
  coverageComparison: z.array(MediaCoverageItemSchema),
  timeline: z.array(TimelineEventSchema),
  methodologyAudit: z.object({
    primarySourcesCount: z.number(),
    independentSourcesCount: z.number(),
    wireServicesCount: z.number(),
    totalEvidenceCitations: z.number(),
    checkedAt: z.string(),
  }),
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;
