/**
 * Universal Input Type Detection and Parsing Module
 * Shared across client and server.
 */

export type DetectedInputType = "url" | "headline" | "claim" | "text";

export const MAX_INPUT_CHARS = 10000;

export interface InputValidationResult {
  isValid: boolean;
  valid: boolean;
  sanitized: string;
  error?: string;
  errorCode?: "EMPTY_INPUT" | "INPUT_TOO_LONG" | "INVALID_INPUT";
  errorMessage?: string;
}

export interface ExtractedUrlAndContext {
  url: string;
  surroundingContext: string;
  notice: string;
}

export interface ParsedInput {
  raw: string;
  type: DetectedInputType;
  url?: string;
  targetUrl?: string;
  extractedUrl?: string;
  surroundingContext?: string;
  notice?: string;
  headline?: string;
  text: string;
}

/**
 * Validates raw input against empty and size limits.
 * Emits specific messages per rule, never "enter a link".
 */
export function validateInput(raw: unknown): InputValidationResult {
  if (typeof raw !== "string" || !raw.trim()) {
    const msg = "Please enter a news link, headline, claim, or text to verify.";
    return {
      isValid: false,
      valid: false,
      sanitized: "",
      error: msg,
      errorCode: "EMPTY_INPUT",
      errorMessage: msg,
    };
  }

  const trimmed = raw.trim();
  if (trimmed.length > MAX_INPUT_CHARS) {
    const msg = `Input exceeds the maximum allowed length of ${MAX_INPUT_CHARS.toLocaleString()} characters. Please provide a shorter excerpt or headline.`;
    return {
      isValid: false,
      valid: false,
      sanitized: trimmed,
      error: msg,
      errorCode: "INPUT_TOO_LONG",
      errorMessage: msg,
    };
  }

  return {
    isValid: true,
    valid: true,
    sanitized: trimmed,
  };
}

/**
 * Helper to check if a single token without spaces looks like a valid URL.
 * Allows missing scheme if it looks like a domain with a path (e.g. "reuters.com/world/news").
 */
export function isSingleTokenUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  // Explicit http/https scheme or www prefix
  if (/^https?:\/\/[^\s]+$/i.test(trimmed) || /^www\.[^\s]+$/i.test(trimmed)) {
    return true;
  }

  // Missing scheme domain + path (e.g. timesofindia.indiatimes.com/india/123.cms)
  // Must have at least one dot, a valid 2+ char TLD, and a slash with a path
  if (/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\/[^\s]*$/i.test(trimmed)) {
    return true;
  }

  // Bare domain without path: only if valid common TLD and no spaces
  if (/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\.[a-zA-Z]{2,}$/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extracts a URL embedded within surrounding text words.
 * Returns the extracted URL, the remaining context words, and a notice message.
 */
export function extractUrlAndContext(raw: string): ExtractedUrlAndContext | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Look for http://, https://, www., or domain with path
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`]+|www\.[^\s<>"{}|\\^`]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\.[a-zA-Z]{2,}\/[^\s<>"{}|\\^`]*)/i;
  const match = trimmed.match(urlRegex);

  if (!match || !match[0]) return null;

  const rawMatchedUrl = match[0];

  // If the entire input was just the URL without any other words, it's a pure URL
  if (trimmed === rawMatchedUrl) {
    return null;
  }

  // Clean matched URL (strip trailing punctuation like . , ) ! : ; if accidentally captured)
  const cleanedUrl = rawMatchedUrl.replace(/[.,;:!?)\]}]+$/, "");

  // Normalize scheme if missing
  const normalizedUrl = /^https?:\/\//i.test(cleanedUrl)
    ? cleanedUrl
    : `https://${cleanedUrl}`;

  // Extract surrounding words as context
  const surroundingContext = trimmed
    .replace(rawMatchedUrl, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!surroundingContext) {
    return null;
  }

  return {
    url: normalizedUrl,
    surroundingContext,
    notice: `We verified the linked URL (${normalizedUrl}) using your surrounding text as context.`,
  };
}

/**
 * Single universal input detection function used by client and server.
 * Returns "url" | "headline" | "claim" | "text".
 */
export function detectInputType(raw: string): DetectedInputType {
  if (!raw || typeof raw !== "string") return "text";
  const trimmed = raw.trim();
  if (!trimmed) return "text";

  // 1. URL: a single token that parses as a valid http(s) URL (no spaces!)
  // Anything with spaces and sentence content is NOT a url, even if it contains a link inside it.
  if (isSingleTokenUrl(trimmed)) {
    return "url";
  }

  // 2. Multi-line or multiple paragraphs: always text
  if (trimmed.includes("\n")) {
    return "text";
  }

  // 3. Count words
  const words = trimmed.split(/\s+/).filter(Boolean);

  // 4. Quotation or attributed statement: claim
  if (
    /^["'“‘].+["'”’]$/.test(trimmed) ||
    /["'“‘].+["'”’]\s*[-—–—]/.test(trimmed) ||
    /[-—–—]\s*["'“‘].+["'”’]/.test(trimmed) ||
    /\b(said|says|claimed|claims|alleged|alleges|tweeted|stated|argued|declared|bole|boli|kaha)\b/i.test(trimmed) ||
    /^[A-Z][a-zA-Z\s.'’-]{2,40}\s*:\s*["“'‘]?.+["”'’]?$/.test(trimmed)
  ) {
    return "claim";
  }

  // 5. Short statement (roughly under 25 words): headline
  if (words.length <= 25) {
    return "headline";
  }

  // 6. Otherwise (over 25 words / multiple sentences): text
  return "text";
}

/**
 * Parses and analyzes input, handling embedded URLs and context extraction.
 */
export function parseAndAnalyzeInput(
  raw: string,
  forcedType?: DetectedInputType
): ParsedInput {
  const trimmed = (raw || "").trim();
  const detected = detectInputType(trimmed);
  const type = forcedType || detected;

  // Check if text has an embedded URL with surrounding words
  const embedded = extractUrlAndContext(trimmed);
  if (embedded) {
    return {
      raw: trimmed,
      type: "url",
      url: embedded.url,
      targetUrl: embedded.url,
      extractedUrl: embedded.url,
      surroundingContext: embedded.surroundingContext,
      notice: embedded.notice,
      text: trimmed,
    };
  }

  if (type === "url") {
    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return {
      raw: trimmed,
      type: "url",
      url: normalizedUrl,
      targetUrl: normalizedUrl,
      text: trimmed,
    };
  }

  if (type === "headline") {
    return {
      raw: trimmed,
      type: "headline",
      headline: trimmed,
      text: trimmed,
    };
  }

  if (type === "claim") {
    return {
      raw: trimmed,
      type: "claim",
      headline: trimmed,
      text: trimmed,
    };
  }

  return {
    raw: trimmed,
    type: "text",
    text: trimmed,
  };
}
