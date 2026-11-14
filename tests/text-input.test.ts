import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/verify/route";
import {
  detectInputType,
  parseAndAnalyzeInput,
  validateInput,
  extractUrlAndContext,
  isSingleTokenUrl,
  MAX_INPUT_CHARS,
} from "../src/lib/input/detectInputType";
import { VerifyArticleRequestSchema } from "../src/schemas/verification";
import { decomposeStatementClaims } from "../src/lib/verification/statementIntent";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";

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

describe("Text Input & Non-URL Verification Test Suite", () => {
  // ─── 1. Inputs a-d reach pipeline as right type and are not rejected ──────────
  it("1. Inputs a-d reach the pipeline as the right type and are not rejected", () => {
    // a. Italian decree headline
    const inputA = "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term";
    const valA = validateInput(inputA);
    assert.strictEqual(valA.isValid, true);
    const typeA = detectInputType(inputA);
    assert.strictEqual(typeA, "headline");
    const parsedA = parseAndAnalyzeInput(inputA);
    assert.strictEqual(parsedA.type, "headline");
    assert.strictEqual(parsedA.text, inputA);

    // b. Hardik Pandya transfer rumour
    const inputB = "Hardik Pandya will join Punjab Kings in IPL 2027";
    const valB = validateInput(inputB);
    assert.strictEqual(valB.isValid, true);
    const typeB = detectInputType(inputB);
    assert.strictEqual(typeB, "headline");
    const parsedB = parseAndAnalyzeInput(inputB);
    assert.strictEqual(parsedB.type, "headline");
    assert.strictEqual(parsedB.text, inputB);

    // c. 3-paragraph pasted news message
    const inputC = `Rome — Italy's right-wing government has approved a sweeping security package targeting youth crime and protest disruptions.

Under the new decree, minors aged 14 and older can be detained for carrying offensive weapons, while prison terms for assaulting public officials are increased up to five years.

Opposition parties criticized the measures as authoritarian, while Prime Minister Giorgia Meloni defended the decree as a necessary step to restore safety in urban centres.`;
    const valC = validateInput(inputC);
    assert.strictEqual(valC.isValid, true);
    const typeC = detectInputType(inputC);
    assert.strictEqual(typeC, "text");
    const parsedC = parseAndAnalyzeInput(inputC);
    assert.strictEqual(parsedC.type, "text");
    assert.strictEqual(parsedC.text, inputC);

    // Decomposing 3 paragraphs yields multiple claims, not a single monolithic claim
    const claimsC = decomposeStatementClaims(inputC, "claim-c");
    assert.ok(claimsC.length >= 3, `Expected at least 3 claims from 3 paragraphs, got ${claimsC.length}`);
    assert.strictEqual(claimsC[0].importance, "high");

    // d. The same headline typed after a URL just failed
    const failedUrl = "https://timesofindia.indiatimes.com/blocked-article-12345.cms";
    // Simulate pipeline resetting error and submitting fresh headline
    const valD = validateInput(inputA);
    assert.strictEqual(valD.isValid, true);
    const parsedD = parseAndAnalyzeInput(valD.sanitized);
    assert.strictEqual(parsedD.type, "headline");
    assert.strictEqual(parsedD.targetUrl, undefined);
    assert.strictEqual(parsedD.text, inputA);
  });

  // ─── 2. Normal URL detected as 'url' ──────────────────────────────────────────
  it("2. Normal URL is detected as 'url'", () => {
    const urls = [
      "https://www.reuters.com/world/europe/italy-approves-youth-crime-decree-2023-09-07/",
      "http://bbc.com/news/world-66743900",
      "timesofindia.indiatimes.com/india/supreme-court-aviation-rules/articleshow/108345.cms",
      "https://indianexpress.com/article/political-pulse/samrat-choudhary-remark-901234/",
    ];

    for (const u of urls) {
      assert.strictEqual(isSingleTokenUrl(u), true, `Expected single token URL for: ${u}`);
      assert.strictEqual(detectInputType(u), "url", `Expected 'url' type for: ${u}`);
      const parsed = parseAndAnalyzeInput(u);
      assert.strictEqual(parsed.type, "url");
      assert.ok(parsed.targetUrl?.startsWith("http"), `Expected targetUrl with http scheme for: ${u}`);
    }
  });

  // ─── 3. Embedded URL with surrounding context ─────────────────────────────────
  it("3. 'check this https://example.com/news/x' extracts URL, keeps surrounding context, and reports notice", () => {
    const input = "check this https://example.com/news/italian-decree for verification";
    const embedded = extractUrlAndContext(input);
    assert.ok(embedded, "extractUrlAndContext should match embedded URL");
    assert.strictEqual(embedded.url, "https://example.com/news/italian-decree");
    assert.strictEqual(embedded.surroundingContext, "check this for verification");
    assert.ok(embedded.notice.includes("https://example.com/news/italian-decree"));
    assert.ok(embedded.notice.includes("using your surrounding text as context"));

    const parsed = parseAndAnalyzeInput(input);
    assert.strictEqual(parsed.type, "url");
    assert.strictEqual(parsed.targetUrl, "https://example.com/news/italian-decree");
    assert.strictEqual(parsed.surroundingContext, "check this for verification");
    assert.ok(parsed.notice?.includes("surrounding text"));
  });

  // ─── 4. Client validation: empty & oversized inputs ────────────────────────────
  it("4. Empty input and oversized input (>10,000 chars) are rejected with specific messages (never 'enter a link')", () => {
    // Empty input
    const emptyResult = validateInput("   ");
    assert.strictEqual(emptyResult.isValid, false);
    assert.strictEqual(emptyResult.errorCode, "EMPTY_INPUT");
    assert.ok(emptyResult.errorMessage?.includes("Please enter a news link, headline, claim, or text to verify"));
    assert.strictEqual(emptyResult.errorMessage?.includes("link only"), false);

    // Oversized input
    const hugeInput = "A".repeat(MAX_INPUT_CHARS + 50);
    const oversizedResult = validateInput(hugeInput);
    assert.strictEqual(oversizedResult.isValid, false);
    assert.strictEqual(oversizedResult.errorCode, "INPUT_TOO_LONG");
    assert.ok(oversizedResult.errorMessage?.includes("exceeds the maximum allowed length of 10,000 characters"));
    assert.strictEqual(oversizedResult.errorMessage?.includes("enter a link"), false);
  });

  // ─── 5. Submitting text after failed URL works without reusing old URL ─────────
  it("5. Submitting text after failed URL works without reusing old URL", () => {
    let activeQuery = "https://timesofindia.indiatimes.com/blocked-page-403";
    let activeError: string | null = "We couldn't read this article.";

    // User now types headline in search box
    const newHeadline = "Supreme Court dismisses petition on airfares";
    activeError = null; // Cleared on new submission
    activeQuery = newHeadline;

    const val = validateInput(activeQuery);
    assert.strictEqual(val.isValid, true);
    const parsed = parseAndAnalyzeInput(activeQuery);
    assert.strictEqual(parsed.type, "headline");
    assert.strictEqual(parsed.targetUrl, undefined);
    assert.strictEqual(parsed.text, newHeadline);
  });

  // ─── 6. Hindi / Devanagari and Hinglish headlines detected as headline or claim ─
  it("6. Hindi and Hinglish inputs are detected as headline or claim, never as a URL", () => {
    // Hindi / Devanagari headline
    const hindiHeadline = "सुप्रीम कोर्ट ने वायुसेना भर्ती नियमों पर केंद्र सरकार से मांगा जवाब";
    assert.strictEqual(detectInputType(hindiHeadline), "headline");
    const parsedHindi = parseAndAnalyzeInput(hindiHeadline);
    assert.strictEqual(parsedHindi.type, "headline");
    assert.strictEqual(parsedHindi.targetUrl, undefined);

    // Hinglish attributed quote
    const hinglishQuote = '"Humare yaha apraadh nhi h crime h" — Samrat Choudhary';
    assert.strictEqual(detectInputType(hinglishQuote), "claim");
    const parsedHinglish = parseAndAnalyzeInput(hinglishQuote);
    assert.strictEqual(parsedHinglish.type, "claim");
    assert.strictEqual(parsedHinglish.targetUrl, undefined);

    // Hinglish headline without quotes (detected as headline or claim, never as a url)
    const hinglishHeadline = "Bihar me apraadh badh raha hai ya crime, bole deputy CM";
    const typeHinglish = detectInputType(hinglishHeadline);
    assert.ok(typeHinglish === "headline" || typeHinglish === "claim");
    assert.notStrictEqual(typeHinglish, "url");
  });

  // ─── 7. API route accepts { input } without requiring { url } ─────────────────
  it("7. API route accepts { input } without requiring { url }, returning 200 and a verification report", async () => {
    // A. Schema validates payload with only input
    const schemaValidation = VerifyArticleRequestSchema.safeParse({
      input: "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term",
      inputType: "headline",
    });
    assert.strictEqual(schemaValidation.success, true);
    assert.strictEqual(schemaValidation.data?.url, undefined);
    assert.strictEqual(schemaValidation.data?.inputType, "headline");

    // B. Direct API POST with pre-evaluated components (CASE A synthesis)
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term",
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
        title: "Italy approves new youth crime package",
        url: "https://reuters.com/world/italy-youth-crime",
        domain: "reuters.com",
        relationship: "supporting",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c1",
        title: "Meloni cabinet backs stricter juvenile penal measures",
        url: "https://ansa.it/english/news/security-decree",
        domain: "ansa.it",
        relationship: "supporting",
      }),
    ];
    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by Reuters and ANSA independent reporting.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const req = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleTitle: "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term",
        sourceDomain: "Independent Claim",
        claims,
        evaluations,
        omissions: [],
        evidence,
        input: "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term",
        inputType: "headline",
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.articleTitle, "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term");
    assert.strictEqual(data.sourceDomain, "Independent Claim");
    assert.strictEqual(data.veracityVerdict, "verified_true");
    assert.ok(data.overallTrustScore >= 80);
    assert.strictEqual(data.claimSummary.supporting, 1);
  });

  // ─── 8. Regression: URL inputs produce identical verification results ─────────
  it("8. Regression: existing URL input produces identical verification score and verdict", async () => {
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
    assert.strictEqual(report.veracityVerdict, "verified_true");
    assert.strictEqual(report.overallTrustScore, 96);
  });
});
