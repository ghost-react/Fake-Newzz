import test from "node:test";
import assert from "node:assert/strict";

import { ClaimInput, Evidence } from "../src/schemas/evidence";
import {
  generateEventLevelQueries,
  searchMultipleClaims,
  normalizeUrlForDeduplication,
} from "../src/lib/search/searchClaims";
import { RawSearchResultItem, SearchProvider } from "../src/lib/search/provider";
import { prepareEvidenceForClaim } from "../src/lib/verification/prepareEvidence";
import { evaluateClaims } from "../src/lib/verification/evaluateClaims";
import { deterministicEvaluateClaim } from "../src/lib/verification/evaluateClaim";
import * as sourceContentModule from "../src/lib/verification/sourceContent";

class MockSearchProvider implements SearchProvider {
  public readonly name = "mock-search";
  public calls: { query: string; options?: any }[] = [];
  public customHandler?: (query: string) => Promise<RawSearchResultItem[]>;

  constructor(handler?: (query: string) => Promise<RawSearchResultItem[]>) {
    this.customHandler = handler;
  }

  async search(query: string, options?: any): Promise<RawSearchResultItem[]> {
    this.calls.push({ query, options });
    if (this.customHandler) {
      return this.customHandler(query);
    }
    return [
      {
        title: `Reporting on: ${query}`,
        url: `https://example-news.com/article?q=${encodeURIComponent(query)}`,
        snippet: `Snippet context for ${query}`,
        domain: "example-news.com",
        publishedAt: "2026-11-08T08:00:00.000Z",
      },
    ];
  }
}

test("Evidence Retrieval and Evidence Depth Test Suite (Prompt 10 Step 3)", async (t) => {
  // ── TEST 1 ─────────────────────────────────────────────────────────────────
  await t.test(
    "1. Event-level queries exist and contain no claim-specific numbers or quotes",
    () => {
      const airfareClaims: ClaimInput[] = [
        {
          id: "c-airfare-1",
          text: "Petitioner alleges airfares rose 700%; judge said the court cannot fix prices during festival surge",
          importance: "high",
          claimType: "event",
        },
      ];

      const queries = generateEventLevelQueries(airfareClaims);
      assert.ok(queries.length >= 2, "Expected 2-3 event-level queries");
      assert.ok(queries.length <= 3, "Must not exceed 3 event-level queries");

      for (const q of queries) {
        assert.ok(
          !/\d/.test(q),
          `Event-level query must contain no digits, got: "${q}"`
        );
        assert.ok(
          !/[“""'']/.test(q),
          `Event-level query must contain no quotes, got: "${q}"`
        );
        assert.ok(
          !q.toLowerCase().includes("700"),
          `Must not contain claim-specific number 700, got: "${q}"`
        );
      }

      const bengaluruClaims: ClaimInput[] = [
        {
          id: "c-bengaluru-1",
          text: "Bengaluru techie and family of four found dead in apartment; police suspect suicide pact",
          importance: "high",
          claimType: "event",
        },
      ];

      const benQueries = generateEventLevelQueries(bengaluruClaims);
      assert.ok(benQueries.length >= 2, "Expected 2-3 event-level queries for Bengaluru case");
      for (const q of benQueries) {
        assert.ok(!/\d/.test(q), `Query must contain no digits: "${q}"`);
        assert.ok(!/[“""'']/.test(q), `Query must contain no quotes: "${q}"`);
        assert.ok(
          !/\bfour\b/i.test(q),
          `Query must not contain specific number word "four": "${q}"`
        );
      }
    }
  );

  // ── TEST 2 ─────────────────────────────────────────────────────────────────
  await t.test(
    "2. Query count never exceeds the cap and duplicates are removed",
    async () => {
      const claims: ClaimInput[] = [
        { id: "c1", text: "Supreme Court airfare petition filed on Monday", importance: "high", claimType: "event" },
        { id: "c2", text: "Supreme Court airfare petition hearing postponed", importance: "high", claimType: "event" },
        { id: "c3", text: "Aviation ministry submits report to Supreme Court", importance: "medium", claimType: "factual" },
        { id: "c4", text: "Airlines deny artificial price surges during Diwali", importance: "low", claimType: "factual" },
      ];

      const provider = new MockSearchProvider();
      const cap = 5;

      const results = await searchMultipleClaims(claims, provider, {
        maxTotalQueries: cap,
      });

      assert.ok(results.length === 4, "Must return results for all 4 claims");
      assert.ok(
        provider.calls.length <= cap,
        `Executed queries (${provider.calls.length}) must not exceed cap of ${cap}`
      );

      // Verify no duplicates in executed queries
      const executedQueries = provider.calls.map((c) => c.query.trim().toLowerCase());
      const uniqueExecuted = new Set(executedQueries);
      assert.strictEqual(
        executedQueries.length,
        uniqueExecuted.size,
        "All executed queries must be unique (no duplicates)"
      );
    }
  );

  // ── TEST 3 ─────────────────────────────────────────────────────────────────
  await t.test(
    "3. A failed fetch triggers fallback to the next distinct domain",
    async () => {
      const claim: ClaimInput = {
        id: "c-fetch",
        text: "Municipal council approves city solar grid plan",
        importance: "high",
        claimType: "event",
      };

      // 5 distinct domains
      const evidenceList: Evidence[] = [
        {
          id: "ev-1",
          claimId: "c-fetch",
          title: "City solar plan passed",
          url: "https://domain1-news.org/solar",
          domain: "domain1-news.org",
          snippet: "Council approved the solar grid plan on Tuesday.",
          publishedAt: "2026-11-01",
          sourceType: "national_news",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-2",
          claimId: "c-fetch",
          title: "Paywalled solar plan report",
          url: "https://domain2-blocked.com/solar",
          domain: "domain2-blocked.com",
          snippet: "Mayor speaks on solar investment.",
          publishedAt: "2026-11-01",
          sourceType: "national_news",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-3",
          claimId: "c-fetch",
          title: "Regional update on solar grid",
          url: "https://domain3-regional.net/solar",
          domain: "domain3-regional.net",
          snippet: "City council moves forward with solar installations.",
          publishedAt: "2026-11-01",
          sourceType: "regional_news",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "medium",
          relevance: "direct",
        },
        {
          id: "ev-4",
          claimId: "c-fetch",
          title: "Public energy journal covers council vote",
          url: "https://domain4-energy.gov/solar",
          domain: "domain4-energy.gov",
          snippet: "Municipal records confirm affirmative vote on clean energy.",
          publishedAt: "2026-11-01",
          sourceType: "official",
          sourceRelationship: "original",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-5",
          claimId: "c-fetch",
          title: "Backup independent report",
          url: "https://domain5-independent.org/solar",
          domain: "domain5-independent.org",
          snippet: "Full coverage of city solar grid passage.",
          publishedAt: "2026-11-01",
          sourceType: "national_news",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      const customRetriever = async (url: string) => {
        if (url.includes("domain2-blocked.com")) {
          return null; // Simulates scrape block / 403 / timeout
        }
        return {
          url,
          title: "Full Article Title",
          content: "The municipal council officially approved the city solar grid plan during a unanimous vote.",
          publishedAt: "2026-11-01",
          sourceDomain: new URL(url).hostname,
        };
      };

      const { evidence } = await evaluateClaims([claim], evidenceList, {
        maxDistinctDomainsToFetch: 4,
        sourceContentRetriever: customRetriever,
      });

      // Domain 2 failed
      const item2 = evidence.find((e) => e.domain === "domain2-blocked.com");
      assert.ok(item2, "Domain 2 item must be in evidence");
      assert.strictEqual(item2.contentDepth, "snippet", "Failed item must be snippet");
      assert.strictEqual(item2.fetchFailed, true, "Failed item must have fetchFailed: true");

      // Domain 5 was fetched as the fallback replacement to reach target of 4 distinct successful domains
      const item5 = evidence.find((e) => e.domain === "domain5-independent.org");
      assert.ok(item5, "Domain 5 must be in evidence");
      assert.strictEqual(item5.contentDepth, "full_text", "Domain 5 should have succeeded as fallback");
      assert.strictEqual(item5.fetchFailed, false);

      // Exactly 4 distinct domains succeeded with full_text
      const fullTextDomains = new Set(
        evidence.filter((e) => e.contentDepth === "full_text").map((e) => e.domain)
      );
      assert.strictEqual(fullTextDomains.size, 4, "Should have 4 distinct domains with full_text");
    }
  );

  // ── TEST 4 ─────────────────────────────────────────────────────────────────
  await t.test(
    "4. Snippet-only evidence is flagged and never passed as full_text",
    () => {
      const claimId = "c-snippet";
      const snippetEvidence: Evidence[] = [
        {
          id: "ev-snip-1",
          claimId,
          title: "Snippet-only source",
          url: "https://snippet-news.com/story",
          domain: "snippet-news.com",
          snippet: "Short snippet asserting event occurred.",
          publishedAt: null,
          sourceType: "national_news",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "medium",
          relevance: "direct",
          sourceContentStatus: "snippet_only",
          contentDepth: "snippet",
          fetchFailed: false,
          sourceContentExcerpt: null,
        },
      ];

      const prepared = prepareEvidenceForClaim(claimId, snippetEvidence);
      assert.strictEqual(prepared.length, 1);
      assert.strictEqual(
        prepared[0].contentDepth,
        "snippet",
        "Must be flagged as 'snippet'"
      );
      assert.notStrictEqual(
        prepared[0].contentDepth,
        "full_text",
        "Snippet-only evidence must NEVER be flagged as 'full_text'"
      );

      // Evaluator confidence for a verdict that rests solely on snippets cannot be 'high'
      const claim: ClaimInput = {
        id: claimId,
        text: "Event occurred as asserted",
        importance: "high",
        claimType: "event",
      };

      const evaluation = deterministicEvaluateClaim(claim, prepared);
      assert.notStrictEqual(
        evaluation.confidence,
        "high",
        "Confidence cannot be high when evidence rests solely on snippets"
      );
      assert.ok(evaluation.confidence === "medium" || evaluation.confidence === "low");
    }
  );

  // ── TEST 5 ─────────────────────────────────────────────────────────────────
  await t.test(
    "5. The same URL is fetched once per run even if multiple claims use it",
    async () => {
      const sharedUrl = "https://reuters.com/shared-story";
      const claims: ClaimInput[] = [
        { id: "c1", text: "Court heard arguments on airfare surge", importance: "high", claimType: "event" },
        { id: "c2", text: "Judge said court cannot fix airline ticket prices", importance: "high", claimType: "event" },
      ];

      const evidence: Evidence[] = [
        {
          id: "ev-c1",
          claimId: "c1",
          title: "Supreme Court airfare hearing",
          url: sharedUrl,
          domain: "reuters.com",
          snippet: "Court heard arguments on airfare surge.",
          publishedAt: "2026-11-08",
          sourceType: "wire",
          sourceRelationship: "original",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-c2",
          claimId: "c2",
          title: "Supreme Court airfare hearing",
          url: sharedUrl,
          domain: "reuters.com",
          snippet: "Judge said court cannot fix airline ticket prices.",
          publishedAt: "2026-11-08",
          sourceType: "wire",
          sourceRelationship: "original",
          relationship: "unknown",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      let fetchCount = 0;
      const customRetriever = async (url: string) => {
        if (url === sharedUrl) {
          fetchCount++;
          return {
            url,
            title: "Supreme Court airfare hearing",
            content: "The court heard arguments on airfare surge yesterday. Later in the hearing, the judge said court cannot fix airline ticket prices.",
            publishedAt: "2026-11-08",
            sourceDomain: "reuters.com",
          };
        }
        return null;
      };

      const { evidence: evaluatedEvidence } = await evaluateClaims(claims, evidence, {
        sourceContentRetriever: customRetriever,
      });

      assert.strictEqual(
        fetchCount,
        1,
        `Expected URL to be fetched exactly once, but was fetched ${fetchCount} times`
      );

      const ev1 = evaluatedEvidence.find((e) => e.claimId === "c1");
      const ev2 = evaluatedEvidence.find((e) => e.claimId === "c2");

      assert.ok(ev1?.sourceContentExcerpt?.includes("airfare surge"));
      assert.ok(ev2?.sourceContentExcerpt?.includes("airline ticket prices"));
    }
  );

  // ── TEST 6 ─────────────────────────────────────────────────────────────────
  await t.test(
    "6. Fewer than 4 sources available: pipeline proceeds and records limited coverage instead of failing",
    async () => {
      const claim: ClaimInput = {
        id: "c-limited",
        text: "Niche community council opens new sports park",
        importance: "high",
        claimType: "event",
      };

      // Only 2 distinct domains available
      const evidence: Evidence[] = [
        {
          id: "ev-lim-1",
          claimId: "c-limited",
          title: "Sports park opens",
          url: "https://local-gazette.com/park",
          domain: "local-gazette.com",
          snippet: "Sports park opened on Saturday.",
          publishedAt: "2026-11-01",
          sourceType: "regional_news",
          sourceRelationship: "original",
          relationship: "unknown",
          evidenceQuality: "medium",
          relevance: "direct",
        },
        {
          id: "ev-lim-2",
          claimId: "c-limited",
          title: "Council park opening photos",
          url: "https://community-blog.org/park",
          domain: "community-blog.org",
          snippet: "Community members attend park ceremony.",
          publishedAt: "2026-11-01",
          sourceType: "blog",
          sourceRelationship: "independent",
          relationship: "unknown",
          evidenceQuality: "low",
          relevance: "related",
        },
      ];

      const customRetriever = async (url: string) => ({
        url,
        title: "Article",
        content: "Community sports park officially opened for public recreation.",
        publishedAt: null,
        sourceDomain: new URL(url).hostname,
      });

      const { evaluations, evidence: evaluated } = await evaluateClaims([claim], evidence, {
        sourceContentRetriever: customRetriever,
      });

      assert.strictEqual(evaluations.length, 1);
      assert.strictEqual(evaluations[0].claimId, "c-limited");
      // Must succeed without throwing
      assert.ok(evaluations[0].verdict === "supporting" || evaluations[0].verdict === "insufficient");
      assert.strictEqual(evaluated.length, 2);
    }
  );

  // ── TEST 7 ─────────────────────────────────────────────────────────────────
  await t.test(
    "7. Concurrency never exceeds the configured bound",
    async () => {
      const claim: ClaimInput = {
        id: "c-concur",
        text: "Global health symposium announces new medical guidelines",
        importance: "high",
        claimType: "event",
      };

      const maxConcurrencyBound = 4;
      let activeFetches = 0;
      let peakConcurrency = 0;

      // 8 distinct domains
      const evidence: Evidence[] = Array.from({ length: 8 }, (_, i) => ({
        id: `ev-concur-${i + 1}`,
        claimId: "c-concur",
        title: `Symposium Report ${i + 1}`,
        url: `https://domain-${i + 1}.org/report`,
        domain: `domain-${i + 1}.org`,
        snippet: "Global symposium announced new guidelines.",
        publishedAt: "2026-11-01",
        sourceType: "research" as const,
        sourceRelationship: "independent" as const,
        relationship: "unknown" as const,
        evidenceQuality: "high" as const,
        relevance: "direct" as const,
      }));

      const customRetriever = async (url: string) => {
        activeFetches++;
        if (activeFetches > peakConcurrency) {
          peakConcurrency = activeFetches;
        }
        await new Promise((r) => setTimeout(r, 20));
        activeFetches--;
        return {
          url,
          title: "Title",
          content: "Global health symposium announces new medical guidelines for regional clinics.",
          publishedAt: "2026-11-01",
          sourceDomain: new URL(url).hostname,
        };
      };

      await evaluateClaims([claim], evidence, {
        maxDistinctDomainsToFetch: 6,
        concurrency: maxConcurrencyBound,
        sourceContentRetriever: customRetriever,
      });

      assert.ok(
        peakConcurrency <= maxConcurrencyBound,
        `Peak concurrency (${peakConcurrency}) must not exceed bound (${maxConcurrencyBound})`
      );
    }
  );
});
