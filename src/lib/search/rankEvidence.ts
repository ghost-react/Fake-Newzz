import { Evidence, EvidenceSchema, RankClaimInput, RankEvidenceInputItem } from "@/schemas/evidence";
import { classifySourceType } from "./sourceClassifier";
import { analyzeSourceRelationships, EvidenceForRelationship } from "./sourceRelationship";
import { computeEvidenceQuality, computeRankScore, estimateRelevance } from "./evidenceRanking";
import { normalizeUrlForDeduplication } from "./searchClaims";
import { traceStage } from "../debug/trace";

/**
 * Orchestrates the complete Phase 4 evidence ranking pipeline for a single claim.
 *
 * Pipeline:
 * 1. URL deduplication (defensive — Phase 3 should have already done this)
 * 2. Source type classification (recalculated server-side, ignoring client input)
 * 3. Source relationship analysis (cross-item comparison)
 * 4. Evidence quality computation (based on sourceType + sourceRelationship)
 * 5. Relevance estimation (keyword/entity overlap with claim text)
 * 6. Composite ranking (no search-position influence)
 * 7. Schema validation (strict Zod parse)
 *
 * ZERO-VERDICT RULE:
 * This function does NOT determine whether evidence supports or contradicts the claim.
 * `relationship` remains "unknown" on every output item.
 * Phase 5 will determine: supporting | contradicting | qualifying | unknown.
 */
export function rankEvidenceForClaim(
  claim: RankClaimInput,
  rawEvidence: RankEvidenceInputItem[]
): Evidence[] {
  if (rawEvidence.length === 0) return [];

  // ── Step 1: Deduplicate by normalized URL ────────────────────────────────
  const seenUrls = new Set<string>();
  const droppedUrls: Array<{ url: string; reason: string }> = [];

  const deduplicated = rawEvidence.filter((ev) => {
    const normalized = normalizeUrlForDeduplication(ev.url);
    if (seenUrls.has(normalized)) {
      droppedUrls.push({ url: ev.url, reason: "duplicate_normalized_url" });
      return false;
    }
    seenUrls.add(normalized);
    return true;
  });

  // ── Step 2: Classify source type (server-side, ignoring client input) ────
  const withSourceType = deduplicated.map((ev) => ({
    ...ev,
    classifiedSourceType: classifySourceType(ev.domain, ev.url),
  }));

  // ── Step 3: Cross-item source relationship analysis ───────────────────────
  const forRelationship: EvidenceForRelationship[] = withSourceType.map((ev) => ({
    id: ev.id,
    title: ev.title,
    snippet: ev.snippet,
    domain: ev.domain,
    url: ev.url,
    sourceType: ev.classifiedSourceType,
  }));

  const relationships = analyzeSourceRelationships(forRelationship);

  // ── Step 4 + 5: Compute quality and relevance per item ───────────────────
  const enriched = withSourceType.map((ev) => {
    const sourceRelationship = relationships.get(ev.id) || "unknown";
    const evidenceQuality = computeEvidenceQuality(ev.classifiedSourceType, sourceRelationship);
    const relevance = estimateRelevance(claim.text, {
      title: ev.title,
      snippet: ev.snippet,
    });

    return {
      id: ev.id,
      claimId: claim.id,
      title: ev.title,
      url: ev.url,
      domain: ev.domain,
      snippet: ev.snippet,
      publishedAt: ev.publishedAt ?? null,
      sourceRelationship,
      relationship: "unknown" as const,  // Phase 5 will determine this
      sourceType: ev.classifiedSourceType,
      evidenceQuality,
      relevance,
    };
  });

  // ── Step 6: Sort by composite ranking score (descending) ─────────────────
  const sorted = enriched.sort(
    (a, b) => computeRankScore(b) - computeRankScore(a)
  );

  // ── Step 7: Validate each item against strict EvidenceSchema ─────────────
  const validated: Evidence[] = [];
  for (const item of sorted) {
    const result = EvidenceSchema.safeParse(item);
    if (result.success) {
      validated.push(result.data);
    } else {
      droppedUrls.push({
        url: item.url,
        reason: `schema_validation_failed: ${result.error.issues.map((i) => i.message).join("; ")}`,
      });
    }
  }

  try {
    traceStage("dedupe_ranking", {
      claimId: claim.id,
      droppedUrls,
      rankedOrder: validated.map((v) => ({
        id: v.id,
        url: v.url,
        domain: v.domain,
        sourceCategory: v.sourceType,
        sourceRelationship: v.sourceRelationship,
        relevance: v.relevance,
        evidenceQuality: v.evidenceQuality,
      })),
    });
  } catch {}

  return validated;
}

/**
 * Orchestrates Phase 4 ranking for multiple claims.
 * Routes each claim's evidence through the single-claim pipeline.
 *
 * Evidence items are grouped by claimId before processing.
 * Claims with no evidence return an empty evidence list.
 */
export function rankEvidenceForClaims(
  claims: RankClaimInput[],
  evidence: RankEvidenceInputItem[]
): Array<{ claimId: string; evidence: Evidence[] }> {
  // Group evidence by claimId
  const evidenceByClaimId = new Map<string, RankEvidenceInputItem[]>();
  for (const ev of evidence) {
    const list = evidenceByClaimId.get(ev.claimId) || [];
    list.push(ev);
    evidenceByClaimId.set(ev.claimId, list);
  }

  // Process each claim
  return claims.map((claim) => {
    const claimEvidence = evidenceByClaimId.get(claim.id) || [];
    const rankedEvidence = rankEvidenceForClaim(claim, claimEvidence);
    return {
      claimId: claim.id,
      evidence: rankedEvidence,
    };
  });
}
