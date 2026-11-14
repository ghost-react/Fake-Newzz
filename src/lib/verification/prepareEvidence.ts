import {
  Evidence,
  EvidenceQuality,
  EvidenceRelevance,
  SourceRelationship,
  SourceType,
} from "@/schemas/evidence";

/**
 * Compact, normalized representation of evidence prepared for LLM evaluation.
 * Contains only factual, structural, and excerpt data for the specific claim.
 * Never includes internal application state, prompt injection vectors, or unrelated content.
 */
export interface PreparedEvidenceItem {
  evidenceId: string;
  title: string;
  url: string;
  domain: string;
  sourceType: SourceType;
  sourceRelationship: SourceRelationship;
  evidenceQuality: EvidenceQuality;
  relevance: EvidenceRelevance;
  publishedAt?: string | null;
  snippet: string;
  sourceContentExcerpt: string | null;
  contentDepth?: "full_text" | "snippet";
  fetchFailed?: boolean;
}

/**
 * Maximum character limit for evidence snippet in prepared LLM input.
 */
const MAX_SNIPPET_LENGTH = 800;

/**
 * Maximum character limit for full source content excerpt in prepared LLM input.
 */
const MAX_EXCERPT_LENGTH = 1200;

/**
 * Prepares a list of evidence items for a single claim into compact LLM input.
 * Strictly filters by claimId to prevent cross-claim leakage.
 */
export function prepareEvidenceForClaim(
  claimId: string,
  evidenceList: Evidence[]
): PreparedEvidenceItem[] {
  // Filter strictly to evidence matching this specific claim, excluding empty/failed fetches with no text
  const claimEvidence = evidenceList
    .filter((ev) => ev.claimId === claimId)
    .filter(
      (ev) =>
        Boolean(ev.snippet && ev.snippet.trim().length > 0) ||
        Boolean(ev.sourceContentExcerpt && ev.sourceContentExcerpt.trim().length > 0)
    );

  return claimEvidence.map((ev) => {
    // Truncate snippet safely
    const cleanSnippet = ev.snippet
      ? ev.snippet.trim().slice(0, MAX_SNIPPET_LENGTH)
      : "";

    // Truncate source content excerpt safely
    const cleanExcerpt = ev.sourceContentExcerpt
      ? ev.sourceContentExcerpt.trim().slice(0, MAX_EXCERPT_LENGTH)
      : null;

    // Determine contentDepth: only "full_text" if cleanExcerpt is present and fetch succeeded
    const contentDepth: "full_text" | "snippet" =
      ev.contentDepth === "full_text" && cleanExcerpt
        ? "full_text"
        : ev.sourceContentStatus === "retrieved" && cleanExcerpt
        ? "full_text"
        : "snippet";

    return {
      evidenceId: ev.id,
      title: ev.title.trim(),
      url: ev.url.trim(),
      domain: ev.domain.trim(),
      sourceType: ev.sourceType,
      sourceRelationship: ev.sourceRelationship,
      evidenceQuality: ev.evidenceQuality,
      relevance: ev.relevance,
      publishedAt: ev.publishedAt || null,
      snippet: cleanSnippet,
      sourceContentExcerpt: cleanExcerpt,
      contentDepth,
      fetchFailed: ev.fetchFailed ?? (ev.sourceContentStatus === "failed"),
    };
  });
}
