/**
 * Normalized search item returned by any SearchProvider implementation.
 * Completely provider-agnostic — FakeNewzz core never handles raw provider payloads.
 */
export interface RawSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  publishedAt: string | null;
}

/**
 * Common search options across providers.
 */
export interface SearchOptions {
  /**
   * Target number of organic search results to return per query (default: 5)
   */
  limit?: number;

  /**
   * Request timeout in milliseconds (default: 8000ms)
   */
  timeoutMs?: number;
}

/**
 * Provider-independent search interface.
 * Isolates search execution and response normalization from application logic.
 */
export interface SearchProvider {
  /**
   * Identifier name of the search provider (e.g., 'serper', 'tavily', 'brave')
   */
  readonly name: string;

  /**
   * Performs broad web search across government, institutional, news, and archival sources.
   * Returns normalized search result items without provider-specific envelopes.
   */
  search(query: string, options?: SearchOptions): Promise<RawSearchResultItem[]>;
}
