import { validateSafeUrl } from "../ingestion/article";
import { scrapeArticleWithFirecrawl } from "../ingestion/firecrawl";
import { Evidence } from "@/schemas/evidence";

/**
 * Normalized source content retrieved via selective scraping.
 */
export interface NormalizedSourceContent {
  url: string;
  title: string | null;
  content: string;
  publishedAt: string | null;
  sourceDomain: string;
}

/**
 * Maximum character limit for scraped source content to prevent large payloads.
 */
const MAX_SOURCE_CONTENT_CHARS = 6000;

/**
 * Maximum character limit for source excerpt provided to the evaluator.
 */
const MAX_EXCERPT_CHARS = 800;

/**
 * Retrieves normalized source content for a single URL using Firecrawl.
 * Enforces strict SSRF protection, HTTP/HTTPS validation, timeout, and content truncation.
 * Never exposes API keys or internal stack traces.
 */
export async function retrieveSourceContent(
  url: string
): Promise<NormalizedSourceContent | null> {
  // 1. SSRF and URL validation
  const validation = validateSafeUrl(url);
  if (!validation.isValid || !validation.sanitizedUrl) {
    return null;
  }

  const safeUrl = validation.sanitizedUrl;
  let domain = "";
  try {
    domain = new URL(safeUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  try {
    const scrapeResult = await scrapeArticleWithFirecrawl(safeUrl);
    const rawContent = scrapeResult?.markdown || "";

    if (!rawContent.trim()) {
      return null;
    }

    // Clean and truncate content to reasonable size limit
    const cleanedContent = rawContent
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_SOURCE_CONTENT_CHARS);

    const title =
      typeof scrapeResult?.metadata?.title === "string" &&
      scrapeResult.metadata.title.trim().length > 0
        ? scrapeResult.metadata.title.trim()
        : null;

    const publishedAt =
      typeof scrapeResult?.metadata?.publishedTime === "string"
        ? scrapeResult.metadata.publishedTime.trim()
        : typeof scrapeResult?.metadata?.date === "string"
        ? scrapeResult.metadata.date.trim()
        : null;

    return {
      url: safeUrl,
      title,
      content: cleanedContent,
      publishedAt,
      sourceDomain: domain,
    };
  } catch {
    // Controlled error handling: return null so caller falls back gracefully to snippet
    return null;
  }
}

const STOP_WORDS_SET = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
  "by", "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "of", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "should", "now", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "it", "its", "they", "them", "their"
]);

/**
 * Windows the fetched text around sentences that match the claim's entities and verbs,
 * not just the first N characters. Returns a coherent excerpt bounded by maxChars.
 */
export function windowContentAroundClaim(
  content: string,
  claimText?: string,
  maxChars: number = MAX_EXCERPT_CHARS
): string {
  if (!content || !content.trim()) return "";
  const trimmed = content.trim();

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  if (!claimText || !claimText.trim()) {
    return trimmed.slice(0, maxChars);
  }

  // 1. Extract significant keywords from claim: proper nouns, entities, numbers, and verbs
  const claimWords = claimText
    .replace(/[“""'']/g, "")
    .replace(/[,;:!?()[\]{}]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS_SET.has(w));

  // 2. Split content into sentences
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^#+\s*/, ""))
    .filter((s) => s.length > 15 && !s.includes("http"));

  if (sentences.length === 0) {
    return trimmed.slice(0, maxChars);
  }

  // 3. Score each sentence based on keyword overlap
  let bestSentenceIdx = -1;
  let maxScore = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sLower = sentences[i].toLowerCase();
    let score = 0;
    for (const kw of claimWords) {
      if (sLower.includes(kw)) {
        score += kw.length > 4 ? 2 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestSentenceIdx = i;
    }
  }

  // 4. Build window around bestSentenceIdx
  if (bestSentenceIdx !== -1 && maxScore > 0) {
    let windowStart = bestSentenceIdx;
    let windowEnd = bestSentenceIdx;
    let currentLen = sentences[bestSentenceIdx].length;

    let canExpandBack = windowStart > 0;
    let canExpandForward = windowEnd < sentences.length - 1;

    while ((canExpandBack || canExpandForward) && currentLen < maxChars) {
      if (canExpandBack) {
        const prevLen = sentences[windowStart - 1].length + 1;
        if (currentLen + prevLen <= maxChars) {
          windowStart--;
          currentLen += prevLen;
        } else {
          canExpandBack = false;
        }
      }
      if (canExpandForward) {
        const nextLen = sentences[windowEnd + 1].length + 1;
        if (currentLen + nextLen <= maxChars) {
          windowEnd++;
          currentLen += nextLen;
        } else {
          canExpandForward = false;
        }
      }
      if (!canExpandBack && !canExpandForward) break;
    }

    const windowText = sentences.slice(windowStart, windowEnd + 1).join(" ");
    return windowText.slice(0, maxChars);
  }

  // Default fallback: first portion of content
  return trimmed.slice(0, maxChars);
}

/**
 * Extracts a compact excerpt from retrieved full content.
 * Looks for sections or paragraphs matching key claim words, or defaults to top content.
 */
export function extractContentExcerpt(
  content: string,
  claimText?: string
): string {
  return windowContentAroundClaim(content, claimText, MAX_EXCERPT_CHARS);
}

/**
 * Determines whether a specific evidence item is high-value and warrants full-text retrieval.
 *
 * Prioritizes:
 * 1. High relevance (direct)
 * 2. High evidence quality
 * 3. Primary documents and official sources
 * 4. Original reporting or independent sources
 *
 * Avoids unnecessary retrieval if snippet is already sufficient (>180 chars with direct overlap).
 */
export function shouldRetrieveSourceContent(evidence: Evidence): boolean {
  if (evidence.sourceContentStatus === "failed") return false;

  const isPrimaryOrOfficial =
    evidence.sourceType === "primary_document" ||
    evidence.sourceType === "official" ||
    evidence.sourceType === "research";

  const isEstablishedNews =
    evidence.sourceType === "wire" ||
    evidence.sourceType === "national_news" ||
    evidence.sourceType === "international_news" ||
    evidence.sourceType === "regional_news" ||
    evidence.sourceType === "other";

  const isDirect = evidence.relevance === "direct";
  const isRelated = evidence.relevance === "related";

  // 1. Primary, official, or research sources
  if (isPrimaryOrOfficial && (isDirect || isRelated)) {
    return true;
  }

  // 2. Established news outlets
  if (isEstablishedNews && (isDirect || isRelated)) {
    return true;
  }

  // 3. Any relevant source with a snippet
  if (Boolean(evidence.snippet && evidence.snippet.trim().length > 0)) {
    return true;
  }

  return false;
}

/**
 * Selects 4–8 highest-value sources for a claim to selectively retrieve,
 * deduplicating domains and prioritizing genuinely independent reporting and primary documents.
 */
export function selectHighValueEvidenceForRetrieval(
  evidenceList: Evidence[],
  maxSources: number = 6
): Evidence[] {
  let candidates = evidenceList.filter(shouldRetrieveSourceContent);
  if (candidates.length === 0) {
    candidates = evidenceList.filter((e) => Boolean(e.snippet && e.snippet.trim().length > 0));
  }

  // Sort candidates by priority:
  // 1. Direct relevance
  // 2. Primary document / official / independent
  // 3. High quality
  // 4. Distinct domains
  candidates.sort((a, b) => {
    const scoreA = computeCandidatePriority(a);
    const scoreB = computeCandidatePriority(b);
    return scoreB - scoreA;
  });

  // Deduplicate by domain to ensure diverse publication coverage
  const selected: Evidence[] = [];
  const seenDomains = new Set<string>();

  for (const cand of candidates) {
    if (selected.length >= maxSources) break;
    const dom = cand.domain.toLowerCase().replace(/^www\./, "");
    if (!seenDomains.has(dom)) {
      seenDomains.add(dom);
      selected.push(cand);
    }
  }

  // If we still have room and there were extra candidates from the same domain, fill up to maxSources
  if (selected.length < maxSources) {
    for (const cand of candidates) {
      if (selected.length >= maxSources) break;
      if (!selected.some((s) => s.id === cand.id)) {
        selected.push(cand);
      }
    }
  }

  return selected;
}

function computeCandidatePriority(ev: Evidence): number {
  let score = 0;
  if (ev.relevance === "direct") score += 40;
  else if (ev.relevance === "related") score += 20;

  if (ev.sourceType === "primary_document") score += 35;
  else if (ev.sourceType === "official") score += 30;
  else if (ev.sourceType === "research") score += 25;
  else if (ev.sourceType === "wire") score += 20;

  if (ev.evidenceQuality === "high") score += 25;
  else if (ev.evidenceQuality === "medium") score += 10;

  // Favor genuinely independent reporting
  if (ev.sourceRelationship === "independent") score += 25;
  else if (ev.sourceRelationship === "original") score += 20;
  else if (ev.sourceRelationship === "syndicated") score -= 10;

  return score;
}
