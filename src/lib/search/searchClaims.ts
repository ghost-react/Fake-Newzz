import {
  ClaimInput,
  ClaimSearchResult,
  Evidence,
  EvidenceSchema,
  SourceType,
} from "@/schemas/evidence";
import { RawSearchResultItem, SearchProvider } from "./provider";
import { SerperProvider } from "./serper";
import { detectStatementIntent } from "@/lib/verification/statementIntent";

/**
 * Normalizes a URL for deduplication purposes.
 * Strips tracking parameters, fragments, trailing slashes, and lowercases hostname.
 * Does not destroy the original URL presented to the user.
 */
export function normalizeUrlForDeduplication(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    // 1. Lowercase protocol and hostname
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    // 2. Remove default ports
    let port = parsed.port;
    if (
      (protocol === "http:" && port === "80") ||
      (protocol === "https:" && port === "443")
    ) {
      port = "";
    }

    // 3. Remove trailing slashes on path (except root /)
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // 4. Filter out tracking parameters while preserving functional ones
    const trackingParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref",
      "source",
      "feature",
      "ncid",
      "ved",
      "ei",
    ]);

    const filteredParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!trackingParams.has(key.toLowerCase())) {
        filteredParams.append(key, value);
      }
    });

    // 5. Sort parameters deterministically
    filteredParams.sort();
    const queryString = filteredParams.toString();

    const hostAndPort = port ? `${hostname}:${port}` : hostname;
    const queryPart = queryString ? `?${queryString}` : "";

    return `${protocol}//${hostAndPort}${pathname}${queryPart}`;
  } catch {
    // If not a valid URL, return trimmed lowercase raw string
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Common English filler and stop words to omit when extracting key entities and actions.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "at",
  "from",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "of",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "now",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "do",
  "does",
  "did",
  "doing",
  "it",
  "its",
  "they",
  "them",
  "their",
]);

/**
 * Extracts key factual tokens from claim text:
 * Numbers, currencies (₹, $, €, £), proper nouns, and significant content words.
 */
function extractKeyTokens(text: string): string[] {
  // Normalize punctuation while preserving currency and numbers
  const tokens = text
    .replace(/[“""'']/g, "")
    .replace(/[,;:.!?()[\]{}]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const keyTokens: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // Check if token contains numbers or currencies (e.g. ₹500, 500, 25%, $10M)
    const hasNumberOrCurrency = /[0-9₹$€£%]/.test(token);

    // Check if token is capitalized (likely proper noun / organization / place)
    const isCapitalized = /^[A-Z][a-zA-Z0-9-]*$/.test(token) && !STOP_WORDS.has(lower);

    // Important terminology or content word
    const isContentWord = !STOP_WORDS.has(lower) && lower.length > 2;

    if (hasNumberOrCurrency || isCapitalized || isContentWord) {
      if (!seen.has(lower)) {
        seen.add(lower);
        keyTokens.push(token);
      }
    }
  }

  return keyTokens;
}

/**
 * Generates deterministic search queries faithfully from an Atomic Claim.
 *
 * Query limit strictly depends on importance:
 * - HIGH importance: max 3 queries
 * - MEDIUM importance: max 2 queries
 * - LOW importance: max 1 query
 *
 * Discovery variations:
 * - Query 1: Direct clean claim search
 * - Query 2: Important entities + event keywords
 * - Query 3: Important entities + official/primary source terminology
 *
 * Strictly preserves claim facts without adding subjective verdicts (true/false/fact check).
 */
export function generateSearchQueries(claim: ClaimInput): string[] {
  const cleanClaim = claim.text
    .trim()
    .replace(/[“""'']/g, "")
    .replace(/\s+/g, " ");

  const maxQueries =
    claim.importance === "high" ? 3 : claim.importance === "medium" ? 2 : 1;

  const queries: string[] = [];
  const seenQueries = new Set<string>();

  const addQuery = (q: string) => {
    const trimmed = q.trim().replace(/\s+/g, " ");
    const normalizedKey = trimmed.toLowerCase();
    if (trimmed && !seenQueries.has(normalizedKey)) {
      seenQueries.add(normalizedKey);
      queries.push(trimmed);
    }
  };

  // Specialized search query generation for statement attribution and quotations
  const statementIntent = detectStatementIntent(claim.text);
  const isStatementAttribution =
    claim.claimType === "statement_attribution" ||
    claim.claimType === "quotation_accuracy" ||
    statementIntent.isAttributedStatement;

  if (isStatementAttribution && (statementIntent.speaker || claim.text.includes("made the public statement"))) {
    let speaker = statementIntent.speaker;
    let quote = statementIntent.quote;

    if (!speaker || !quote) {
      const match = claim.text.match(/^(.+?)\s+made the public statement:\s*["“'‘](.+?)["”'’]$/);
      if (match) {
        speaker = match[1].trim();
        quote = match[2].trim();
      }
    }

    if (speaker && quote) {
      const cleanQuote = quote.replace(/[“""'']/g, "").trim();
      const quoteWords = cleanQuote.split(/\s+/).slice(0, 7).join(" ");

      // Query 1: Speaker with quote phrase
      addQuery(`${speaker} "${quoteWords}"`);
      addQuery(`${speaker} ${quoteWords}`);

      if (maxQueries > 1) {
        // Query 2: Speaker + quote terms + speech / video / statement
        addQuery(`${speaker} ${quoteWords} speech video statement`);
      }

      if (maxQueries > 2) {
        // Query 3: Speaker + quote terms + news coverage
        addQuery(`${speaker} ${quoteWords} news report`);
      }

      return queries.slice(0, maxQueries);
    }
  }

  // Specialized search query generation for factual propositions
  if (claim.claimType === "factual_proposition") {
    const propText = cleanClaim.replace(/^factual proposition in statement:\s*/i, "").trim();
    addQuery(propText);
    const tokens = extractKeyTokens(propText);
    if (tokens.length >= 2) {
      if (maxQueries > 1) {
        addQuery(`${tokens.slice(0, 6).join(" ")} report data`);
      }
      if (maxQueries > 2) {
        addQuery(`${tokens.slice(0, 6).join(" ")} fact check`);
      }
    }
    return queries.slice(0, maxQueries);
  }

  // 1. Query 1: Direct claim search (faithful, clean)
  // Strip trailing period if present
  const directQuery = cleanClaim.replace(/[.]+$/, "");
  addQuery(directQuery);

  if (maxQueries > 1) {
    // 2. Query 2: Important entities + event keywords (focused representation)
    const tokens = extractKeyTokens(cleanClaim);
    if (tokens.length >= 2) {
      // Prioritize tokens with numbers/currency, proper nouns, and action verbs up to 8 terms
      const entityEventQuery = tokens.slice(0, 8).join(" ");
      addQuery(entityEventQuery);
    } else {
      addQuery(directQuery);
    }
  }

  if (maxQueries > 2) {
    // 3. Query 3: Broad entity + key event query for multi-outlet discovery
    const tokens = extractKeyTokens(cleanClaim);
    const highValueTokens = tokens.filter(
      (t) => /[0-9₹$€£%]/.test(t) || /^[A-Z]/.test(t)
    );
    const otherTokens = tokens.filter((t) => !highValueTokens.includes(t));
    const broadTokens = [...highValueTokens, ...otherTokens].slice(0, 6);

    if (broadTokens.length >= 2) {
      addQuery(broadTokens.join(" "));
    } else {
      const entityTerms = tokens.slice(0, 5).join(" ");
      if (entityTerms) {
        addQuery(`${entityTerms} official`);
      } else {
        addQuery(`${directQuery} official`);
      }
    }
  }

  return queries.slice(0, maxQueries);
}

/**
 * Classifies a source publisher domain and URL into a standardized SourceType:
 * OFFICIAL, PRIMARY_DOCUMENT, WIRE, NATIONAL_NEWS, REGIONAL_NEWS,
 * INTERNATIONAL_NEWS, FACT_CHECK, RESEARCH, BLOG, SOCIAL, OTHER.
 *
 * This classification is purely structural and organizational; it carries NO veracity bias.
 */
export function classifySourceType(domain: string, url: string): string {
  const d = domain.toLowerCase();
  const u = url.toLowerCase();

  // Primary Documents (PDFs, official gazettes, legal rulings, direct decrees)
  if (
    u.endsWith(".pdf") ||
    u.includes("/gazette") ||
    u.includes("/notifications/") ||
    u.includes("/circulars/") ||
    u.includes("/orders/") ||
    u.includes("/decrees/")
  ) {
    return "PRIMARY_DOCUMENT";
  }

  // Official (Government, international public organizations, embassies)
  if (
    d.endsWith(".gov") ||
    d.includes(".gov.") ||
    d.endsWith(".nic.in") ||
    d.endsWith(".mil") ||
    d.includes("pib.gov.in") ||
    d.includes("who.int") ||
    d.includes("un.org") ||
    d.includes("worldbank.org") ||
    d.includes("imf.org")
  ) {
    return "OFFICIAL";
  }

  // Fact-checking organizations
  if (
    d.includes("snopes.com") ||
    d.includes("altnews.in") ||
    d.includes("boomlive.in") ||
    d.includes("politifact.com") ||
    d.includes("factcheck.org") ||
    d.includes("fullfact.org") ||
    d.includes("vishvasnews.com")
  ) {
    return "FACT_CHECK";
  }

  // Wire services
  if (
    d.includes("reuters.com") ||
    d.includes("apnews.com") ||
    d.includes("afp.com") ||
    d.includes("bloomberg.com") ||
    d.includes("pti.in") ||
    d.includes("ani.in")
  ) {
    return "WIRE";
  }

  // Research & Academic
  if (
    d.includes("nature.com") ||
    d.includes("sciencedirect.com") ||
    d.includes("arxiv.org") ||
    d.includes("nih.gov") ||
    d.includes("ncbi.nlm.nih.gov") ||
    d.includes("thelancet.com") ||
    d.includes("cell.com") ||
    d.includes("biorxiv.org") ||
    d.includes("medrxiv.org") ||
    d.includes("jstor.org") ||
    d.endsWith(".edu") ||
    d.includes(".ac.")
  ) {
    return "RESEARCH";
  }

  // Social media
  if (
    d.includes("twitter.com") ||
    d.includes("x.com") ||
    d.includes("facebook.com") ||
    d.includes("instagram.com") ||
    d.includes("reddit.com") ||
    d.includes("youtube.com") ||
    d.includes("tiktok.com") ||
    d.includes("linkedin.com") ||
    d.includes("t.me")
  ) {
    return "SOCIAL";
  }

  // Blogs & Independent newsletters
  if (
    d.includes("medium.com") ||
    d.includes("substack.com") ||
    d.includes("wordpress.com") ||
    d.includes("blogspot.com") ||
    d.includes("tumblr.com")
  ) {
    return "BLOG";
  }

  // International News
  if (
    d.includes("bbc.com") ||
    d.includes("bbc.co.uk") ||
    d.includes("cnn.com") ||
    d.includes("nytimes.com") ||
    d.includes("theguardian.com") ||
    d.includes("aljazeera.com") ||
    d.includes("wsj.com") ||
    d.includes("washingtonpost.com") ||
    d.includes("dw.com") ||
    d.includes("france24.com") ||
    d.includes("ft.com")
  ) {
    return "INTERNATIONAL_NEWS";
  }

  // National News
  if (
    d.includes("thehindu.com") ||
    d.includes("indianexpress.com") ||
    d.includes("hindustantimes.com") ||
    d.includes("ndtv.com") ||
    d.includes("indiatoday.in") ||
    d.includes("timesofindia.indiatimes.com") ||
    d.includes("news18.com") ||
    d.includes("livemint.com") ||
    d.includes("economictimes.indiatimes.com") ||
    d.includes("swarajyamag.com") ||
    d.includes("theprint.in") ||
    d.includes("thewire.in")
  ) {
    return "NATIONAL_NEWS";
  }

  // Regional News
  if (
    d.includes("deccanherald.com") ||
    d.includes("tribuneindia.com") ||
    d.includes("telegraphindia.com") ||
    d.includes("mathrubhumi.com") ||
    d.includes("manoramaonline.com") ||
    d.includes("eenadu.net") ||
    d.includes("dinamalar.com") ||
    d.includes("anandabazar.com") ||
    d.includes("lokmat.com") ||
    d.includes("punjabkesari.in")
  ) {
    return "REGIONAL_NEWS";
  }

  return "OTHER";
}

/**
 * Number words and numeric patterns to strip from event-level queries.
 */
const EVENT_NUMBER_WORDS_REGEX =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\b/gi;
const EVENT_DIGITS_REGEX = /\b\d+(?:[.,]\d+)?%?\b/g;
const EVENT_CURRENCY_REGEX = /[₹$€£]\s*\d+(?:[.,]\d+)?/g;

/**
 * Action keywords indicating major events, legal proceedings, investigations, and public occurrences.
 */
const EVENT_ACTION_KEYWORDS = new Set([
  "plea", "petition", "hearing", "court", "ruling", "judge", "bench", "order",
  "dead", "death", "suicide", "murder", "killed", "found", "arrest", "arrested",
  "police", "probe", "investigation", "alleged", "alleges", "scam", "fraud",
  "surge", "airfare", "airfares", "price", "prices", "hike", "cap", "capping",
  "crash", "fire", "accident", "strike", "protest", "minister", "ministry",
  "passed", "approved", "rejected", "declined", "dismissed", "announces", "discovery"
]);

/**
 * Generates 2-3 broad EVENT-LEVEL queries from key entities, location, and action.
 * Strictly contains NO quotes and NO claim-specific numbers or numeric measurements,
 * allowing discovery of multi-outlet coverage even when phrasing and specific figures differ.
 */
export function generateEventLevelQueries(
  claims: ClaimInput[],
  articleContext?: { title?: string; text?: string }
): string[] {
  const textSources: string[] = [];
  if (articleContext?.title) textSources.push(articleContext.title);
  if (articleContext?.text) textSources.push(articleContext.text.slice(0, 500));
  for (const c of claims) {
    textSources.push(c.text);
  }

  const combinedText = textSources.join(" ");

  // 1. Strip quotes, numbers, currency symbols, and numeric words
  const sanitized = combinedText
    .replace(/[“""'']/g, " ")
    .replace(EVENT_CURRENCY_REGEX, " ")
    .replace(EVENT_DIGITS_REGEX, " ")
    .replace(EVENT_NUMBER_WORDS_REGEX, " ")
    .replace(/[,;:!?()[\]{}]/g, " ");

  // 2. Identify proper nouns, capitalized entities, locations, and actions
  const words = sanitized.split(/\s+/).filter(Boolean);

  const entities: string[] = [];
  const actionTerms: string[] = [];
  const seenWords = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lower = w.toLowerCase();

    // Skip if token has any remaining digit or is too short
    if (/\d/.test(w) || lower.length <= 2) continue;
    if (STOP_WORDS.has(lower)) continue;

    // Capitalized proper noun / entity / location
    if (/^[A-Z][a-zA-Z0-9-]*$/.test(w)) {
      if (!seenWords.has(lower)) {
        seenWords.add(lower);
        // Lookahead for multi-word proper nouns (e.g., "Supreme Court", "High Court")
        if (
          i + 1 < words.length &&
          /^[A-Z][a-zA-Z0-9-]*$/.test(words[i + 1]) &&
          !STOP_WORDS.has(words[i + 1].toLowerCase())
        ) {
          entities.push(`${w} ${words[i + 1]}`);
          seenWords.add(words[i + 1].toLowerCase());
          i++;
        } else {
          entities.push(w);
        }
      }
    } else if (
      EVENT_ACTION_KEYWORDS.has(lower) ||
      lower.endsWith("ing") ||
      lower.endsWith("ed")
    ) {
      if (!seenWords.has(lower)) {
        seenWords.add(lower);
        actionTerms.push(lower);
      }
    }
  }

  const queries: string[] = [];
  const seenQueries = new Set<string>();

  const addEventQuery = (q: string) => {
    // Ensure clean, strictly NO numbers, NO quotes, 3 to 7 words
    const clean = q
      .replace(/[“""'']/g, "")
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;
    const tokens = clean.split(" ");
    if (tokens.length < 2) return;
    const lower = clean.toLowerCase();
    if (!seenQueries.has(lower) && queries.length < 3) {
      seenQueries.add(lower);
      queries.push(clean);
    }
  };

  // Query 1: Primary Entity + Core Actions
  if (entities.length > 0) {
    const primaryEntity = entities[0];
    const primaryActions = actionTerms.slice(0, 3).join(" ");
    if (primaryActions) {
      addEventQuery(`${primaryEntity} ${primaryActions}`);
    } else if (entities.length > 1) {
      addEventQuery(`${primaryEntity} ${entities[1]}`);
    } else {
      addEventQuery(`${primaryEntity} news report`);
    }
  }

  // Query 2: Multiple Entities OR Entity + Secondary Actions
  if (entities.length >= 2) {
    const secondaryActions = actionTerms.slice(1, 4).join(" ");
    addEventQuery(`${entities[0]} ${entities[1]} ${secondaryActions}`);
  } else if (entities.length === 1 && actionTerms.length >= 2) {
    addEventQuery(`${entities[0]} ${actionTerms.slice(1, 4).join(" ")}`);
  }

  // Query 3: Broader action & location/entity keywords
  const combinedTokens = [...entities, ...actionTerms].slice(0, 6).join(" ");
  if (combinedTokens) {
    addEventQuery(combinedTokens);
  }

  // Fallback: If still fewer than 2 queries, use sanitized clean claim text without numbers
  if (queries.length < 2 && claims.length > 0) {
    const fallbackWords = claims[0].text
      .replace(/[“""'']/g, "")
      .replace(EVENT_CURRENCY_REGEX, " ")
      .replace(EVENT_DIGITS_REGEX, " ")
      .replace(EVENT_NUMBER_WORDS_REGEX, " ")
      .replace(/[,;:!?()[\]{}]/g, " ")
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length > 2 && !/\d/.test(w))
      .slice(0, 6);

    if (fallbackWords.length >= 2) {
      addEventQuery(fallbackWords.join(" "));
    }
  }

  return queries.slice(0, 3);
}

/**
 * Generates an official/primary-source discovery query per story
 * (targeting government sites, official statements, court records, agency feeds).
 */
export function generateOfficialSourceQuery(
  claims: ClaimInput[],
  articleContext?: { title?: string; text?: string }
): string | null {
  const textSources: string[] = [];
  if (articleContext?.title) textSources.push(articleContext.title);
  for (const c of claims) {
    if (c.importance === "high" || c.layer === "event_occurred" || c.layer === "statement_made") {
      textSources.push(c.text);
    }
  }
  const text = textSources.join(" ");
  const tokens = extractKeyTokens(text);
  const entities = tokens.filter((t) => /^[A-Z]/.test(t) || !STOP_WORDS.has(t.toLowerCase())).slice(0, 5);
  if (entities.length >= 2) {
    return `${entities.join(" ")} official statement government court`;
  }
  return null;
}

export interface SearchMultipleClaimsOptions {
  limit?: number;
  timeoutMs?: number;
  maxTotalQueries?: number;
  articleContext?: { title?: string; text?: string };
}

/**
 * Performs search and evidence retrieval for an individual atomic claim.
 * Executes queries through the search provider, normalizes results into Evidence objects,
 * deduplicates URLs, and handles partial failures without discarding valid evidence.
 */
export async function searchClaim(
  claim: ClaimInput,
  provider: SearchProvider,
  options?: { limit?: number; timeoutMs?: number }
): Promise<ClaimSearchResult> {
  const queries = generateSearchQueries(claim);
  const rawResults: RawSearchResultItem[] = [];
  let successfulQueries = 0;
  let failedQueries = 0;

  for (const query of queries) {
    try {
      const items = await provider.search(query, {
        limit: options?.limit ?? 5,
        timeoutMs: options?.timeoutMs ?? 8000,
      });
      rawResults.push(...items);
      successfulQueries++;
    } catch {
      failedQueries++;
      // Partial failure tolerance: continue searching other queries for this claim
    }
  }

  // Deduplicate and normalize into strict Evidence objects
  const seenNormalizedUrls = new Set<string>();
  const evidenceList: Evidence[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const item = rawResults[i];
    const normUrl = normalizeUrlForDeduplication(item.url);

    if (seenNormalizedUrls.has(normUrl)) {
      continue;
    }
    seenNormalizedUrls.add(normUrl);

    const evidenceCandidate = {
      id: `ev-${claim.id}-${evidenceList.length + 1}`,
      claimId: claim.id,
      title: item.title,
      url: item.url,
      domain: item.domain,
      snippet: item.snippet,
      publishedAt: item.publishedAt,
      sourceRelationship: "unknown" as const,
      relationship: "unknown" as const,
      sourceType: classifySourceType(item.domain, item.url),
      contentDepth: "snippet" as const,
    };

    const parsed = EvidenceSchema.safeParse(evidenceCandidate);
    if (parsed.success) {
      evidenceList.push(parsed.data);
    }
  }

  let status: "success" | "partial_failure" | "no_results" = "success";
  if (failedQueries > 0 && successfulQueries > 0) {
    status = "partial_failure";
  } else if (evidenceList.length === 0) {
    status = "no_results";
  }

  return {
    claimId: claim.id,
    queries,
    evidence: evidenceList,
    status,
  };
}

/**
 * Orchestrates evidence retrieval across multiple claims:
 * 1. Generates 2-3 broad event-level queries (without numbers or quotes).
 * 2. Generates claim-level queries (preserving named entities, dates, numbers).
 * 3. Deduplicates queries and caps total queries per run (configurable, default 8).
 * 4. Executes queries with the search provider.
 * 5. Assembles diverse multi-outlet evidence sets (targeting 4-8 distinct domains where available).
 */
export async function searchMultipleClaims(
  claims: ClaimInput[],
  provider?: SearchProvider,
  options?: SearchMultipleClaimsOptions
): Promise<ClaimSearchResult[]> {
  const searchProvider = provider ?? new SerperProvider();
  const maxTotalQueries = options?.maxTotalQueries ?? 8;
  const itemLimit = options?.limit ?? 5;
  const timeoutMs = options?.timeoutMs ?? 10000;

  // 1. Generate Event-Level Queries (2-3 queries, no numbers, no quotes)
  const eventQueries = generateEventLevelQueries(claims, options?.articleContext);

  // 2. Generate per-claim queries (preserving entities, dates, numbers)
  const claimQueriesMap = new Map<string, string[]>();
  for (const claim of claims) {
    claimQueriesMap.set(claim.id, generateSearchQueries(claim));
  }

  // 3. Deduplicate queries across the entire run and cap to maxTotalQueries (default 8)
  const orderedQueries: string[] = [];
  const seenQueryNorm = new Set<string>();

  const addCappedQuery = (q: string) => {
    const norm = q.trim().toLowerCase();
    if (norm && !seenQueryNorm.has(norm) && orderedQueries.length < maxTotalQueries) {
      seenQueryNorm.add(norm);
      orderedQueries.push(q.trim());
    }
  };

  // Prioritize event queries first
  for (const eq of eventQueries) {
    addCappedQuery(eq);
  }

  // Add official-source discovery query per story (Prompt 10)
  const officialQuery = generateOfficialSourceQuery(claims, options?.articleContext);
  if (officialQuery) {
    addCappedQuery(officialQuery);
  }

  // Then add per-claim queries in claim importance order
  for (const claim of claims) {
    const cQueries = claimQueriesMap.get(claim.id) || [];
    for (const cq of cQueries) {
      addCappedQuery(cq);
    }
  }

  // 4. Execute queries via searchProvider (cache results by query)
  const queryResultsCache = new Map<string, RawSearchResultItem[]>();
  const queryStatusMap = new Map<string, boolean>();

  for (const query of orderedQueries) {
    try {
      const items = await searchProvider.search(query, {
        limit: itemLimit,
        timeoutMs,
      });
      queryResultsCache.set(query, items);
      queryStatusMap.set(query, true);
    } catch {
      queryResultsCache.set(query, []);
      queryStatusMap.set(query, false);
    }
  }

  // 5. Build results per claim
  const results: ClaimSearchResult[] = [];

  for (const claim of claims) {
    const directClaimQueries = claimQueriesMap.get(claim.id) || [];
    // Collect all queries relevant to this claim (event queries + claim queries)
    const claimActiveQueries = orderedQueries.filter(
      (q) => directClaimQueries.includes(q) || eventQueries.includes(q)
    );

    // Aggregate raw results
    const rawItems: RawSearchResultItem[] = [];
    for (const q of claimActiveQueries) {
      const cached = queryResultsCache.get(q) || [];
      rawItems.push(...cached);
    }

    // Deduplicate URLs strictly by canonical URL
    const seenNormalizedUrls = new Set<string>();
    const uniqueRawItems: RawSearchResultItem[] = [];
    for (const item of rawItems) {
      const normUrl = normalizeUrlForDeduplication(item.url);
      if (!seenNormalizedUrls.has(normUrl)) {
        seenNormalizedUrls.add(normUrl);
        uniqueRawItems.push(item);
      }
    }

    // Ensure source breadth: target 4-8 distinct domains where available
    const byDomain = new Map<string, RawSearchResultItem[]>();
    for (const item of uniqueRawItems) {
      const dom = item.domain.toLowerCase().replace(/^www\./, "");
      if (!byDomain.has(dom)) {
        byDomain.set(dom, []);
      }
      byDomain.get(dom)!.push(item);
    }

    // Round-robin pick from distinct domains first to guarantee domain diversity
    const prioritizedItems: RawSearchResultItem[] = [];
    const domainQueues = Array.from(byDomain.values());
    let addedInPass = true;
    while (addedInPass) {
      addedInPass = false;
      for (const queue of domainQueues) {
        if (queue.length > 0) {
          prioritizedItems.push(queue.shift()!);
          addedInPass = true;
        }
      }
    }

    // Convert to Evidence objects
    const evidenceList: Evidence[] = [];
    for (let i = 0; i < prioritizedItems.length; i++) {
      const item = prioritizedItems[i];
      const evidenceCandidate = {
        id: `ev-${claim.id}-${evidenceList.length + 1}`,
        claimId: claim.id,
        title: item.title,
        url: item.url,
        domain: item.domain,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
        sourceRelationship: "unknown" as const,
        relationship: "unknown" as const,
        sourceType: classifySourceType(item.domain, item.url),
        contentDepth: "snippet" as const,
      };

      const parsed = EvidenceSchema.safeParse(evidenceCandidate);
      if (parsed.success) {
        evidenceList.push(parsed.data);
      }
    }

    let status: "success" | "partial_failure" | "no_results" = "success";
    const failedCount = claimActiveQueries.filter((q) => queryStatusMap.get(q) === false).length;
    const successCount = claimActiveQueries.filter((q) => queryStatusMap.get(q) === true).length;

    if (failedCount > 0 && successCount > 0) {
      status = "partial_failure";
    } else if (evidenceList.length === 0) {
      status = "no_results";
    }

    results.push({
      claimId: claim.id,
      queries: claimActiveQueries,
      evidence: evidenceList,
      status,
    });
  }

  return results;
}
