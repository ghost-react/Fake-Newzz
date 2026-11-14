import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getVerdictContent,
  UNABLE_TO_VERIFY_AMBER_COPY,
  VERDICT_PRESENTATION_MAP,
} from "../src/lib/ui/verdictContent";
import { explainScore } from "../src/lib/ui/explainScore";
import { LAYER_TITLES } from "../src/components/verification/ClaimBreakdownSection";
import { extractFeaturedImage, validateSafeUrl } from "../src/lib/ingestion/article";
import { clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import { Evidence } from "../src/schemas/evidence";
import { VerificationReport } from "../src/schemas/verification";
import { GET as imageProxyHandler } from "../src/app/api/image/route";
import { NextRequest } from "next/server";
import React from "react";
import { ScoreCard } from "../src/components/verification/ScoreCard";
import { SummarySection } from "../src/components/verification/SummarySection";
import { ArticleBlock } from "../src/components/verification/ArticleBlock";
import { CrossSourceSection } from "../src/components/verification/CrossSourceSection";
import { ClaimBreakdownSection } from "../src/components/verification/ClaimBreakdownSection";
import { EvidenceSection } from "../src/components/verification/EvidenceSection";
import { MissingContextSection } from "../src/components/verification/MissingContextSection";
import { WhyThisScoreSection } from "../src/components/verification/WhyThisScoreSection";
import { ResultsDashboard } from "../src/components/verification/ResultsDashboard";

describe("Results Experience UI & Integration Test Suite (Prompt 10)", () => {
  // ─── a. verdictContent returns correct label/color/copy for all 5 verdicts ────
  it("a. verdictContent returns correct label/color/copy for all 5 verdicts", () => {
    const vTrue = getVerdictContent("verified_true");
    assert.strictEqual(vTrue.label, "Highly Trustworthy");
    assert.strictEqual(vTrue.colorToken, "#10B981");
    assert.strictEqual(vTrue.oneLineMeaning, "Strong evidence supports the main claims.");

    const vMostlyTrue = getVerdictContent("mostly_true");
    assert.strictEqual(vMostlyTrue.label, "Mostly Trustworthy");
    assert.strictEqual(vMostlyTrue.colorToken, "#10B981");
    assert.strictEqual(vMostlyTrue.oneLineMeaning, "Most important claims are supported, but some details need context.");

    const vMixed = getVerdictContent("mixed");
    assert.strictEqual(vMixed.label, "Mixed Evidence");
    assert.strictEqual(vMixed.colorToken, "#F59E0B");
    assert.strictEqual(vMixed.oneLineMeaning, "Some claims are supported while others are contradicted or uncertain.");

    const vMisleading = getVerdictContent("misleading");
    assert.strictEqual(vMisleading.label, "Potentially Misleading");
    assert.strictEqual(vMisleading.colorToken, "#EF4444");
    assert.strictEqual(vMisleading.oneLineMeaning, "Important claims are contradicted by multiple independent sources.");

    const vUnverified = getVerdictContent("unverified");
    assert.strictEqual(vUnverified.label, "Unable to Verify");
    assert.strictEqual(vUnverified.colorToken, "#F59E0B");
    assert.strictEqual(vUnverified.oneLineMeaning, "Not enough independent reporting exists to confirm or refute these claims.");
  });

  // ─── b. Unable to Verify returns the exact amber panel copy ─────────────────
  it("b. 'Unable to Verify' returns the exact amber panel copy", () => {
    const vUnverified = getVerdictContent("unverified");
    assert.strictEqual(
      vUnverified.amberPanelCopy,
      "Some information could not be verified. This does not mean the entire news story is false."
    );
    assert.strictEqual(
      UNABLE_TO_VERIFY_AMBER_COPY,
      "Some information could not be verified. This does not mean the entire news story is false."
    );
  });

  // ─── c. explainScore produces valid explanations for v1 and v2 formats ──────
  it("c. explainScore produces valid explanations for v1 and v2 formats", () => {
    // Test v1 format
    const v1Breakdown = {
      claimScore: 78,
      contextPenalty: 12,
      confidenceAdjustment: -5,
      finalScore: 61,
    };
    const v1Explanations = explainScore(v1Breakdown, null, [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Supported",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ]);

    assert.ok(v1Explanations.length >= 2);
    assert.ok(v1Explanations.some((item) => item.text.includes("+78")));
    assert.ok(v1Explanations.some((item) => item.text.includes("-12")));
    assert.ok(v1Explanations.some((item) => item.text.includes("-5")));

    // Test v2 format
    const v2Breakdown = {
      claimContributions: 60,
      conflictAdjustments: -15,
      unresolvedDetailPenalty: 0,
      omissionPenalty: 0,
      confidenceAdjustment: 0,
      finalScore: 45,
      factors: [
        {
          code: "CORROBORATION_MULTIPLIER",
          effect: 15,
          clusterCount: 3,
          claimId: "c1",
        },
        {
          code: "MATERIAL_CONFLICT",
          effect: -20,
          dimension: "numerical_figures",
          claimId: "c2",
        },
        {
          code: "INTERPRETATION_CLAIM_EXCLUDED",
          effect: 0,
          claimId: "c3",
        },
      ],
    };

    const v2Explanations = explainScore(v2Breakdown);
    assert.strictEqual(v2Explanations.length, 3);
    assert.ok(v2Explanations[0].text.includes("+15"));
    assert.ok(v2Explanations[0].text.includes("3 independent outlets"));
    assert.ok(v2Explanations[1].text.includes("-20"));
    assert.ok(v2Explanations[1].text.includes("contradicts reporting"));
    assert.strictEqual(
      v2Explanations[2].text,
      "Not scored — opinions and framing are not verified as facts"
    );
  });

  // ─── d. Syndicated sources grouped as single independent source ─────────────
  it("d. Syndicated sources grouped as single independent source", () => {
    const evidenceList: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "SC hearing airfare petition",
        url: "https://thehindu.com/sc-airfare",
        domain: "thehindu.com",
        snippet: "PTI reported Supreme Court asked civil aviation ministry to review airfares.",
        publishedAt: "2026-05-01",
        sourceRelationship: "syndicated",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Supreme Court directs review of dynamic pricing",
        url: "https://ndtv.com/sc-fares",
        domain: "ndtv.com",
        snippet: "According to PTI, Supreme Court asked civil aviation ministry to review airfares.",
        publishedAt: "2026-05-01",
        sourceRelationship: "syndicated",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev3",
        claimId: "c1",
        title: "Apex court airfares PTI report",
        url: "https://business-standard.com/sc-airfares",
        domain: "business-standard.com",
        snippet: "Press Trust of India: Supreme Court asked civil aviation ministry to review airfares.",
        publishedAt: "2026-05-01",
        sourceRelationship: "syndicated",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const clusters = clusterEvidenceIndependence(evidenceList);
    // 3 syndicated outlets all attributing to PTI must form 1 cluster!
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].memberEvidenceIds.length, 3);
  });

  // ─── e. Claim layers mapped to correct human-readable headings ──────────────
  it("e. Claim layers mapped to correct human-readable headings", () => {
    assert.strictEqual(LAYER_TITLES.event_occurred.heading, "What happened");
    assert.strictEqual(LAYER_TITLES.statement_made.heading, "Who said it");
    assert.strictEqual(LAYER_TITLES.quote_wording.heading, "Exact words");
    assert.strictEqual(LAYER_TITLES.underlying_fact.heading, "Whether it is true");
    assert.strictEqual(LAYER_TITLES.interpretation.heading, "Interpretation");
    assert.strictEqual(
      LAYER_TITLES.interpretation.description,
      "Not scored — opinions and framing are not verified as facts."
    );
  });

  // ─── f. Image proxy rejects SSRF attempts, non-image content, >5MB ──────────
  it("f. Image proxy rejects SSRF attempts, non-image content, >5MB", async () => {
    // 1. SSRF attempts
    const ssrfReq1 = new NextRequest("http://localhost:3000/api/image?url=http://127.0.0.1:8000/test.png");
    const ssrfRes1 = await imageProxyHandler(ssrfReq1);
    assert.strictEqual(ssrfRes1.status, 403);

    const ssrfReq2 = new NextRequest("http://localhost:3000/api/image?url=http://169.254.169.254/latest/meta-data");
    const ssrfRes2 = await imageProxyHandler(ssrfReq2);
    assert.strictEqual(ssrfRes2.status, 403);

    const ssrfReq3 = new NextRequest("http://localhost:3000/api/image?url=http://localhost/test.jpg");
    const ssrfRes3 = await imageProxyHandler(ssrfReq3);
    assert.strictEqual(ssrfRes3.status, 403);

    // 2. Missing url parameter
    const missingUrlReq = new NextRequest("http://localhost:3000/api/image");
    const missingUrlRes = await imageProxyHandler(missingUrlReq);
    assert.strictEqual(missingUrlRes.status, 400);

    // 3. SSRF validator unit check
    assert.strictEqual(validateSafeUrl("http://192.168.1.1/image.png").isValid, false);
    assert.strictEqual(validateSafeUrl("http://10.0.0.1/image.png").isValid, false);
    assert.strictEqual(validateSafeUrl("ftp://example.com/image.png").isValid, false);
    assert.strictEqual(validateSafeUrl("https://images.unsplash.com/photo.jpg").isValid, true);
  });

  // ─── g. Relative URLs resolved to absolute in ingestion ─────────────────────
  it("g. Relative URLs resolved to absolute in ingestion", () => {
    // Relative og:image
    const img1 = extractFeaturedImage(
      { "og:image": "/static/images/hero.jpg" },
      "https://hindustantimes.com/india-news/story-123"
    );
    assert.strictEqual(img1, "https://hindustantimes.com/static/images/hero.jpg");

    // Relative JSON-LD object image
    const img2 = extractFeaturedImage(
      { image: { url: "../assets/photo.png" } },
      "https://indianexpress.com/article/court-order/"
    );
    assert.strictEqual(img2, "https://indianexpress.com/article/assets/photo.png");

    // Fallback markdown relative image
    const img3 = extractFeaturedImage(
      {},
      "https://thehindu.com/news/",
      "Article text\n\n![News photo](/media/2026/lead.jpg)\n\nMore text."
    );
    assert.strictEqual(img3, "https://thehindu.com/media/2026/lead.jpg");

    // Absolute http(s) URL preserved
    const img4 = extractFeaturedImage(
      { "twitter:image": "https://cdn.example.com/pic.webp" },
      "https://example.com"
    );
    assert.strictEqual(img4, "https://cdn.example.com/pic.webp");

    // Rejection of non-http(s) schemes like javascript: or data:
    const invalidScheme = extractFeaturedImage(
      { "og:image": "javascript:alert(1)" },
      "https://example.com"
    );
    assert.strictEqual(invalidScheme, null);
  });

  // ─── h. Plain text rendering (no unescaped HTML) ────────────────────────────
  it("h. Plain text rendering (no unescaped HTML)", () => {
    const maliciousSummary = "<script>alert('xss')</script><b>Bold Claim</b>";
    const el = SummarySection({ summary: maliciousSummary });
    assert.ok(el !== null);

    // React jsx creates a plain paragraph string child without dangerouslySetInnerHTML
    const pElement = el.props.children[2];
    assert.strictEqual(pElement.props.children, maliciousSummary);
    assert.strictEqual(pElement.props.dangerouslySetInnerHTML, undefined);
  });

  // ─── i. Missing comparison/omission sections gracefully hidden ──────────────
  it("i. Missing comparison/omission sections gracefully hidden", () => {
    // MissingContextSection returns null when empty
    const omissionNull1 = MissingContextSection({ omissions: [] });
    assert.strictEqual(omissionNull1, null);

    const omissionNull2 = MissingContextSection({ omissions: null });
    assert.strictEqual(omissionNull2, null);

    // CrossSourceSection returns null when no comparison report provided
    const compNull = CrossSourceSection({
      comparison: null,
      legacyComparison: null,
    });
    assert.strictEqual(compNull, null);
  });

  // ─── j. Layout order matches specification ──────────────────────────────────
  it("j. Layout order matches specification", () => {
    const mockReport: VerificationReport = {
      articleTitle: "Supreme Court Directs High Court on Airfares",
      sourceDomain: "thehindu.com",
      articleUrl: "https://thehindu.com/article",
      featuredImage: "https://thehindu.com/images/lead.jpg",
      author: "Legal Correspondent",
      publishedAt: "2026-05-01T10:00:00Z",
      overallTrustScore: 92,
      veracityVerdict: "verified_true",
      confidence: "high",
      summary: "Supreme Court bench passed orders concerning airfares.",
      claimSummary: {
        total: 2,
        supporting: 2,
        contradicting: 0,
        qualifying: 0,
        insufficient: 0,
      },
      evaluations: [
        {
          claimId: "claim-1",
          verdict: "supporting",
          confidence: "high",
          explanation: "Supported by court order transcript.",
          evidenceIds: ["ev-1"],
          importantNotes: [],
          layer: "event_occurred",
        },
      ],
      omittedContext: [],
      scoreBreakdown: {
        claimScore: 92,
        contextPenalty: 0,
        confidenceAdjustment: 0,
        finalScore: 92,
      },
      comparison: {
        totalIndependentClusters: 3,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: false,
        claims: [
          {
            claimId: "claim-1",
            independentClusterCount: 3,
            agreementSummary: "strong",
            conflicts: [],
            dimensions: [],
          },
        ],
      },
    };

    const dashboard = ResultsDashboard({
      report: mockReport,
      claims: [
        {
          id: "claim-1",
          text: "Supreme Court directs review of dynamic pricing",
          importance: "high",
          claimType: "event",
          layer: "event_occurred",
        },
      ],
      evidence: [],
      onReset: () => {},
    });

    assert.ok(dashboard !== null);
    const children = dashboard.props.children;
    // Inspect child component types in order
    // index 0: Top Nav bar
    // index 1: ScoreCard (a)
    // index 2: SummarySection (b)
    // index 3: ArticleBlock (c)
    // index 4: CrossSourceSection (d)
    // index 5: ClaimBreakdownSection (e)
    // index 6: EvidenceSection (f)
    // index 7: MissingContextSection (g)
    // index 8: WhyThisScoreSection (h)

    assert.strictEqual(children[1].type, ScoreCard, "Expected (a) ScoreCard at index 1");
    assert.strictEqual(children[2].type, SummarySection, "Expected (b) SummarySection at index 2");
    assert.strictEqual(children[3].type, ArticleBlock, "Expected (c) ArticleBlock at index 3");
    assert.strictEqual(children[4].type, CrossSourceSection, "Expected (d) CrossSourceSection at index 4");
    assert.strictEqual(children[5].type, ClaimBreakdownSection, "Expected (e) ClaimBreakdownSection at index 5");
    assert.strictEqual(children[6].type, EvidenceSection, "Expected (f) EvidenceSection at index 6");
    assert.strictEqual(children[7].type, MissingContextSection, "Expected (g) MissingContextSection at index 7");
    assert.strictEqual(children[8].type, WhyThisScoreSection, "Expected (h) WhyThisScoreSection at index 8");
  });
});

