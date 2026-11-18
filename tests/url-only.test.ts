import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as verifyPOST } from "../src/app/api/verify/route";
import { POST as articlePOST } from "../src/app/api/article/route";
import { POST as claimsPOST } from "../src/app/api/claims/route";
import {
  validateInput,
  detectInputType,
  parseAndAnalyzeInput,
  extractArticleUrl,
  isNonArticleUrl,
} from "../src/lib/input/detectInputType";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { VerificationReportSchema } from "../src/schemas/verification";

function makeEvidence(e: Partial<Evidence> & { id: string; claimId: string; url: string; domain: string }): Evidence {
  return {
    title: "Test Evidence Title",
    snippet: "Test evidence snippet confirming facts.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "international_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2024-01-01T00:00:00Z",
    sourceContentStatus: "snippet_only",
    ...e,
  } as Evidence;
}

describe("URL-Only Verification & Flag Gating Test Suite", () => {
  const origTextInput = process.env.TEXT_INPUT_ENABLED;
  const origUnreadable = process.env.UNREADABLE_FALLBACK_ENABLED;

  beforeEach(() => {
    // Default mode: URL only
    process.env.TEXT_INPUT_ENABLED = "false";
    process.env.UNREADABLE_FALLBACK_ENABLED = "false";
  });

  afterEach(() => {
    if (origTextInput !== undefined) {
      process.env.TEXT_INPUT_ENABLED = origTextInput;
    } else {
      delete process.env.TEXT_INPUT_ENABLED;
    }
    if (origUnreadable !== undefined) {
      process.env.UNREADABLE_FALLBACK_ENABLED = origUnreadable;
    } else {
      delete process.env.UNREADABLE_FALLBACK_ENABLED;
    }
  });

  // ─── 7.a A valid article URL verifies exactly as before ───────────────────────
  it("7.a A valid article URL verifies exactly as before (scores, verdicts and report JSON unchanged)", async () => {
    const url = "https://reuters.com/business/finance/federal-reserve-interest-rate-cut";
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Federal Reserve lowers benchmark interest rate by 50 basis points",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];
    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        url: "https://bloomberg.com/markets/fed-rate-cut",
        domain: "bloomberg.com",
        relationship: "supporting",
      }),
    ];
    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Federal Reserve official statement confirms 50 bps reduction.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "Federal Reserve lowers benchmark interest rate",
        sourceDomain: "reuters.com",
        url,
      },
      claims,
      evaluations,
      [],
      { evidence }
    );

    assert.strictEqual(report.articleUrl, url);
    assert.strictEqual(report.sourceDomain, "reuters.com");
    assert.strictEqual(report.veracityVerdict, "verified_true");
    assert.strictEqual(report.overallTrustScore, 96);
    assert.strictEqual(report.confidence, "medium");

    // Validate JSON schema
    const parsedSchema = VerificationReportSchema.safeParse(report);
    assert.ok(parsedSchema.success, "VerificationReport must match schema");
  });

  // ─── 7.b Plain headline, claim, and text rejected client and server ───────────
  it("7.b Plain headline, claim and multi-paragraph text are rejected client-side and server-side with no pipeline run", async () => {
    const inputs = [
      "Meloni toughens protest laws with 5-year jail term",
      '"India will win the 2027 World Cup" - Captain',
      "First paragraph of breaking news.\n\nSecond paragraph with multiple claims and analysis.",
    ];

    for (const text of inputs) {
      // Client-side validation check
      const clientVal = validateInput(text);
      assert.strictEqual(clientVal.isValid, false, `Should reject input: ${text}`);
      assert.strictEqual(
        clientVal.errorMessage,
        "FakeNewzz currently checks news article links. Paste a link to the article."
      );

      // Server-side /api/verify check
      const reqVerify = new NextRequest("http://localhost:3000/api/verify", {
        method: "POST",
        body: JSON.stringify({ input: text }),
        headers: { "Content-Type": "application/json" },
      });
      const resVerify = await verifyPOST(reqVerify);
      assert.strictEqual(resVerify.status, 400);
      const dataVerify = await resVerify.json();
      assert.ok(dataVerify.error);
      assert.strictEqual(
        dataVerify.error.message,
        "FakeNewzz currently checks news article links. Paste a link to the article."
      );

      // Server-side /api/article check
      const reqArticle = new NextRequest("http://localhost:3000/api/article", {
        method: "POST",
        body: JSON.stringify({ url: text }),
        headers: { "Content-Type": "application/json" },
      });
      const resArticle = await articlePOST(reqArticle);
      assert.strictEqual(resArticle.status, 400);

      // Server-side /api/claims check
      const reqClaims = new NextRequest("http://localhost:3000/api/claims", {
        method: "POST",
        body: JSON.stringify({ input: text }),
        headers: { "Content-Type": "application/json" },
      });
      const resClaims = await claimsPOST(reqClaims);
      assert.strictEqual(resClaims.status, 400);
    }
  });

  // ─── 7.c 'check this https://example.com/news/x' extracts the URL ─────────────
  it("7.c 'check this https://example.com/news/x' extracts the URL", () => {
    const inputWithWords = "check this https://example.com/news/x";
    const extracted = extractArticleUrl(inputWithWords);
    assert.strictEqual(extracted, "https://example.com/news/x");

    const validated = validateInput(inputWithWords);
    assert.strictEqual(validated.isValid, true);
    assert.strictEqual(validated.sanitized, "https://example.com/news/x");

    const parsed = parseAndAnalyzeInput(inputWithWords);
    assert.strictEqual(parsed.type, "url");
    assert.strictEqual(parsed.url, "https://example.com/news/x");
    assert.strictEqual(parsed.targetUrl, "https://example.com/news/x");

    // Also works with no scheme and trailing punctuation
    const inputNoScheme = "look at reuters.com/world/india/election-results-2024!";
    const extractedNoScheme = extractArticleUrl(inputNoScheme);
    assert.strictEqual(extractedNoScheme, "https://reuters.com/world/india/election-results-2024");
  });

  // ─── 7.d A bare homepage URL is rejected with the article message ─────────────
  it("7.d A bare homepage URL is rejected with the article message", async () => {
    const homepages = [
      "https://nytimes.com",
      "https://nytimes.com/",
      "bbc.com",
      "https://edition.cnn.com",
      "https://thehindu.com/search?q=election",
    ];

    for (const hp of homepages) {
      assert.strictEqual(isNonArticleUrl(hp), true, `Must be identified as non-article: ${hp}`);

      const validation = validateInput(hp);
      assert.strictEqual(validation.isValid, false, `Must fail validation: ${hp}`);
      assert.strictEqual(
        validation.errorMessage,
        "Paste the link to a specific article."
      );

      // Verify server route also returns 400 with this message
      const req = new NextRequest("http://localhost:3000/api/verify", {
        method: "POST",
        body: JSON.stringify({ url: hp }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await verifyPOST(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.message, "Paste the link to a specific article.");
    }
  });

  // ─── 7.e Calling API directly with text returns 400 and no stack trace ─────────
  it("7.e Calling the API directly with text returns 400 and no stack trace", async () => {
    const payloads = [
      { input: "Direct text submission bypassing the client." },
      { text: "Another bypass payload" },
      { claims: [{ text: "Pre-evaluated claim" }] }, // Case A without articleUrl
    ];

    for (const body of payloads) {
      const req = new NextRequest("http://localhost:3000/api/verify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      const res = await verifyPOST(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
      assert.strictEqual(typeof json.error.message, "string");
      assert.strictEqual(json.stack, undefined, "Must not leak stack trace");
      assert.strictEqual(json.error.stack, undefined, "Must not leak error.stack");
    }
  });

  // ─── 7.f Blocked article shows unreadable screen, starts no fallback ──────────
  it("7.f A blocked article shows the unreadable screen and starts no fallback verification", async () => {
    const blockedUrl = "https://wsj.com/articles/paywalled-subscription-required-12345";

    const req = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      body: JSON.stringify({ url: blockedUrl }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await verifyPOST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.veracityVerdict, "could_not_read");
    assert.strictEqual(data.sourceReadStatus, "could_not_read");
    assert.strictEqual(
      data.summary,
      "The publisher may block automated access or require a subscription. Try another link to the same story."
    );
    assert.strictEqual(data.claimSummary.total, 0);
    assert.strictEqual(data.evaluations.length, 0);
  });

  // ─── 7.g Old text-type reports render or show the notice ──────────────────────
  it("7.g Old text-type reports render or show the notice without crashing", async () => {
    const legacyReport = await buildReport(
      {
        title: "Legacy Text Report Title",
        sourceDomain: "Independent Claim",
        url: null,
      },
      [
        {
          id: "c1",
          text: "Some historical claim checked before URL-only migration",
          importance: "high",
          claimType: "event",
          layer: "event_occurred",
          certainty: "asserted_fact",
        },
      ],
      [
        {
          claimId: "c1",
          verdict: "supporting",
          confidence: "medium",
          explanation: "Supported by public records.",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      [],
      {
        evidence: [
          makeEvidence({
            id: "ev1",
            claimId: "c1",
            url: "https://archive.org/details/test",
            domain: "archive.org",
            relationship: "supporting",
          }),
        ],
      }
    );

    assert.strictEqual(legacyReport.sourceDomain, "Independent Claim");
    assert.strictEqual(legacyReport.articleUrl, null);
    assert.strictEqual(legacyReport.veracityVerdict, "mostly_true");

    // Validates cleanly against schema
    const parsed = VerificationReportSchema.safeParse(legacyReport);
    assert.ok(parsed.success);
  });

  // ─── 7.h Grep test: No user-facing string mentions headlines, claims or text ─
  it("7.h No remaining user-facing string mentions headlines, claims or text input", () => {
    const userFacingFiles = [
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/components/layout/Header.tsx",
      "src/components/verification/SearchBar.tsx",
      "src/components/verification/NewsBackdrop.tsx",
      "src/components/verification/ScoreCard.tsx",
      "src/components/verification/ErrorState.tsx",
      "README.md",
    ];

    const forbiddenPatterns = [
      /paste the headline/i,
      /paste a headline/i,
      /enter a headline/i,
      /headline or claim/i,
      /claim or text/i,
      /paste news text/i,
      /paste an article headline/i,
      /enter a news link, headline/i,
    ];

    for (const relPath of userFacingFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        assert.strictEqual(
          match,
          null,
          `Forbidden user-facing pattern ${pattern} found in ${relPath}: "${match?.[0]}"`
        );
      }
    }
  });

  // ─── 7.i With both flags set to true locally, old behavior is restored ─────────
  it("7.i With both flags set to true locally, the old behavior is restored", async () => {
    process.env.TEXT_INPUT_ENABLED = "true";
    process.env.UNREADABLE_FALLBACK_ENABLED = "true";

    const textInput = "Meloni toughens protest laws with 5-year jail term";
    const val = validateInput(textInput);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(detectInputType(textInput), "headline");

    const parsed = parseAndAnalyzeInput(textInput);
    assert.strictEqual(parsed.type, "headline");
    assert.strictEqual(parsed.text, textInput);
  });
});
