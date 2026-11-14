import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import {
  CrossSourceComparison,
  ClaimComparison,
  PublicationExamined,
  ComparisonFindingType,
  LegacyComparisonDimension,
  CitedSourceInfo,
} from "@/schemas/comparison";
import {
  detectWireAgency,
  detectUnnamedSource,
  computeJaccardSimilarity,
} from "../search/sourceRelationship";

/**
 * Extracts numbers, percentages, and currencies from text for numerical comparison.
 */
function extractNumericalTokens(text: string): string[] {
  const matches = text.match(/[₹$€£]?\b\d+(?:[.,]\d+)?%?\b/g) || [];
  return matches.map((m) => m.trim().toLowerCase());
}

/**
 * Extracts quoted substrings from text for quote comparison.
 */
function extractQuotes(text: string): string[] {
  const matches = text.match(/["“'‘](.+?)["”'’]/g) || [];
  return matches.map((q) => q.replace(/["“'‘”]/g, "").trim()).filter((q) => q.length > 5);
}

/**
 * Detects if a text treats something as an allegation/unconfirmed claim.
 */
function hasAllegationFraming(text: string): boolean {
  const lower = text.toLowerCase();
  const allegationWords = [
    "alleged", "allegation", "accused of", "reportedly", "purported",
    "claimed that", "suspected", "unconfirmed", "rumored", "claims that"
  ];
  return allegationWords.some((w) => lower.includes(w));
}

/**
 * Detects the primary factual dimension of a claim.
 */
function detectClaimDimension(claimText: string): LegacyComparisonDimension {
  const numbers = extractNumericalTokens(claimText);
  if (numbers.length > 0) return "numerical_figures";

  const quotes = extractQuotes(claimText);
  if (quotes.length > 0) return "direct_quotations";

  const lower = claimText.toLowerCase();
  if (
    lower.includes("statement") ||
    lower.includes("announced") ||
    lower.includes("spokesperson") ||
    lower.includes("press release") ||
    lower.includes("ministry")
  ) {
    return "official_statements";
  }

  if (
    lower.includes("alleged") ||
    lower.includes("accused") ||
    lower.includes("suspected") ||
    lower.includes("claims")
  ) {
    return "allegations_vs_facts";
  }

  if (
    lower.includes("killed") ||
    lower.includes("passed away") ||
    lower.includes("won") ||
    lower.includes("collapsed") ||
    lower.includes("approved") ||
    lower.includes("resigned")
  ) {
    return "reported_outcomes";
  }

  if (
    lower.includes("january") || lower.includes("february") || lower.includes("march") ||
    lower.includes("april") || lower.includes("may") || lower.includes("june") ||
    lower.includes("july") || lower.includes("august") || lower.includes("september") ||
    lower.includes("october") || lower.includes("november") || lower.includes("december") ||
    lower.includes("yesterday") || lower.includes("today") || lower.includes("202")
  ) {
    return "dates_timelines";
  }

  return "event_description";
}

/**
 * Core Cross-Source Comparison Engine
 * Compares evidence from multiple publications against each claim across factual dimensions.
 */
export function compareClaimsAcrossSources(
  originalPublisher: string,
  claims: ClaimInput[],
  evidenceList: Evidence[],
  evaluations: ClaimEvaluation[]
): CrossSourceComparison {
  const evalMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evalMap.set(e.claimId, e));

  // 1. Catalog and deduplicate all examined publications
  const publicationMap = new Map<string, PublicationExamined>();
  const wireAgenciesSet = new Set<string>();

  for (const ev of evidenceList) {
    const domain = ev.domain.toLowerCase().replace(/^www\./, "");
    const combinedText = `${ev.title} ${ev.snippet} ${ev.sourceContentExcerpt || ""}`;
    const detectedWire = detectWireAgency(combinedText);
    if (detectedWire) {
      wireAgenciesSet.add(detectedWire);
    }

    const isWire =
      ev.sourceType === "wire" ||
      Boolean(detectedWire) ||
      ev.sourceRelationship === "syndicated";

    const isIndependent =
      ev.sourceRelationship === "independent" ||
      (ev.sourceRelationship === "original" && !detectedWire);

    if (!publicationMap.has(domain)) {
      publicationMap.set(domain, {
        domain,
        url: ev.url,
        title: ev.title,
        sourceType: ev.sourceType,
        relationship: ev.sourceRelationship,
        isIndependent,
        isWireSyndicated: isWire,
      });
    }
  }

  const publications = Array.from(publicationMap.values());
  const independentCount = publications.filter((p) => p.isIndependent).length;
  const syndicatedCount = publications.filter((p) => p.isWireSyndicated).length;
  const wireAgenciesDetected = Array.from(wireAgenciesSet);

  // Each unique wire agency or syndicated origin network counts as 1 independent source entity
  const wireEntityCount =
    wireAgenciesDetected.length > 0
      ? wireAgenciesDetected.length
      : syndicatedCount > 0 && independentCount === 0
      ? 1
      : 0;
  const totalIndependentSources = independentCount + wireEntityCount;

  // 2. Perform per-claim cross-source comparison
  const claimsCompared: ClaimComparison[] = [];
  let claimsAgreedCount = 0;
  let claimsConflictingCount = 0;
  let claimsUnresolvedCount = 0;
  let hasNumericalConflictGlobal = false;
  let hasDirectQuoteConflictGlobal = false;

  for (const claim of claims) {
    const claimEval = evalMap.get(claim.id);
    const dimension = detectClaimDimension(claim.text);

    // Filter evidence associated with this claim
    const relevantEvidence = evidenceList.filter((e) => e.claimId === claim.id);
    const citedEvidence = relevantEvidence.filter(
      (e) => claimEval?.evidenceIds?.includes(e.id)
    );

    // Gather distinct sources for this claim
    const sourcesForClaim: CitedSourceInfo[] = [];
    const seenDomains = new Set<string>();

    for (const ev of relevantEvidence) {
      const dom = ev.domain.toLowerCase().replace(/^www\./, "");
      if (!seenDomains.has(dom)) {
        seenDomains.add(dom);
        let stance: "agrees" | "conflicts" | "neutral" | "qualifies" = "neutral";
        if (claimEval?.evidenceIds?.includes(ev.id)) {
          if (claimEval.verdict === "supporting") stance = "agrees";
          else if (claimEval.verdict === "contradicting") stance = "conflicts";
          else if (claimEval.verdict === "qualifying") stance = "qualifies";
        }

        sourcesForClaim.push({
          title: ev.title,
          domain: dom,
          url: ev.url,
          sourceType: ev.sourceType,
          relationship: ev.sourceRelationship,
          stance,
        });
      }
    }

    const claimIndepCount = sourcesForClaim.filter(
      (s) => s.relationship === "independent" || s.relationship === "original"
    ).length;
    const claimSyndCount = sourcesForClaim.filter(
      (s) => s.relationship === "syndicated" || s.relationship === "cites_other_source"
    ).length;

    // Check for numerical discrepancies across sources
    const claimNumbers = extractNumericalTokens(claim.text);
    let numericalConflict = false;
    const conflictingNums: string[] = [];

    if (claimNumbers.length > 0 && relevantEvidence.length >= 2) {
      for (const ev of relevantEvidence) {
        const evText = `${ev.title} ${ev.snippet}`.toLowerCase();
        const evNumbers = extractNumericalTokens(evText);
        // If evidence has numbers of the same magnitude/type that differ from claim
        for (const evNum of evNumbers) {
          if (!claimNumbers.includes(evNum) && /[0-9]{2,}/.test(evNum)) {
            conflictingNums.push(`${ev.domain}: reported "${evNum}"`);
            numericalConflict = true;
            hasNumericalConflictGlobal = true;
          }
        }
      }
    }

    // Check for direct quote variations
    const claimQuotes = extractQuotes(claim.text);
    let quoteConflict = false;
    if (claimQuotes.length > 0 && relevantEvidence.length >= 2) {
      const quoteMatches = relevantEvidence.filter((ev) => {
        const text = `${ev.title} ${ev.snippet}`.toLowerCase();
        return claimQuotes.some((q) => text.includes(q.toLowerCase()));
      });
      if (quoteMatches.length === 0 && relevantEvidence.length > 0) {
        quoteConflict = true;
        hasDirectQuoteConflictGlobal = true;
      }
    }

    // Determine Finding Type
    let findingType: ComparisonFindingType = "unresolved_information";
    const agreedPoints: string[] = [];
    const conflictingPoints: string[] = [];
    const unresolvedPoints: string[] = [];

    if (claimEval?.verdict === "contradicting" || numericalConflict) {
      findingType = "contradiction";
      claimsConflictingCount++;
      if (numericalConflict) {
        conflictingPoints.push(`Numerical variation: claim states [${claimNumbers.join(", ")}], but reports differ.`);
      }
      conflictingPoints.push(claimEval?.explanation || "Evidence from independent publications conflicts with this assertion.");
    } else if (claimEval?.verdict === "qualifying") {
      findingType = "additional_context";
      agreedPoints.push("General context supported by reporting.");
      conflictingPoints.push(claimEval?.explanation || "Requires additional context or qualifying conditions.");
    } else if (claimEval?.verdict === "supporting") {
      if (claimIndepCount >= 2) {
        findingType = "agreement";
        claimsAgreedCount++;
        agreedPoints.push(`Corroborated across ${claimIndepCount} independent publications without material conflict.`);
      } else if (claimIndepCount === 1 && claimSyndCount > 0) {
        findingType = "partial_agreement";
        claimsAgreedCount++;
        agreedPoints.push("Supported by primary report; other coverage consists of syndicated agency copies.");
      } else if (claimIndepCount === 1) {
        const hasAuthoritative = sourcesForClaim.some(
          (s) => s.sourceType === "official" || s.sourceType === "research" || s.sourceType === "primary_document"
        );
        findingType = hasAuthoritative ? "agreement" : "partial_agreement";
        claimsAgreedCount++;
        agreedPoints.push(
          hasAuthoritative
            ? "Corroborated by primary/authoritative source."
            : "Reported by a single outlet; limited independent corroboration available."
        );
      } else {
        findingType = "agreement";
        claimsAgreedCount++;
        agreedPoints.push("Supported by official primary document or archive.");
      }
    } else {
      findingType = "unresolved_information";
      claimsUnresolvedCount++;
      unresolvedPoints.push("Available public coverage is insufficient or conflicting.");
    }

    // Summary description
    let summary = "";
    if (findingType === "agreement") {
      summary = `Independent publications corroborate this assertion across ${dimension.replace(/_/g, " ")}.`;
    } else if (findingType === "partial_agreement") {
      summary = `Broad agreement on core event, with reporting relying on single initial source or wire dispatch.`;
    } else if (findingType === "contradiction") {
      summary = `Reporting across publications contradicts this assertion or presents conflicting figures.`;
    } else if (findingType === "additional_context") {
      summary = `Publications clarify important qualifications or conditions not present in the headline.`;
    } else {
      summary = `Information remains unresolved across examined public reporting.`;
    }

    claimsCompared.push({
      claimId: claim.id,
      claimText: claim.text,
      findingType,
      dimension,
      summary,
      agreedPoints,
      conflictingPoints,
      unresolvedPoints,
      evidenceIds: claimEval?.evidenceIds || [],
      independentSourcesCount: claimIndepCount,
      syndicatedSourcesCount: claimSyndCount,
      sources: sourcesForClaim,
    });
  }

  // 3. Assemble overall summary
  let overallAlignment: "high" | "moderate" | "low" | "conflicted" = "high";
  if (claimsConflictingCount > 0) {
    overallAlignment = "conflicted";
  } else if (claimsUnresolvedCount > 0 && claimsAgreedCount === 0) {
    overallAlignment = "low";
  } else if (claimsAgreedCount < claims.length || syndicatedCount > independentCount) {
    overallAlignment = "moderate";
  }

  const summary =
    publications.length > 0
      ? `Cross-source analysis compared ${publications.length} distinct publication${publications.length > 1 ? "s" : ""} (${independentCount} independent, ${syndicatedCount} syndicated/wire). ${claimsAgreedCount} of ${claims.length} claims show cross-source agreement.`
      : "Insufficient external publications were available to perform multi-outlet cross-source comparison.";

  return {
    originalPublisher: originalPublisher || "unknown",
    totalPublicationsExamined: publications.length,
    independentSourcesCount: independentCount,
    syndicatedSourcesCount: syndicatedCount,
    wireAgenciesDetected,
    publications,
    claimsCompared,
    claimsAgreedCount,
    claimsConflictingCount,
    claimsUnresolvedCount,
    hasNumericalConflict: hasNumericalConflictGlobal,
    hasDirectQuoteConflict: hasDirectQuoteConflictGlobal,
    summary,
  };
}
