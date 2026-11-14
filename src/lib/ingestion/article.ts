import { Article, ArticleSchema } from "../../schemas/article";
import { RawFirecrawlScrapeResult, scrapeArticleWithFirecrawl } from "./firecrawl";
import { isLikelyLogoOrTracker } from "../image/dimensions";
import { extractArticleDirectly } from "./directExtractor";

/**
 * URL and SSRF validation result
 */
export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  errorMessage?: string;
  errorCode?: "INVALID_URL" | "MISSING_URL";
}

/**
 * SSRF and URL Security Validation.
 * Blocks private IP ranges, loopback, link-local, cloud metadata, multicast, and non-http(s) schemes.
 */
export function validateSafeUrl(urlString: unknown): UrlValidationResult {
  if (typeof urlString !== "string" || !urlString.trim()) {
    return {
      isValid: false,
      errorCode: "MISSING_URL",
      errorMessage: "A URL must be provided.",
    };
  }

  const trimmed = urlString.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "Invalid URL format. Please provide a well-formed HTTP or HTTPS URL.",
    };
  }

  // 1. Enforce strict HTTP / HTTPS protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "Only HTTP and HTTPS protocols are supported.",
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Reject empty hostname
  if (!hostname) {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "URL must contain a valid domain name.",
    };
  }

  // 3. Reject localhost and internal network identifiers
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".corp") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".example") ||
    hostname.endsWith(".invalid")
  ) {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "Internal and localhost addresses are not permitted.",
    };
  }

  // 4. Reject numeric IP decimal obfuscations (e.g. http://2130706433)
  if (/^\d+$/.test(hostname)) {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "Numeric IP addresses are not permitted.",
    };
  }

  // 5. Evaluate IPv4 addresses against restricted ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, s1, s2, s3, s4] = ipv4Match;
    const o1 = Number(s1);
    const o2 = Number(s2);
    const o3 = Number(s3);
    const o4 = Number(s4);

    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Malformed IP address in URL.",
      };
    }

    // 0.0.0.0/8 (Current network)
    // 10.0.0.0/8 (RFC 1918 Private)
    // 127.0.0.0/8 (Loopback)
    if (o1 === 0 || o1 === 10 || o1 === 127) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to private or loopback IP addresses is blocked.",
      };
    }

    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to carrier-grade NAT addresses is blocked.",
      };
    }

    // 169.254.0.0/16 (Link Local / Cloud Metadata Service)
    if (o1 === 169 && o2 === 254) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to link-local and cloud metadata addresses is blocked.",
      };
    }

    // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to private IP ranges is blocked.",
      };
    }

    // 192.168.0.0/16 (RFC 1918 Private)
    if (o1 === 192 && o2 === 168) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to private IP ranges is blocked.",
      };
    }

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / Test-Net)
    if (
      (o1 === 192 && o2 === 0 && o3 === 2) ||
      (o1 === 198 && o2 === 51 && o3 === 100) ||
      (o1 === 203 && o2 === 0 && o3 === 113)
    ) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to documentation/test IP ranges is blocked.",
      };
    }

    // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved)
    if (o1 >= 224) {
      return {
        isValid: false,
        errorCode: "INVALID_URL",
        errorMessage: "Access to reserved IP ranges is blocked.",
      };
    }
  }

  // 6. Evaluate IPv6 addresses
  const cleanIpv6 = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    cleanIpv6 === "::1" ||
    cleanIpv6 === "::" ||
    cleanIpv6.startsWith("fe80:") ||
    cleanIpv6.startsWith("fc00:") ||
    cleanIpv6.startsWith("fd00:") ||
    cleanIpv6.startsWith("::ffff:127.") ||
    cleanIpv6.startsWith("::ffff:10.") ||
    cleanIpv6.startsWith("::ffff:192.168.") ||
    cleanIpv6.startsWith("::ffff:172.")
  ) {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "Access to internal IPv6 addresses is blocked.",
    };
  }

  // 7. Require domain separator dot for standard hostnames
  if (!hostname.includes(".") && !ipv4Match) {
    return {
      isValid: false,
      errorCode: "INVALID_URL",
      errorMessage: "URL must contain a valid domain name.",
    };
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
  };
}

/**
 * Extracts a normalized, clean string or returns null if absent or blank.
 */
function extractCleanString(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (
    trimmed === "" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Extracts title from Firecrawl metadata or markdown content.
 */
function extractTitle(
  metadata: Record<string, unknown>,
  markdown: string,
  targetUrl: string
): string {
  const metaTitle =
    extractCleanString(metadata.title) ||
    extractCleanString(metadata.ogTitle) ||
    extractCleanString(metadata["og:title"]) ||
    extractCleanString(metadata.headline) ||
    extractCleanString(metadata["twitter:title"]);

  if (metaTitle) {
    return metaTitle;
  }

  // Fallback: extract the first H1 from markdown
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    const heading = headingMatch[1].trim();
    if (heading) return heading;
  }

  // Fallback: Use page path/domain context or throw
  try {
    const parsed = new URL(targetUrl);
    const pathSlug = parsed.pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/[-_]/g, " ");
    if (pathSlug && pathSlug.length > 2) {
      return pathSlug.charAt(0).toUpperCase() + pathSlug.slice(1);
    }
    return parsed.hostname;
  } catch {
    return "Untitled Article";
  }
}

/**
 * Extracts author from Firecrawl metadata.
 */
function extractAuthor(metadata: Record<string, unknown>): string | null {
  const direct =
    extractCleanString(metadata.author) ||
    extractCleanString(metadata["article:author"]) ||
    extractCleanString(metadata.byline) ||
    extractCleanString(metadata.creator);

  if (direct) return direct;

  // Handle authors array
  if (Array.isArray(metadata.authors) && metadata.authors.length > 0) {
    const valid = metadata.authors
      .map(extractCleanString)
      .filter((a): a is string => Boolean(a));
    if (valid.length > 0) {
      return valid.join(", ");
    }
  }

  return null;
}

/**
 * Extracts publication date from Firecrawl metadata.
 */
function extractPublishedAt(metadata: Record<string, unknown>): string | null {
  const dateCandidate =
    extractCleanString(metadata.published_time) ||
    extractCleanString(metadata["article:published_time"]) ||
    extractCleanString(metadata.publication_date) ||
    extractCleanString(metadata.datePublished) ||
    extractCleanString(metadata.date) ||
    extractCleanString(metadata["dc.date"]);

  if (!dateCandidate) return null;

  // Attempt to parse into standard ISO string if valid date
  const parsed = new Date(dateCandidate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return dateCandidate;
}

/**
 * Helper to safely extract an image URL from various JSON-LD shapes.
 */
function extractJsonLdImage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractJsonLdImage(item);
      if (found) return found;
    }
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.url && typeof obj.url === "string") return obj.url.trim();
    if (obj.image) return extractJsonLdImage(obj.image);
    if (obj.thumbnailUrl && typeof obj.thumbnailUrl === "string") return obj.thumbnailUrl.trim();
  }
  return null;
}

/**
 * Extracts featured image URL from Firecrawl metadata, JSON-LD, or markdown content.
 * Resolves relative URLs to absolute HTTP/HTTPS URLs against targetUrl.
 */
export function extractFeaturedImage(
  metadata: Record<string, unknown>,
  targetUrl?: string,
  markdown?: string
): string | null {
  const isGoodCandidate = (url: unknown): url is string => {
    if (!url || typeof url !== "string") return false;
    const clean = url.trim();
    if (!clean) return false;
    return !isLikelyLogoOrTracker(clean);
  };

  // 1. Check standard OpenGraph & Twitter tags
  const ogCandidates = [
    extractCleanString(metadata.ogImage),
    extractCleanString(metadata["og:image"]),
    extractCleanString(metadata["og:image:url"]),
    extractCleanString(metadata["twitter:image"]),
    extractCleanString(metadata["twitter:image:src"]),
    extractCleanString(metadata.thumbnail),
  ];
  let candidate = ogCandidates.find(isGoodCandidate) || null;

  // 2. Check direct image field (string, object, or array)
  if (!candidate && metadata.image) {
    const directCandidate = extractJsonLdImage(metadata.image);
    if (isGoodCandidate(directCandidate)) {
      candidate = directCandidate;
    }
  }

  // 3. Check JSON-LD metadata fields if present
  if (!candidate) {
    const jsonLdField =
      metadata["json-ld"] ||
      metadata.jsonLd ||
      metadata.schemaOrg ||
      metadata["schema.org"];

    if (jsonLdField) {
      try {
        const parsed =
          typeof jsonLdField === "string" ? JSON.parse(jsonLdField) : jsonLdField;
        const jsonLdCandidate = extractJsonLdImage(parsed);
        if (isGoodCandidate(jsonLdCandidate)) {
          candidate = jsonLdCandidate;
        }
      } catch {}
    }
  }

  // 4. Fallback to main article image in markdown
  if (!candidate && markdown) {
    const mdImgMatch = markdown.match(/!\[.*?\]\(([^\s\)]+)\)/);
    if (mdImgMatch && mdImgMatch[1] && isGoodCandidate(mdImgMatch[1])) {
      candidate = mdImgMatch[1].trim();
    } else {
      const htmlImgMatch = markdown.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (htmlImgMatch && htmlImgMatch[1] && isGoodCandidate(htmlImgMatch[1])) {
        candidate = htmlImgMatch[1].trim();
      }
    }
  }

  if (!candidate) return null;

  // 5. Resolve relative or absolute URLs to valid HTTP/HTTPS URLs
  try {
    const resolved = targetUrl ? new URL(candidate, targetUrl) : new URL(candidate);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      return resolved.toString();
    }
  } catch {
    // Invalid URL format
  }

  return null;
}

/**
 * Normalizes raw Firecrawl output into our strict Article schema.
 * Never invents missing metadata; missing fields are set strictly to null.
 */
export function normalizeFirecrawlArticle(
  raw: RawFirecrawlScrapeResult,
  targetUrl: string
): Article {
  const metadata = raw.metadata || {};
  const rawContent = raw.markdown || "";

  // Content validation
  const cleanContent = rawContent.trim();
  if (!cleanContent) {
    const emptyErr = new Error("The extracted article contains no readable content.");
    (emptyErr as any).code = "ARTICLE_CONTENT_EMPTY";
    (emptyErr as any).metadata = metadata;
    (emptyErr as any).statusCode = raw.statusCode;
    throw emptyErr;
  }

  // Extract source domain from targetUrl
  let sourceDomain: string;
  try {
    sourceDomain = new URL(targetUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const invalidUrlErr = new Error("Invalid article URL format.");
    (invalidUrlErr as any).code = "INVALID_URL";
    throw invalidUrlErr;
  }

  // Extract metadata
  const title = extractTitle(metadata, cleanContent, targetUrl);
  const description =
    extractCleanString(metadata.description) ||
    extractCleanString(metadata.ogDescription) ||
    extractCleanString(metadata["og:description"]) ||
    extractCleanString(metadata["twitter:description"]);
  const author = extractAuthor(metadata);
  const publishedAt = extractPublishedAt(metadata);
  const featuredImage = extractFeaturedImage(metadata, targetUrl, cleanContent);

  // Compute accurate word count
  const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

  const rawCandidate = {
    url: targetUrl,
    title,
    description,
    author,
    publishedAt,
    sourceDomain,
    featuredImage,
    content: cleanContent,
    wordCount,
  };

  // Validate with strict Zod ArticleSchema
  const parseResult = ArticleSchema.safeParse(rawCandidate);

  if (!parseResult.success) {
    const validationErr = new Error(
      `Normalized article failed schema validation: ${parseResult.error.message}`
    );
    (validationErr as any).code = "MALFORMED_RESPONSE";
    throw validationErr;
  }

  return parseResult.data;
}

/**
 * High-level article ingestion workflow:
 * 1. Validates URL against SSRF and syntax rules
 * 2. Fetches article content via Firecrawl
 * 3. Normalizes and validates against strict ArticleSchema
 */
export async function ingestArticle(rawUrl: string): Promise<Article> {
  // Step 1: Validate URL and SSRF
  const urlCheck = validateSafeUrl(rawUrl);
  if (!urlCheck.isValid || !urlCheck.sanitizedUrl) {
    const err = new Error(urlCheck.errorMessage || "Invalid URL.");
    (err as any).code = urlCheck.errorCode || "INVALID_URL";
    throw err;
  }

  const targetUrl = urlCheck.sanitizedUrl;

  // Step 2: Primary: Attempt Firecrawl Scrape
  let firecrawlResult: RawFirecrawlScrapeResult | null = null;
  let firecrawlError: any = null;
  try {
    firecrawlResult = await scrapeArticleWithFirecrawl(targetUrl);
  } catch (err: any) {
    firecrawlError = err;
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[Ingestion] Firecrawl scrape failed (${err?.code || err?.message || err}). Falling back to direct readability extractor...`
      );
    }
  }

  if (firecrawlResult && firecrawlResult.markdown && firecrawlResult.markdown.trim().length >= 100) {
    try {
      const normalized = normalizeFirecrawlArticle(firecrawlResult, targetUrl);
      const isPartial =
        !normalized.author ||
        !normalized.publishedAt ||
        !normalized.featuredImage ||
        normalized.wordCount < 60;
      return {
        ...normalized,
        sourceReadStatus: isPartial ? "partial" : "success",
      };
    } catch (normErr: any) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          `[Ingestion] Firecrawl normalization failed: ${normErr?.message}. Falling back to direct readability extractor...`
        );
      }
    }
  }

  // Step 3: Direct readability & structured metadata extraction fallback
  if (process.env.NODE_ENV !== "test") {
    console.log(`[Ingestion] Fetching article directly via directExtractor for: ${targetUrl}`);
  }
  const directResult = await extractArticleDirectly(targetUrl);
  const domain = new URL(targetUrl).hostname.replace(/^www\./i, "").toLowerCase();

  if (directResult.extractionState === "success" || directResult.extractionState === "partial") {
    return {
      url: targetUrl,
      finalUrl: directResult.finalUrl,
      canonicalUrl: directResult.canonicalUrl,
      title: directResult.title,
      description: null,
      author: directResult.author,
      publishedAt: directResult.publishedAt,
      sourceDomain: domain,
      featuredImage: directResult.featuredImage,
      content: directResult.content,
      wordCount: directResult.wordCount,
      sourceReadStatus: directResult.extractionState,
      extractionReason: directResult.reason,
    };
  }

  // If both Firecrawl and direct extraction failed or yielded insufficient content (<40 words)
  const failureReason =
    directResult.reason || firecrawlError?.message || "Failed to extract readable article content.";
  const extractionError = new Error(failureReason);
  (extractionError as any).code =
    directResult.extractionState === "insufficient" ? "INSUFFICIENT_CONTENT" : "EXTRACTION_FAILED";
  (extractionError as any).extractionState = directResult.extractionState;
  (extractionError as any).metadata = {
    title: directResult.title,
    featuredImage: directResult.featuredImage,
    author: directResult.author,
    publishedAt: directResult.publishedAt,
    finalUrl: directResult.finalUrl,
  };
  throw extractionError;
}
