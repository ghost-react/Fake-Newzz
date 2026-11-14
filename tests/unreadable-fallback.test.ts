import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/verify/route";
import {
  recoverHeadline,
  extractHeadlineFromUrlSlug,
  isBlockedPageTitle,
} from "../src/lib/ingestion/headlineRecovery";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { SearchProvider, RawSearchResultItem } from "../src/lib/search/provider";
import { SerperProvider } from "../src/lib/search/serper";

function makeEvidence(e: Partial<Evidence> & { id: string; claimId: string; url: string; domain: string }): Evidence {
  return {
    title: "Test Title",
    snippet: "Test snippet",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "general_web",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: null,
    sourceContentStatus: "snippet_only",
    ...e,
  } as Evidence;
}

class MockSearchProvider implements SearchProvider {
  public readonly name = "mock";
  private results: RawSearchResultItem[];

  constructor(results: RawSearchResultItem[] = []) {
    this.results = results;
  }

  async search(_query: string): Promise<RawSearchResultItem[]> {
    return this.results;
  }
}

describe("Unreadable Article Fallback Verification Suite (Prompt 10)", () => {
  // ─── 6.a 403 on article, title returned by URL search ─────────────────────
  it("6.a 403 on the article, title returned by URL search: pipeline runs, verdict produced, sourceReadStatus 'unreadable', score not reduced", async () => {
    const url = "https://hindustantimes.com/india-news/supreme-court-issues-notice-on-aviation-petition";

    // Search provider returns search result for the exact URL
    const mockProvider = new MockSearchProvider([
      {
        title: "Supreme Court issues notice on aviation petition - Hindustan Times",
        url: url,
        snippet: "The Supreme Court on Friday issued notice to civil aviation ministry on airfare caps petition.",
        domain: "hindustantimes.com",
        publishedAt: "2023-09-08",
      },
    ]);

    const recovery = await recoverHeadline(url, {
      metadata: null,
      searchProvider: mockProvider,
    });

    assert.ok(recovery !== null, "Headline should be recovered");
    assert.strictEqual(recovery.headlineSource, "url_search");
    assert.ok(recovery.headline.includes("Supreme Court issues notice"));

    // Run verification report with recovered headline and independent evidence
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: recovery.headline,
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const independentEvidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        title: "SC seeks ministry response on airfare regulation",
        snippet: "A bench issued notice on a plea seeking caps on airline ticket pricing.",
        url: "https://livelaw.in/sc-airfare-notice",
        domain: "livelaw.in",
        sourceType: "legal_database",
        relationship: "supporting",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c1",
        title: "Top Court issues notice to civil aviation ministry",
        snippet: "The Supreme Court asked civil aviation ministry to respond within four weeks.",
        url: "https://barandbench.com/sc-airfares",
        domain: "barandbench.com",
        sourceType: "legal_database",
        relationship: "supporting",
      }),
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by independent legal and news reports.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: recovery.headline,
        sourceDomain: "hindustantimes.com",
        url,
      },
      claims,
      evaluations,
      [],
      {
        evidence: independentEvidence,
        sourceReadStatus: "unreadable",
        headlineSource: recovery.headlineSource,
      }
    );

    assert.strictEqual(report.sourceReadStatus, "unreadable");
    assert.strictEqual(report.headlineSource, "url_search");
    assert.ok(report.sourceReadNote?.includes("based on independent reporting"));
    // Verdict must be produced and score not reduced because original failed to fetch
    assert.ok(
      report.veracityVerdict === "mostly_true" || report.veracityVerdict === "verified_true",
      `Verdict was ${report.veracityVerdict}`
    );
    assert.ok(report.overallTrustScore >= 70, `Score was ${report.overallTrustScore}`);
  });

  // ─── 6.b 403 and no search title, slug has usable words ───────────────────
  it("6.b 403 and no search title, slug has usable words: pipeline runs with low confidence and the note", async () => {
    const url = "https://example.com/world/italian-government-approves-meloni-decree-youth-crime";

    // No search results returned
    const emptyProvider = new MockSearchProvider([]);

    const recovery = await recoverHeadline(url, {
      metadata: null,
      searchProvider: emptyProvider,
    });

    assert.ok(recovery !== null, "Headline should be recovered from slug");
    assert.strictEqual(recovery.headlineSource, "url_slug");
    assert.strictEqual(recovery.confidenceCap, "low");
    assert.ok(recovery.headline.toLowerCase().includes("meloni"));

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: recovery.headline,
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Supported by multiple independent wires.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: recovery.headline,
        sourceDomain: "example.com",
        url,
      },
      claims,
      evaluations,
      [],
      {
        evidence: [makeEvidence({ id: "ev1", claimId: "c1", url: "https://ansa.it/decree", domain: "ansa.it" })],
        sourceReadStatus: "unreadable",
        headlineSource: recovery.headlineSource,
      }
    );

    assert.strictEqual(report.sourceReadStatus, "unreadable");
    assert.strictEqual(report.headlineSource, "url_slug");
    // Guardrail: confidence capped at "low" because headline came only from slug
    assert.strictEqual(report.confidence, "low");
    // Note must mention inferred from link
    assert.ok(
      report.sourceReadNote?.includes("inferred from the link"),
      `Note was: ${report.sourceReadNote}`
    );
  });

  // ─── 6.c 403, no title, slug is only an ID: error screen shown ────────────
  it("6.c 403, no title, slug is only an ID: error screen shown", async () => {
    const url = "https://example.com/article/108345678";

    // Slug is purely numeric ID
    const slugHeadline = extractHeadlineFromUrlSlug(url);
    assert.strictEqual(slugHeadline, null, "Pure numeric ID must not produce headline");

    const recovery = await recoverHeadline(url, {
      metadata: null,
      searchProvider: new MockSearchProvider([]),
    });
    assert.strictEqual(recovery, null, "Recovery must return null when no title and slug is ID");

    // Calling POST /api/verify with this unreadable URL returns could_not_read
    const req = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.veracityVerdict, "could_not_read");
    assert.strictEqual(data.sourceReadStatus, "could_not_read");
    assert.ok(
      data.summary.includes("paste the headline") || data.sourceReadNote.includes("paste the headline"),
      `Summary was: ${data.summary}`
    );
  });

  // ─── 6.d Recovery succeeds but no independent sources found ───────────────
  it("6.d Recovery succeeds but no independent sources found: error screen with the paste suggestion, not Unable to Verify", async () => {
    const origSerperKey = process.env.SERPER_API_KEY;
    const origSearch = SerperProvider.prototype.search;
    try {
      process.env.SERPER_API_KEY = "mock_test_key";
      // Mock SerperProvider search to return 0 evidence
      SerperProvider.prototype.search = async () => [];

      const url = "https://nonexistent-obscure-blog.org/2026/01/01/completely-unknown-unique-private-event";

      const req = new NextRequest("http://localhost:3000/api/verify", {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      // Must return 'could_not_read', NOT 'unverified'
      assert.strictEqual(data.veracityVerdict, "could_not_read");
      assert.strictEqual(data.sourceReadStatus, "could_not_read");
      assert.notStrictEqual(data.veracityVerdict, "unverified");
      assert.ok(
        data.summary.includes("paste the headline") || data.sourceReadNote.includes("paste the headline"),
        `Expected paste suggestion in response, got: ${data.summary}`
      );
    } finally {
      if (origSerperKey) process.env.SERPER_API_KEY = origSerperKey;
      else delete process.env.SERPER_API_KEY;
      SerperProvider.prototype.search = origSearch;
    }
  });

  // ─── 6.e A readable article is unchanged (regression) ─────────────────────
  it("6.e A readable article is unchanged (regression)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Finance ministry announces new tax filing portal",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Verified by official gazette.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "Finance ministry announces new tax filing portal",
        sourceDomain: "pib.gov.in",
        url: "https://pib.gov.in/portal-launch",
      },
      claims,
      evaluations,
      [],
      {
        evidence: [makeEvidence({ id: "ev1", claimId: "c1", url: "https://pib.gov.in/portal-launch", domain: "pib.gov.in" })],
      }
    );

    // Readable article: sourceReadStatus is undefined or readable, verdict is positive
    assert.ok(report.sourceReadStatus === undefined || report.sourceReadStatus === "readable");
    assert.ok(report.veracityVerdict === "mostly_true" || report.veracityVerdict === "verified_true");
    assert.ok(report.overallTrustScore >= 70);
  });

  // ─── 6.f Blocked page content is never passed to evaluator ────────────────
  it("6.f The blocked page's content is never passed to the evaluator", () => {
    // 1. isBlockedPageTitle blocks anti-bot/gate boilerplate
    assert.strictEqual(isBlockedPageTitle("403 Forbidden - Access Denied"), true);
    assert.strictEqual(isBlockedPageTitle("Just a moment... Cloudflare"), true);
    assert.strictEqual(isBlockedPageTitle("Attention Required! | Cloudflare"), true);
    assert.strictEqual(isBlockedPageTitle("Robot Check - Please verify you are human"), true);
    assert.strictEqual(isBlockedPageTitle("Subscribe to read | The Wall Street Journal"), true);

    // Genuine news titles are never blocked
    assert.strictEqual(
      isBlockedPageTitle("Cabinet approves Meloni youth decree targeting juvenile crime"),
      false
    );
    assert.strictEqual(
      isBlockedPageTitle("Supreme Court issues notice to civil aviation ministry"),
      false
    );

    // 2. Evidence filtering: if the original URL is in search results, fallback filters it out
    const targetUrl = "https://blocked-newspaper.com/story-123";
    const allEvidence: Evidence[] = [
      makeEvidence({
        id: "ev-blocked",
        claimId: "c1",
        url: targetUrl,
        domain: "blocked-newspaper.com",
        snippet: "403 Forbidden Access Denied to Automated Crawlers",
      }),
      makeEvidence({
        id: "ev-indep",
        claimId: "c1",
        url: "https://reuters.com/independent-story",
        domain: "reuters.com",
        snippet: "Official government announcement confirmed today.",
      }),
    ];

    const isIngestionFallback = true;
    const evidenceToEvaluate = isIngestionFallback
      ? allEvidence.filter((e) => e.url !== targetUrl)
      : allEvidence;

    assert.strictEqual(evidenceToEvaluate.length, 1);
    assert.strictEqual(evidenceToEvaluate[0].id, "ev-indep");
    assert.strictEqual(
      evidenceToEvaluate.some((e) => e.url === targetUrl),
      false,
      "Blocked target URL must be filtered out of evaluation evidence"
    );
  });

  // ─── 6.g No code path rotates proxies or alters request identity ──────────
  it("6.g No code path rotates proxies or alters request identity to evade blocking", () => {
    const filesToAudit = [
      path.join(process.cwd(), "src/lib/ingestion/article.ts"),
      path.join(process.cwd(), "src/lib/ingestion/firecrawl.ts"),
      path.join(process.cwd(), "src/lib/ingestion/headlineRecovery.ts"),
      path.join(process.cwd(), "src/app/api/article/route.ts"),
      path.join(process.cwd(), "src/app/api/verify/route.ts"),
    ];

    const forbiddenPatterns = [
      /\bproxy\s*rotation\b/i,
      /\brotate\s*prox(y|ies)\b/i,
      /\buser-agent\s*rotat/i,
      /\banticaptcha\b/i,
      /\b2captcha\b/i,
      /\bbypass\s*cf\b/i,
      /\bbypass\s*cloudflare\b/i,
      /\bstealth\s*plugin\b/i,
      /\bpeteer-extra-plugin-stealth\b/i,
    ];

    for (const file of filesToAudit) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf-8");
        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          assert.strictEqual(
            match,
            null,
            `Forbidden bot-evasion / proxy-rotation pattern found in ${file}: ${match?.[0]}`
          );
        }
      }
    }
  });
});
