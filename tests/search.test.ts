import test from "node:test";
import assert from "node:assert/strict";

import {
  ClaimInput,
  ClaimInputSchema,
  EvidenceSchema,
  SearchClaimsRequestSchema,
  SourceTypeSchema,
} from "../src/schemas/evidence";
import {
  generateSearchQueries,
  normalizeUrlForDeduplication,
  searchClaim,
  searchMultipleClaims,
  classifySourceType,
} from "../src/lib/search/searchClaims";
import {
  normalizeSerperResponse,
  SearchError,
  SerperProvider,
} from "../src/lib/search/serper";
import { RawSearchResultItem, SearchProvider } from "../src/lib/search/provider";

/**
 * Mock SearchProvider that returns canned data or throws custom errors.
 */
class MockSearchProvider implements SearchProvider {
  public readonly name = "mock-search";
  public calls: { query: string; options?: any }[] = [];
  public customHandler?: (query: string) => Promise<RawSearchResultItem[]>;

  constructor(
    handler?: (query: string) => Promise<RawSearchResultItem[]>
  ) {
    this.customHandler = handler;
  }

  async search(query: string, options?: any): Promise<RawSearchResultItem[]> {
    this.calls.push({ query, options });
    if (this.customHandler) {
      return this.customHandler(query);
    }
    return [
      {
        title: `Result for: ${query}`,
        url: `https://example.org/news?q=${encodeURIComponent(query)}`,
        snippet: `Snippet details for ${query}`,
        domain: "example.org",
        publishedAt: "2026-10-18T10:00:00.000Z",
      },
    ];
  }
}

test("Phase 3 Multi-Source Evidence Retrieval Test Suite", async (t) => {
  // 1. VALID HIGH-IMPORTANCE CLAIM (up to 3 queries)
  await t.test(
    "1. valid high-importance claim - generates maximum 3 distinct queries",
    () => {
      const claim: ClaimInput = {
        id: "claim-001",
        text: "The government approved a ₹500 crore project for highway expansion.",
        importance: "high",
        claimType: "event",
      };

      const queries = generateSearchQueries(claim);
      assert.ok(queries.length <= 3, "High importance must not exceed 3 queries");
      assert.ok(queries.length >= 2, "Expected multiple query variations");
      assert.ok(
        queries[0].includes("₹500 crore project"),
        "Primary query should preserve financial details"
      );
    }
  );

  // 2. VALID MEDIUM-IMPORTANCE CLAIM (up to 2 queries)
  await t.test(
    "2. valid medium-importance claim - generates maximum 2 queries",
    () => {
      const claim: ClaimInput = {
        id: "claim-002",
        text: "Ministry announced new guidelines on solar panel imports.",
        importance: "medium",
        claimType: "policy",
      };

      const queries = generateSearchQueries(claim);
      assert.strictEqual(
        queries.length,
        2,
        "Medium importance must generate exactly 2 queries"
      );
    }
  );

  // 3. VALID LOW-IMPORTANCE CLAIM (maximum 1 query)
  await t.test(
    "3. valid low-importance claim - generates maximum 1 query",
    () => {
      const claim: ClaimInput = {
        id: "claim-003",
        text: "Local temperatures reached 38 degrees Celsius yesterday.",
        importance: "low",
        claimType: "statistic",
      };

      const queries = generateSearchQueries(claim);
      assert.strictEqual(
        queries.length,
        1,
        "Low importance must generate at most 1 query"
      );
    }
  );

  // 4. QUERY GENERATION PRESERVES FACTUAL DETAILS
  await t.test(
    "4. query generation - faithfully preserves names, numbers, currency, and entities without editorializing",
    () => {
      const claim: ClaimInput = {
        id: "claim-004",
        text: "Supreme Court bench led by CJI Chandrachud issued ₹10 lakh penalty on Corporation X.",
        importance: "high",
        claimType: "legal",
      };

      const queries = generateSearchQueries(claim);
      const combined = queries.join(" ");

      assert.ok(combined.includes("₹10 lakh"), "Must preserve currency and amount");
      assert.ok(
        combined.includes("Supreme Court") || combined.includes("CJI"),
        "Must preserve key institutional entities"
      );

      // Must NOT contain editorial truth verdicts
      assert.ok(!combined.includes("fake"), "Must not inject 'fake'");
      assert.ok(!combined.includes("fact check"), "Must not inject 'fact check'");
      assert.ok(!combined.includes("false"), "Must not inject 'false'");
    }
  );

  // 5. DUPLICATE QUERY REMOVAL
  await t.test(
    "5. duplicate query removal - removes redundant query variations",
    () => {
      const claim: ClaimInput = {
        id: "claim-005",
        text: "WHO alert",
        importance: "high",
        claimType: "alert",
      };

      const queries = generateSearchQueries(claim);
      const unique = new Set(queries.map((q) => q.toLowerCase()));
      assert.strictEqual(
        unique.size,
        queries.length,
        "Queries must not have duplicate variations"
      );
    }
  );

  // 6. SERPER RESPONSE NORMALIZATION
  await t.test(
    "6. Serper response normalization - correctly maps organic results to search items",
    () => {
      const rawSerper = {
        searchParameters: { q: "test query" },
        organic: [
          {
            title: "Ministry Approves ₹500 Crore Infra",
            link: "https://pib.gov.in/PressReleaseIframePage.aspx?PRID=12345",
            snippet: "The cabinet committee on economic affairs approved ₹500 crore...",
            date: "2026-10-15T08:00:00.000Z",
            position: 1,
          },
          {
            title: "Reuters: Highway Project Cleared",
            link: "https://www.reuters.com/world/india/highway-project-cleared-2026/",
            snippet: "India cleared a multi-million dollar road expansion...",
            date: "Oct 15, 2026",
            position: 2,
          },
        ],
      };

      const normalized = normalizeSerperResponse(rawSerper);
      assert.strictEqual(normalized.length, 2);

      assert.strictEqual(
        normalized[0].title,
        "Ministry Approves ₹500 Crore Infra"
      );
      assert.strictEqual(
        normalized[0].url,
        "https://pib.gov.in/PressReleaseIframePage.aspx?PRID=12345"
      );
      assert.strictEqual(normalized[0].domain, "pib.gov.in");
      assert.strictEqual(
        normalized[0].publishedAt,
        "2026-10-15T08:00:00.000Z"
      );

      assert.strictEqual(normalized[1].domain, "reuters.com");
      assert.ok(normalized[1].publishedAt !== null);
    }
  );

  // 7. URL NORMALIZATION
  await t.test(
    "7. URL normalization - strips tracking parameters, fragments, and trailing slashes",
    () => {
      const testCases = [
        {
          input: "https://example.com/news/article/?utm_source=twitter&utm_medium=social#heading",
          expected: "https://example.com/news/article",
        },
        {
          input: "http://WWW.Reuters.COM:80/world/news/?fbclid=12345&articleId=99",
          expected: "http://reuters.com/world/news?articleId=99",
        },
        {
          input: "https://apnews.com/story/",
          expected: "https://apnews.com/story",
        },
        {
          input: "https://example.com/",
          expected: "https://example.com/",
        },
      ];

      for (const { input, expected } of testCases) {
        const result = normalizeUrlForDeduplication(input);
        assert.strictEqual(result, expected);
      }
    }
  );

  // 8. DUPLICATE URL REMOVAL IN EVIDENCE
  await t.test(
    "8. duplicate URL removal - deduplicates identical URLs returned across multiple queries",
    async () => {
      const claim: ClaimInput = {
        id: "claim-008",
        text: "Central Bank increased interest rates by 25 basis points.",
        importance: "high",
        claimType: "economy",
      };

      // Mock provider returns duplicate URL across queries with slight variations (e.g. trailing slash, utm)
      const provider = new MockSearchProvider(async (query) => {
        return [
          {
            title: "Central Bank Rate Hike",
            url: "https://centralbank.gov/press/rates/",
            snippet: "The monetary committee hiked rates by 25 bps.",
            domain: "centralbank.gov",
            publishedAt: "2026-10-18T00:00:00Z",
          },
          {
            title: "Central Bank Rate Hike - Feed",
            url: "https://centralbank.gov/press/rates?utm_source=rss",
            snippet: "The monetary committee hiked rates by 25 bps.",
            domain: "centralbank.gov",
            publishedAt: "2026-10-18T00:00:00Z",
          },
        ];
      });

      const result = await searchClaim(claim, provider);
      assert.strictEqual(
        result.evidence.length,
        1,
        "Duplicate URLs must be collapsed into 1 evidence item"
      );
      assert.strictEqual(result.evidence[0].domain, "centralbank.gov");
    }
  );

  // 9. MISSING PUBLICATION DATE
  await t.test(
    "9. missing publication date - normalizes to null without inventing dates",
    () => {
      const rawSerper = {
        organic: [
          {
            title: "Official Gazette Archive",
            link: "https://gazette.gov.in/notifications/102",
            snippet: "Archival record document.",
            date: undefined,
          },
        ],
      };

      const normalized = normalizeSerperResponse(rawSerper);
      assert.strictEqual(normalized[0].publishedAt, null);
    }
  );

  // 10. MISSING API KEY
  await t.test(
    "10. missing API key - throws CONFIG_ERROR without leaking secrets",
    async () => {
      const originalKey = process.env.SERPER_API_KEY;
      const originalAltKey = process.env.Serper_API_Key;
      try {
        delete process.env.SERPER_API_KEY;
        delete process.env.Serper_API_Key;

        const provider = new SerperProvider();
        await assert.rejects(
          async () => {
            await provider.search("test");
          },
          (err: any) => {
            assert.strictEqual(err.code, "CONFIG_ERROR");
            assert.ok(!err.message.includes("secret-api-key"));
            return true;
          }
        );
      } finally {
        if (originalKey) process.env.SERPER_API_KEY = originalKey;
        if (originalAltKey) process.env.Serper_API_Key = originalAltKey;
      }
    }
  );

  // 11. SERPER 400 ERROR
  await t.test("11. Serper 400 error - maps to BAD_REQUEST SearchError", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: "Invalid parameters" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });

      const provider = new SerperProvider("mock-key");
      await assert.rejects(
        async () => {
          await provider.search("test query");
        },
        (err: any) => {
          assert.strictEqual(err.code, "BAD_REQUEST");
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 12. SERPER 401/403 ERROR
  await t.test("12. Serper 401/403 error - maps to AUTH_ERROR SearchError", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });

      const provider = new SerperProvider("mock-key");
      await assert.rejects(
        async () => {
          await provider.search("test query");
        },
        (err: any) => {
          assert.strictEqual(err.code, "AUTH_ERROR");
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 13. SERPER 429 ERROR
  await t.test("13. Serper 429 error - maps to RATE_LIMITED SearchError", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });

      const provider = new SerperProvider("mock-key");
      await assert.rejects(
        async () => {
          await provider.search("test query");
        },
        (err: any) => {
          assert.strictEqual(err.code, "RATE_LIMITED");
          assert.strictEqual(err.statusCode, 429);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 14. SERPER 5XX ERROR
  await t.test(
    "14. Serper 5xx error - maps to PROVIDER_SERVER_ERROR SearchError",
    async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () =>
          new Response(JSON.stringify({ message: "Internal server error" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });

        const provider = new SerperProvider("mock-key");
        await assert.rejects(
          async () => {
            await provider.search("test query");
          },
          (err: any) => {
            assert.strictEqual(err.code, "PROVIDER_SERVER_ERROR");
            assert.strictEqual(err.statusCode, 503);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  // 15. TIMEOUT HANDLING
  await t.test(
    "15. timeout handling - triggers SEARCH_TIMEOUT when provider takes too long",
    async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url, init: any) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve(new Response(JSON.stringify({ organic: [] })));
            }, 500);

            if (init?.signal) {
              init.signal.addEventListener("abort", () => {
                clearTimeout(timer);
                const abortErr = new Error("The operation was aborted");
                abortErr.name = "AbortError";
                reject(abortErr);
              });
            }
          });
        };

        const provider = new SerperProvider("mock-key");
        await assert.rejects(
          async () => {
            // Set 50ms timeout to trigger fast abort
            await provider.search("slow query", { timeoutMs: 50 });
          },
          (err: any) => {
            assert.strictEqual(err.code, "SEARCH_TIMEOUT");
            assert.strictEqual(err.statusCode, 504);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  // 16. MALFORMED SERPER RESPONSE
  await t.test(
    "16. malformed Serper response - rejects invalid non-object response with MALFORMED_RESPONSE",
    () => {
      assert.throws(
        () => {
          normalizeSerperResponse("invalid-string" as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, "MALFORMED_RESPONSE");
          return true;
        }
      );
    }
  );

  // 17. PARTIAL SEARCH FAILURE
  await t.test(
    "17. partial search failure - retains successful evidence when one query fails",
    async () => {
      const claim: ClaimInput = {
        id: "claim-partial",
        text: "Ministry announced railway development budget of ₹10,000 crore.",
        importance: "high", // Generates up to 3 queries
        claimType: "budget",
      };

      let callCount = 0;
      const provider = new MockSearchProvider(async (query) => {
        callCount++;
        if (callCount === 2) {
          throw new SearchError("RATE_LIMITED", "Transient rate limit", 429);
        }
        return [
          {
            title: `Verified Budget Item ${callCount}`,
            url: `https://railways.gov.in/press/budget-${callCount}`,
            snippet: "The ministry announced railway budget allocation.",
            domain: "railways.gov.in",
            publishedAt: "2026-10-18T00:00:00Z",
          },
        ];
      });

      const result = await searchClaim(claim, provider);
      assert.ok(
        result.evidence.length >= 1,
        "Must preserve successful evidence despite partial query failure"
      );
      assert.strictEqual(result.status, "partial_failure");
    }
  );

  // 18. EVIDENCE ZOD VALIDATION (strictly unknown relationships)
  await t.test(
    "18. evidence Zod validation - strictly requires relationship='unknown' and sourceRelationship='unknown'",
    () => {
      const validEvidence = {
        id: "ev-01",
        claimId: "claim-01",
        title: "Official Press Notice",
        url: "https://press.gov/notice-1",
        domain: "press.gov",
        snippet: "Snippet text",
        publishedAt: null,
        sourceRelationship: "unknown",
        relationship: "unknown",
      };

      const validParsed = EvidenceSchema.safeParse(validEvidence);
      assert.strictEqual(validParsed.success, true);

      // Attempt to set relationship to an invalid veracity value like 'true' -> MUST FAIL
      const invalidVeracity = {
        ...validEvidence,
        relationship: "true",
      };
      const invalidVeracityParsed = EvidenceSchema.safeParse(invalidVeracity);
      assert.strictEqual(
        invalidVeracityParsed.success,
        false,
        "EvidenceSchema must reject invalid veracity relationship values"
      );

      // Attempt to set sourceRelationship to 'biased' -> MUST FAIL
      const invalidSource = {
        ...validEvidence,
        sourceRelationship: "biased",
      };
      const invalidSourceParsed = EvidenceSchema.safeParse(invalidSource);
      assert.strictEqual(
        invalidSourceParsed.success,
        false,
        "EvidenceSchema must reject non-'unknown' sourceRelationship in Phase 3"
      );
    }
  );

  // 19. EMPTY CLAIMS VALIDATION
  await t.test("19. empty claims - rejected by SearchClaimsRequestSchema", () => {
    const invalidEmpty = { claims: [] };
    const parsed = SearchClaimsRequestSchema.safeParse(invalidEmpty);
    assert.strictEqual(parsed.success, false);
  });

  // 20. MAXIMUM CLAIM LIMIT VALIDATION (max 20)
  await t.test(
    "20. maximum claim limit - enforces maximum 20 claims per request",
    () => {
      const excessiveClaims: ClaimInput[] = Array.from({ length: 21 }, (_, i) => ({
        id: `claim-${i}`,
        text: `Factual assertion number ${i}`,
        importance: "low",
        claimType: "event",
      }));

      const parsed = SearchClaimsRequestSchema.safeParse({
        claims: excessiveClaims,
      });
      assert.strictEqual(
        parsed.success,
        false,
        "Must reject requests with > 20 claims"
      );

      const exactly20 = excessiveClaims.slice(0, 20);
      const parsed20 = SearchClaimsRequestSchema.safeParse({ claims: exactly20 });
      assert.strictEqual(
        parsed20.success,
        true,
        "Must accept requests with exactly 20 claims"
      );
    }
  );

  // 21. SOURCE TYPE CLASSIFICATION & VALIDATION
  await t.test(
    "21. source type classification - supports and validates all 11 required source types",
    () => {
      const expectedTypes = [
        "OFFICIAL",
        "PRIMARY_DOCUMENT",
        "WIRE",
        "NATIONAL_NEWS",
        "REGIONAL_NEWS",
        "INTERNATIONAL_NEWS",
        "FACT_CHECK",
        "RESEARCH",
        "BLOG",
        "SOCIAL",
        "OTHER",
      ];

      for (const st of expectedTypes) {
        const parsed = SourceTypeSchema.safeParse(st);
        assert.strictEqual(parsed.success, true, `SourceTypeSchema must accept ${st}`);
      }

      // Rejects invalid types
      assert.strictEqual(SourceTypeSchema.safeParse("INVALID_TYPE").success, false);

      // Verify domain and URL classification
      assert.strictEqual(classifySourceType("pib.gov.in", "https://pib.gov.in/release"), "OFFICIAL");
      assert.strictEqual(classifySourceType("example.com", "https://example.com/gazette/order-1.pdf"), "PRIMARY_DOCUMENT");
      assert.strictEqual(classifySourceType("reuters.com", "https://reuters.com/world/news"), "WIRE");
      assert.strictEqual(classifySourceType("thehindu.com", "https://thehindu.com/news/national"), "NATIONAL_NEWS");
      assert.strictEqual(classifySourceType("deccanherald.com", "https://deccanherald.com/state"), "REGIONAL_NEWS");
      assert.strictEqual(classifySourceType("bbc.com", "https://bbc.com/news/world"), "INTERNATIONAL_NEWS");
      assert.strictEqual(classifySourceType("snopes.com", "https://snopes.com/fact-check"), "FACT_CHECK");
      assert.strictEqual(classifySourceType("nature.com", "https://nature.com/articles/123"), "RESEARCH");
      assert.strictEqual(classifySourceType("substack.com", "https://substack.com/post"), "BLOG");
      assert.strictEqual(classifySourceType("twitter.com", "https://twitter.com/status"), "SOCIAL");
      assert.strictEqual(classifySourceType("unknownblog.xyz", "https://unknownblog.xyz/post"), "OTHER");
    }
  );
});
