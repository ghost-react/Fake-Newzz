import { RawSearchResultItem, SearchOptions, SearchProvider } from "./provider";

/**
 * Standardized Search Error with controlled codes.
 * Prevents secret leakage or unformatted provider responses.
 */
export class SearchError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = "SearchError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes date strings from Serper (e.g., "3 days ago", "Oct 15, 2026", "2026-10-15T...")
 * or returns null if no valid publication date is available.
 * Does not invent dates.
 */
function normalizeDate(rawDate?: unknown): string | null {
  if (typeof rawDate !== "string" || !rawDate.trim()) {
    return null;
  }

  const trimmed = rawDate.trim();
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Preserve non-standard date representation if not empty, or null
  return trimmed;
}

/**
 * Safely extracts clean domain hostname from a URL string.
 */
function extractDomain(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown-domain";
  }
}

/**
 * Raw Serper organic search result item interface
 */
interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  attributes?: Record<string, string>;
  position?: number;
}

/**
 * Raw Serper search response payload interface
 */
interface SerperResponse {
  searchParameters?: {
    q?: string;
    type?: string;
    engine?: string;
  };
  organic?: SerperOrganicResult[];
  knowledgeGraph?: Record<string, unknown>;
  answerBox?: Record<string, unknown>;
}

/**
 * Normalizes raw Serper API response into provider-independent RawSearchResultItem[]
 */
export function normalizeSerperResponse(data: unknown): RawSearchResultItem[] {
  if (!data || typeof data !== "object") {
    throw new SearchError(
      "MALFORMED_RESPONSE",
      "Serper returned an invalid non-object response."
    );
  }

  const res = data as SerperResponse;

  // Handle zero results gracefully
  if (!res.organic || !Array.isArray(res.organic)) {
    return [];
  }

  const results: RawSearchResultItem[] = [];

  for (const item of res.organic) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const title = typeof item.title === "string" ? item.title.trim() : "";
    const url = typeof item.link === "string" ? item.link.trim() : "";
    const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";

    // Require at least a valid URL to be considered usable evidence
    if (!url) {
      continue;
    }

    // Extract date from item.date or attributes if available
    const rawDate = item.date || item.attributes?.["Date"] || item.attributes?.["date"];
    const publishedAt = normalizeDate(rawDate);

    results.push({
      title: title || "Untitled Source Document",
      url,
      domain: extractDomain(url),
      snippet,
      publishedAt,
    });
  }

  return results;
}

/**
 * Serper Search Provider implementation.
 * Performs broad web search queries using Serper REST API server-side.
 */
export class SerperProvider implements SearchProvider {
  public readonly name = "serper";
  private readonly endpoint = "https://google.serper.dev/search";
  private readonly customApiKey?: string;

  constructor(apiKey?: string) {
    this.customApiKey = apiKey;
  }

  /**
   * Resolves the server-side API key strictly without exposure to client code.
   */
  private getApiKey(): string {
    const key =
      this.customApiKey ||
      process.env.SERPER_API_KEY ||
      process.env.Serper_API_Key;

    if (!key || !key.trim()) {
      throw new SearchError(
        "CONFIG_ERROR",
        "SERPER_API_KEY is not configured.",
        500
      );
    }
    return key.trim();
  }

  /**
   * Performs web search across diverse public sources (government, court, research, news, archives).
   */
  public async search(
    query: string,
    options?: SearchOptions
  ): Promise<RawSearchResultItem[]> {
    const apiKey = this.getApiKey();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 5, 20));
    const timeoutMs = options?.timeoutMs ?? 8000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: trimmedQuery,
          num: limit,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const status = response.status;

        if (status === 400) {
          throw new SearchError(
            "BAD_REQUEST",
            "Search query could not be processed by search provider.",
            400
          );
        } else if (status === 401 || status === 403) {
          throw new SearchError(
            "AUTH_ERROR",
            "Search provider authentication failed. Check API key configuration.",
            status
          );
        } else if (status === 429) {
          throw new SearchError(
            "RATE_LIMITED",
            "Search provider rate limit reached. Please wait a moment before searching again.",
            429
          );
        } else if (status >= 500) {
          throw new SearchError(
            "PROVIDER_SERVER_ERROR",
            "Search provider experienced a temporary server error.",
            status
          );
        } else {
          throw new SearchError(
            "SEARCH_FAILED",
            `Search provider returned unexpected status code: ${status}`,
            status
          );
        }
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new SearchError(
          "MALFORMED_RESPONSE",
          "Search provider returned invalid non-JSON payload."
        );
      }

      return normalizeSerperResponse(data);
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof SearchError) {
        throw err;
      }

      if (
        (err as { name?: string })?.name === "AbortError" ||
        (err as { message?: string })?.message?.includes("aborted")
      ) {
        throw new SearchError(
          "SEARCH_TIMEOUT",
          `Search request timed out after ${timeoutMs}ms.`,
          504
        );
      }

      throw new SearchError(
        "NETWORK_ERROR",
        "Failed to connect to search provider. Please check network connectivity.",
        503
      );
    }
  }
}
