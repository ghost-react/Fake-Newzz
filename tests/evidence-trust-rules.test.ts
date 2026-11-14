import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { NewsBackdrop } from "../src/components/verification/NewsBackdrop";
import { SourceLink } from "../src/components/ui/SourceLink";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { VerificationReport } from "../src/schemas/verification";
import { classifyEvidenceEventMatch, tagEvidenceWithEventMatch } from "../src/lib/comparison/eventMatching";
import { isSocialOrAggregator } from "../src/lib/comparison/socialExclusion";
import { clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import { compareClaimsAcrossClusters } from "../src/lib/comparison/compareClaims";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { determineVerdictWithRule } from "../src/lib/scoring/determineVerdict";

describe("Evidence Trust Rules & Verdict Consistency (Step 4 & Step 5)", () => {
  // ─── 1. Headline wrapping and overlap safety ──────────────────────────────────
  it("1. Headline never wraps one word per line at 1280px; no element overlaps the headline", () => {
    const report: VerificationReport = {
      articleTitle: "Woman objects to bad touch, pushed off Mumbai local train, loses arm",
      sourceDomain: "ndtv.com",
      articleUrl: "https://ndtv.com/mumbai-news/woman-objects-to-bad-touch-6948529",
      overallTrustScore: 50,
      veracityVerdict: "unverified",
      confidence: "low",
      summary: "Incident reported on Mumbai suburban train.",
      claimSummary: { total: 1, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 1 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 50, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 50 },
    };

    const hero = NewsBackdrop({ report });
    const children = React.Children.toArray(hero.props.children) as any[];
    const contentArea = children.find(
      (c) => c?.props?.className?.includes("max-w-7xl") && c?.props?.className?.includes("py-8")
    );
    assert.ok(contentArea, "Content area must exist");

    const grid = contentArea.props.children;
    assert.ok(grid.props.className.includes("lg:grid-cols-12"), "Grid must use 12 columns");

    const gridChildren = React.Children.toArray(grid.props.children) as any[];
    const textCol = gridChildren.find((c) => c?.props?.className?.includes("lg:col-span-7"));
    const statsCol = gridChildren.find((c) => c?.props?.className?.includes("lg:col-span-5"));

    assert.ok(textCol, "Text column must span 7 columns");
    assert.ok(textCol.props.className.includes("lg:min-w-[480px]"), "Text column must be at least 480px wide");
    assert.ok(statsCol, "Stats column must span 5 columns");
    assert.ok(!statsCol.props.className.includes("absolute"), "Stats column must be in normal flow to prevent overlap");

    const textChildren = React.Children.toArray(textCol.props.children) as any[];
    const headline = textChildren.find((c) => c?.props?.["data-testid"] === "hero-headline");
    assert.ok(headline, "Headline element must be present");
    assert.ok(headline.props.className.includes("[text-wrap:balance]"), "Headline must have text-wrap: balance");
    assert.ok(headline.props.className.includes("break-normal"), "Headline must use normal word breaks");
  });

  // ─── 2. Bottom strip text is not truncated except domain names (ellipsis) ─────
  it("2. Bottom strip text is not truncated except domain names (ellipsis)", () => {
    const report: VerificationReport = {
      articleTitle: "Test Story Headline",
      sourceDomain: "example.com",
      overallTrustScore: 85,
      veracityVerdict: "mostly_true",
      confidence: "medium",
      summary: "Summary text",
      claimSummary: { total: 1, supporting: 1, contradicting: 0, qualifying: 0, insufficient: 0 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 85, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 85 },
      comparison: {
        totalIndependentClusters: 2,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: false,
        claims: [
          {
            claimId: "c1",
            independentClusterCount: 2,
            agreementSummary: "strong",
            conflicts: [],
            dimensions: [
              {
                dimension: "event",
                outcome: "agreement",
                articleValue: "Test Event",
                sourceValues: [
                  { clusterId: "cl1", evidenceId: "ev1", value: "Snippet" },
                ],
              },
            ],
          },
        ],
      },
    };

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Very Long Detailed Headline That Should Not Be Truncated Abruptly",
        url: "https://very-long-subdomain.news-outlet-network.reuters.com/article/123",
        domain: "very-long-subdomain.news-outlet-network.reuters.com",
        snippet: "Passage snippet",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "wire",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
        publishedAt: "2024-11-04T12:00:00Z",
      } as any,
    ];

    const hero = NewsBackdrop({ report, evidence });
    const children = React.Children.toArray(hero.props.children) as any[];
    const bottomStrip = children.find((c) => c?.props?.["data-testid"] === "hero-bottom-strip");
    assert.ok(bottomStrip, "Bottom strip must exist");

    // Check SourceLink component renders domain with truncate class and time without wrap
    const card = SourceLink({
      url: "https://very-long-subdomain.news-outlet-network.reuters.com/article/123",
      domain: "very-long-subdomain.news-outlet-network.reuters.com",
      headline: "Very Long Detailed Headline That Should Not Be Truncated Abruptly",
      variant: "white-strip-card",
      timeText: "2 days ago",
    });
    const cardStr = JSON.stringify(card.props);
    assert.ok(cardStr.includes("truncate"), "Domain must use truncate class for ellipsis");
    assert.ok(cardStr.includes("whitespace-nowrap"), "Time text must use whitespace-nowrap and not truncate");
  });

  // ─── 3. Backdrop is visible in the DOM with no opaque ancestor ───────────────
  it("3. Backdrop is visible in the DOM with no opaque ancestor", () => {
    const report: VerificationReport = {
      articleTitle: "Test Article",
      sourceDomain: "reuters.com",
      featuredImage: "https://example.com/photo.jpg",
      overallTrustScore: 90,
      veracityVerdict: "verified_true",
      confidence: "high",
      summary: "Summary",
      claimSummary: { total: 1, supporting: 1, contradicting: 0, qualifying: 0, insufficient: 0 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 90, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 90 },
    };

    const hero = NewsBackdrop({ report });
    assert.ok(hero !== null);
    // Outer section must not set opaque background
    assert.ok(!hero.props.className.includes("bg-[#0B0F17]"), "Outer section must not set opaque background");

    const children = React.Children.toArray(hero.props.children) as any[];
    const imageLayer = children.find((c) => c?.props?.["data-testid"] === "hero-image-layer");
    assert.ok(imageLayer, "Image layer must exist at z-0");
    assert.ok(imageLayer.props.className.includes("z-0"), "Image layer must be at z-0");
    assert.ok(!imageLayer.props.className.includes("bg-[#111923]"), "Image layer must not have opaque background");

    const contentArea = children.find(
      (c) => c?.props?.className?.includes("z-10") && c?.props?.className?.includes("max-w-7xl")
    );
    assert.ok(contentArea, "Content wrapper must have relative z-10");
  });

  // ─── 4. Unreadable article image fallback pipeline ───────────────────────────
  it("4. Unreadable article with readable related report takes image with credit; no readable image yields gradient", async () => {
    const claims: ClaimInput[] = [{ id: "c1", text: "Mumbai train event occurred", importance: "high", layer: "event_occurred", claimType: "event" }];
    const evaluations: ClaimEvaluation[] = [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Ok", evidenceIds: ["ev-indep"], importantNotes: [] }];

    // Scenario A: Unreadable with readable related report having an image
    const evidenceWithImage: Evidence[] = [
      {
        id: "ev-indep",
        claimId: "c1",
        title: "Mumbai Local Incident Details",
        url: "https://thehindu.com/news/mumbai/train-incident",
        domain: "thehindu.com",
        snippet: "Report snippet",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
        imageUrl: "https://thehindu.com/images/train-photo.jpg",
      } as any,
    ];

    const reportWithImage = await buildReport(
      { title: "Mumbai local incident", sourceDomain: "ndtv.com", featuredImage: null },
      claims,
      evaluations,
      [],
      { evidence: evidenceWithImage, sourceReadStatus: "unreadable" }
    );

    assert.strictEqual(reportWithImage.featuredImage, "https://thehindu.com/images/train-photo.jpg");
    assert.strictEqual(reportWithImage.backgroundImage?.sourceType, "evidence");
    assert.strictEqual(reportWithImage.backgroundImage?.credit, "thehindu.com");

    // Scenario B: No readable image available -> dark gradient fallback
    const evidenceWithoutImage: Evidence[] = [
      {
        id: "ev-no-img",
        claimId: "c1",
        title: "Report with no valid image",
        url: "https://thehindu.com/news/mumbai/train-incident",
        domain: "thehindu.com",
        snippet: "Report snippet",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
        imageUrl: null,
      } as any,
    ];

    const reportNoImage = await buildReport(
      { title: "Mumbai local incident", sourceDomain: "ndtv.com", featuredImage: null },
      claims,
      evaluations,
      [],
      { evidence: evidenceWithoutImage, sourceReadStatus: "unreadable" }
    );

    assert.strictEqual(reportNoImage.featuredImage, null);
    const heroNoImage = NewsBackdrop({ report: reportNoImage });
    const heroChildren = React.Children.toArray(heroNoImage.props.children) as any[];
    const fallbackLayer = heroChildren.find((c) => c?.props?.["data-testid"] === "hero-fallback-layer");
    assert.ok(fallbackLayer, "Hero must render dark gradient fallback layer when no readable image exists");
  });

  // ─── 5. facebook.com is never Key Independent Source and counts as 0 outlets ─
  it("5. facebook.com is never 'Key Independent Source' and counts as 0 independent outlets", () => {
    // Check exclusion helper
    assert.strictEqual(isSocialOrAggregator("facebook.com"), true);
    assert.strictEqual(isSocialOrAggregator("https://www.facebook.com/watch?v=1234"), true);
    assert.strictEqual(isSocialOrAggregator("twitter.com"), true);
    assert.strictEqual(isSocialOrAggregator("reddit.com"), true);
    assert.strictEqual(isSocialOrAggregator("youtube.com"), true);
    assert.strictEqual(isSocialOrAggregator("reuters.com"), false);

    const socialEvidence: Evidence[] = [
      {
        id: "ev-fb",
        claimId: "c1",
        title: "Facebook Post Video of incident",
        url: "https://facebook.com/watch?v=99999",
        domain: "facebook.com",
        snippet: "Video snippet on Facebook",
        sourceRelationship: "unknown",
        relationship: "supporting",
        sourceType: "social_media" as any,
        evidenceQuality: "low",
        relevance: "direct",
        eventMatch: "same_event",
      } as any,
    ];

    // Clustering check
    const clusters = clusterEvidenceIndependence(socialEvidence);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].originType, "social_reference");
    assert.strictEqual(clusters[0].independenceConfidence, "low");

    // Report with only social evidence
    const report: VerificationReport = {
      articleTitle: "Woman pushed off Mumbai local",
      sourceDomain: "ndtv.com",
      overallTrustScore: 50,
      veracityVerdict: "unverified",
      confidence: "low",
      summary: "Summary",
      claimSummary: { total: 1, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 1 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 50, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 50 },
      comparison: {
        totalIndependentClusters: 0,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: true,
        claims: [
          {
            claimId: "c1",
            independentClusterCount: 0,
            agreementSummary: "none",
            conflicts: [],
            dimensions: [],
          },
        ],
      },
    };

    const hero = NewsBackdrop({ report, evidence: socialEvidence });
    assert.ok(hero !== null);
    const heroStr = JSON.stringify(hero.props);

    // facebook.com must NOT be labeled as "Key Independent Source"
    assert.ok(!heroStr.includes("Key Independent Source: facebook.com"));
    assert.ok(!heroStr.includes("Strongest Corroboration"));
  });

  // ─── 6. Items dated outside window are related background ────────────────────
  it("6. Items dated outside window (±14 days) are related background", () => {
    const articlePublishedAt = "2024-11-04T10:00:00Z";

    // Evidence from 2023 (outside 14-day window)
    const oldEvidence: Evidence = {
      id: "ev-2023",
      claimId: "c1",
      title: "Similar incident reported in 2023 on Mumbai local",
      url: "https://mumbainews.com/2023/train-incident",
      domain: "mumbainews.com",
      snippet: "In 2023, another passenger suffered injuries.",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "regional_news",
      evidenceQuality: "high",
      relevance: "direct",
      publishedAt: "2023-05-15T08:00:00Z",
    } as any;

    const matchOld = classifyEvidenceEventMatch(oldEvidence, {
      title: "Woman pushed off local train in Mumbai",
      publishedAt: articlePublishedAt,
    });
    assert.strictEqual(matchOld, "related_background", "Evidence from 2023 must be classified as related_background");

    // Evidence from same week (within 14-day window)
    const sameWeekEvidence: Evidence = {
      id: "ev-recent",
      claimId: "c1",
      title: "Woman injured after being pushed from train near Sion",
      url: "https://thehindu.com/2024/11/05/train-incident",
      domain: "thehindu.com",
      snippet: "Railway police arrested the suspect within 24 hours.",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
      publishedAt: "2024-11-05T08:00:00Z",
    } as any;

    const matchRecent = classifyEvidenceEventMatch(sameWeekEvidence, {
      title: "Woman pushed off local train in Mumbai",
      publishedAt: articlePublishedAt,
    });
    assert.strictEqual(matchRecent, "same_event", "Evidence within 14 days must be classified as same_event");
  });

  // ─── 7. Zero independent clusters produces "Unable to Verify", not 81 ─────────
  it("7. Zero independent clusters produces 'Unable to Verify', not 81 or positive verdict", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Alleged incident occurred on train", importance: "high", layer: "event_occurred", claimType: "event" },
    ];
    // Evaluator might give supporting from a social post or snippet
    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "medium", explanation: "Only post found", evidenceIds: ["ev-social"], importantNotes: [] },
    ];

    const socialEvidence: Evidence[] = [
      {
        id: "ev-social",
        claimId: "c1",
        title: "Social media post",
        url: "https://facebook.com/post/1",
        domain: "facebook.com",
        snippet: "Social post text",
        sourceRelationship: "unknown",
        relationship: "supporting",
        sourceType: "social_media" as any,
        evidenceQuality: "low",
        relevance: "direct",
        eventMatch: "same_event",
      } as any,
    ];

    const comparisonReport = {
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 0,
          agreementSummary: "none" as const,
          conflicts: [],
          dimensions: [],
        },
      ],
      totalIndependentClusters: 0,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
    };

    const v2Result = calculateScoreV2(claims, evaluations, [], {
      comparison: comparisonReport,
      evidence: socialEvidence,
    });

    // Score can reflect signals, but the verdict MUST be unverified ("Unable to Verify")
    assert.strictEqual(
      v2Result.veracityVerdict,
      "unverified",
      "Verdict must be 'unverified' when zero independent non-social clusters exist"
    );
    assert.strictEqual(v2Result.confidence, "low", "Confidence must be 'low' with zero independent clusters");

    // Also check determineVerdictWithRule
    const verdictRuleResult = determineVerdictWithRule(81, claims, evaluations, [], {
      independentSameEventClustersCount: 0,
    });
    assert.strictEqual(
      verdictRuleResult.verdict,
      "unverified",
      "determineVerdictWithRule must gate positive scores (e.g. 81) to 'unverified' when independentSameEventClustersCount = 0"
    );
  });

  // ─── 8. Verdict and Independent outlets count always agree ───────────────────
  it("8. Verdict and 'Independent outlets' count always agree", () => {
    // When independent outlets = 0:
    const zeroClusterReport: VerificationReport = {
      articleTitle: "Woman pushed off Mumbai local",
      sourceDomain: "ndtv.com",
      overallTrustScore: 65,
      veracityVerdict: "unverified",
      confidence: "low",
      summary: "Summary",
      claimSummary: { total: 1, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 1 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 65, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 65 },
      comparison: {
        totalIndependentClusters: 0,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: true,
        claims: [],
      },
    };

    const hero = NewsBackdrop({ report: zeroClusterReport });
    assert.ok(hero !== null);

    const children = React.Children.toArray(hero.props.children) as any[];
    const contentArea = children.find(
      (c) => c?.props?.className?.includes("max-w-7xl") && c?.props?.className?.includes("py-8")
    );
    const grid = contentArea.props.children;
    const gridChildren = React.Children.toArray(grid.props.children) as any[];
    const textCol = gridChildren.find((c) => c?.props?.className?.includes("lg:col-span-7"));
    const textChildren = React.Children.toArray(textCol.props.children) as any[];

    // Headline must show "Unable to verify: no independent reports found."
    const headline = textChildren.find((c) => c?.props?.["data-testid"] === "hero-headline");
    assert.ok(headline, "Headline element must exist");
    assert.strictEqual(
      headline.props.children,
      "Unable to verify: no independent reports found."
    );

    // Note must state "No independent reporting of this event was found."
    const note = textChildren.find((c) => c?.props?.["data-testid"] === "unreadable-source-note");
    assert.ok(note, "Note banner must exist");
    const noteStr = JSON.stringify(note.props);
    assert.ok(noteStr.includes("No independent reporting of this event was found."));
  });

  // ─── 9. Readable article with 3 independent clusters is unchanged ────────────
  it("9. Readable article with 3 independent clusters is unchanged", async () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Italy approves juvenile crime decree", importance: "high", layer: "event_occurred", claimType: "event" },
      { id: "c2", text: "Law targets teen delinquency", importance: "medium", layer: "underlying_fact", claimType: "factual" },
    ];
    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Supported", evidenceIds: ["ev1", "ev2"], importantNotes: [] },
      { claimId: "c2", verdict: "supporting", confidence: "high", explanation: "Supported", evidenceIds: ["ev3"], importantNotes: [] },
    ];

    const evidence3Clusters: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Reuters reporting on decree",
        url: "https://reuters.com/italy-decree",
        domain: "reuters.com",
        snippet: "Reuters passage",
        sourceRelationship: "original",
        relationship: "supporting",
        sourceType: "wire",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
      } as any,
      {
        id: "ev2",
        claimId: "c1",
        title: "ANSA Italian reporting",
        url: "https://ansa.it/italy-decree",
        domain: "ansa.it",
        snippet: "ANSA passage",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
      } as any,
      {
        id: "ev3",
        claimId: "c2",
        title: "Corriere della Sera coverage",
        url: "https://corriere.it/italy-decree",
        domain: "corriere.it",
        snippet: "Corriere passage",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
      } as any,
    ];

    const report = await buildReport(
      {
        title: "Italy Approves Stricter Youth Crime Laws",
        sourceDomain: "reuters.com",
        featuredImage: "https://reuters.com/photos/meloni.jpg",
      },
      claims,
      evaluations,
      [],
      {
        evidence: evidence3Clusters,
        sourceReadStatus: "readable",
        comparison: {
          totalIndependentClusters: 3,
          totalConflicts: 0,
          totalUnresolvedDimensions: 0,
          coverageLimited: false,
          claims: [
            {
              claimId: "c1",
              independentClusterCount: 2,
              agreementSummary: "strong",
              conflicts: [],
              dimensions: [],
            },
            {
              claimId: "c2",
              independentClusterCount: 1,
              agreementSummary: "strong",
              conflicts: [],
              dimensions: [],
            },
          ],
        },
      }
    );

    // Must be positive verdict, high confidence, 3 independent clusters
    assert.ok(
      report.veracityVerdict === "verified_true" || report.veracityVerdict === "mostly_true",
      `Verdict must remain positive, got: ${report.veracityVerdict}`
    );
    assert.strictEqual(report.confidence, "high", "Confidence must remain high with 3 independent full-text clusters");
    assert.strictEqual(report.comparison?.totalIndependentClusters, 3, "Must retain 3 independent clusters");
    assert.strictEqual(report.articleTitle, "Italy Approves Stricter Youth Crime Laws", "Readable title must remain intact");
  });
});
