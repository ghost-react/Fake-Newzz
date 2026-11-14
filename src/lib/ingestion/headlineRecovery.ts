import { SearchProvider } from "../search/provider";

export type HeadlineSource = "metadata" | "url_search" | "url_slug";

export interface HeadlineRecoveryResult {
  headline: string;
  snippet?: string;
  headlineSource: HeadlineSource;
  confidenceCap?: "low";
  reason?: string;
}

const BLOCKED_PAGE_PATTERNS = [
  "access denied",
  "403 forbidden",
  "401 unauthorized",
  "forbidden",
  "404 not found",
  "page not found",
  "attention required",
  "just a moment",
  "cloudflare",
  "robot check",
  "security check",
  "bot detection",
  "blocked",
  "enable cookies",
  "captcha",
  "verify you are human",
  "subscribe to read",
  "sign in",
  "log in",
  "terms of service",
  "are you a human",
  "incident id",
  "shieldsquare",
  "imperva",
  "distil networks",
];

/**
 * Checks whether a candidate headline/title string is actually an anti-bot or error page title.
 */
export function isBlockedPageTitle(title: unknown): boolean {
  if (!title || typeof title !== "string") return true;
  const lower = title.toLowerCase().trim();
  if (lower.length < 5) return true;
  return BLOCKED_PAGE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Extracts and cleans a headline from a URL slug.
 * Strips IDs, file extensions, hyphens, and underscores; preserves named entities and numbers.
 * Returns null if the slug contains only numeric IDs or fewer than 3 words.
 */
export function extractHeadlineFromUrlSlug(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    // Filter out common non-slug segments and purely numeric/id segments
    const candidateSegments: string[] = [];
    for (const seg of segments) {
      const cleanSeg = seg.replace(/\.(cms|html|htm|php|asp|aspx)$/i, "").trim();
      // Skip if purely numeric (e.g. article ID like 108345678 or 20240501)
      if (/^\d+$/.test(cleanSeg)) continue;
      // Skip if common short category paths
      const lower = cleanSeg.toLowerCase();
      if (
        [
          "news",
          "article",
          "articles",
          "articleshow",
          "story",
          "stories",
          "post",
          "posts",
          "category",
          "item",
          "view",
          "india",
          "world",
          "politics",
          "opinion",
        ].includes(lower)
      ) {
        continue;
      }
      candidateSegments.push(cleanSeg);
    }

    if (candidateSegments.length === 0) return null;

    // Find the longest segment containing hyphens, underscores, or word-like characters
    let bestSegment = "";
    for (const seg of candidateSegments) {
      if (seg.includes("-") || seg.includes("_")) {
        if (seg.length > bestSegment.length) {
          bestSegment = seg;
        }
      }
    }

    // Fallback to the last candidate segment if none had hyphens/underscores
    if (!bestSegment && candidateSegments.length > 0) {
      bestSegment = candidateSegments[candidateSegments.length - 1];
    }

    if (!bestSegment) return null;

    // Convert hyphens/underscores/camelCase to spaces
    const words = bestSegment
      .replace(/[-_]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Remove standalone numeric IDs of 5+ digits
      .replace(/\b\d{5,}\b/g, "")
      .trim();

    // Check if the resulting string has at least 3 distinct words and minimum length
    const tokens = words.split(/\s+/).filter(Boolean);
    if (tokens.length < 3 || words.length < 12) {
      return null;
    }

    // Must contain some alphabetic letters
    if (!/[a-zA-Z]/.test(words)) {
      return null;
    }

    // Capitalize first letter
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return null;
  }
}

/**
 * Recovers a headline without reading the blocked page in strict priority order:
 * a. Any title or og:title metadata already returned by the fetch attempt
 * b. Search for the exact URL (title and snippet from search provider)
 * c. URL slug cleaned into words (marked as low confidence)
 */
export async function recoverHeadline(
  targetUrl: string,
  options?: {
    metadata?: Record<string, unknown> | null;
    searchProvider?: SearchProvider | null;
  }
): Promise<HeadlineRecoveryResult | null> {
  // 1. Priority a: Any title or og:title metadata from fetch attempt
  if (options?.metadata) {
    const meta = options.metadata;
    const candidates = [
      meta.title,
      meta.ogTitle,
      meta["og:title"],
      meta.headline,
      meta["twitter:title"],
      meta["twitter:title:src"],
    ];

    for (const cand of candidates) {
      if (typeof cand === "string") {
        const clean = cand.trim();
        if (clean.length >= 10 && !isBlockedPageTitle(clean)) {
          return {
            headline: clean,
            headlineSource: "metadata",
          };
        }
      }
    }
  }

  // 2. Priority b: Search for the exact URL
  if (options?.searchProvider) {
    try {
      const results = await options.searchProvider.search(targetUrl, { limit: 3 });
      if (results && results.length > 0) {
        for (const item of results) {
          if (item.title && item.title.trim().length >= 10 && !isBlockedPageTitle(item.title)) {
            // Remove common branding suffixes (e.g. " - Times of India", " | Reuters")
            const cleanTitle = item.title
              .replace(/\s+[-|]\s+[^-|]+$/i, "")
              .trim();
            const usableTitle = cleanTitle.length >= 10 ? cleanTitle : item.title.trim();
            return {
              headline: usableTitle,
              snippet: item.snippet?.trim() || undefined,
              headlineSource: "url_search",
            };
          }
        }
      }
    } catch {
      // Search failed or was rate-limited; proceed to slug fallback
    }
  }

  // 3. Priority c: URL slug, cleaned into words (marked low confidence)
  const slugHeadline = extractHeadlineFromUrlSlug(targetUrl);
  if (slugHeadline) {
    return {
      headline: slugHeadline,
      headlineSource: "url_slug",
      confidenceCap: "low",
    };
  }

  return null;
}

