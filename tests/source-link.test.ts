import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  DEFAULT_SOURCE_CARD_CONFIG,
  isValidHttpUrl,
  SOURCE_LINK_MOTION_CLASSES,
} from "../src/lib/ui/sourceCardConfig";
import {
  SourceLink,
  resolveOriginLabel,
  getOriginBadgeStyles,
  SyndicatedOutletsToggle,
} from "../src/components/ui/SourceLink";
import { NewsBackdrop } from "../src/components/verification/NewsBackdrop";
import { CrossSourceSection } from "../src/components/verification/CrossSourceSection";
import { EvidenceSection } from "../src/components/verification/EvidenceSection";
import { ClaimBreakdownSection } from "../src/components/verification/ClaimBreakdownSection";
import { VerificationReport } from "../src/schemas/verification";
import { Evidence } from "../src/schemas/evidence";

describe("Hover-Lift SourceLink & Cross-Checked Source Integration Test Suite", () => {
  // ─── 1. Shared Component & Semantic Anchor Tag ────────────────────────────
  it("1. SourceLink renders a semantic <a> with exact URL, target='_blank', and rel='noopener noreferrer nofollow'", () => {
    const testUrl = "https://www.reuters.com/world/europe/italian-decree-youth-crime-2023-09-08/";
    const element = SourceLink({
      url: testUrl,
      domain: "reuters.com",
      title: "Italy approves juvenile crackdown decree",
      originLabel: "Original",
      variant: "hero-strip",
    });

    assert.ok(element !== null);
    // Must render a semantic <a> (never a button with onClick)
    assert.strictEqual(element.type, "a", "SourceLink must render an <a> tag for middle-click/copy");
    assert.strictEqual(element.props.href, testUrl, "href must match the exact stored article URL");
    assert.strictEqual(element.props.target, "_blank", "Must open in a new tab");
    assert.strictEqual(
      element.props.rel,
      "noopener noreferrer nofollow",
      "Must have secure rel='noopener noreferrer nofollow'"
    );

    // Inspect children to verify domain, title, origin label, and external link icon are present
    const childrenStr = JSON.stringify(element.props.children);
    assert.ok(childrenStr.includes("reuters.com"), "Must display the domain");
    assert.ok(childrenStr.includes("Italy approves juvenile crackdown decree"), "Must display title/headline");
    assert.ok(childrenStr.includes("Original"), "Must display the origin label");
  });

  // ─── 2. Origin Labels: Original, Republished, Origin unclear ───────────────
  it("2. Origin labels correctly map to Original, Republished, and Origin unclear with proper styling", () => {
    // A. Original (independent, original publishers)
    assert.strictEqual(resolveOriginLabel("Original"), "Original");
    assert.strictEqual(resolveOriginLabel(null, "original"), "Original");
    assert.strictEqual(resolveOriginLabel(null, "independent", false, true), "Original");
    const origBadge = getOriginBadgeStyles("Original");
    assert.ok(origBadge.includes("#10B981"), "Original badge must use emerald theme");

    // B. Republished (wire, syndicated)
    assert.strictEqual(resolveOriginLabel("Republished"), "Republished");
    assert.strictEqual(resolveOriginLabel(null, "syndicated"), "Republished");
    assert.strictEqual(resolveOriginLabel(null, "wire", true), "Republished");
    const repubBadge = getOriginBadgeStyles("Republished");
    assert.ok(repubBadge.includes("#64748B") || repubBadge.includes("#94A3B8"), "Republished badge must use slate theme");

    // C. Origin unclear (unknown, unclear)
    assert.strictEqual(resolveOriginLabel("Origin unclear"), "Origin unclear");
    assert.strictEqual(resolveOriginLabel(null, "unknown"), "Origin unclear");
    assert.strictEqual(resolveOriginLabel(null, null), "Origin unclear");
    const unclearBadge = getOriginBadgeStyles("Origin unclear");
    assert.ok(unclearBadge.includes("#F59E0B"), "Origin unclear badge must use amber theme");
  });

  // ─── 3. Syndicated Clusters: Origin card + +N outlets expansion ─────────────
  it("3. Syndicated clusters render origin card plus +N outlets expandable sub-list", () => {
    const originUrl = "https://www.reuters.com/wire/12345";
    const outlets = [
      { domain: "ndtv.com", url: "https://www.ndtv.com/world-news/story-12345", title: "NDTV Copy" },
      { domain: "hindustantimes.com", url: "https://www.hindustantimes.com/world-news/ht-12345", title: "HT Copy" },
    ];

    const clusterElement = SourceLink({
      url: originUrl,
      domain: "reuters.com",
      title: "Reuters Wire Original Story",
      isWireSyndicated: true,
      syndicatedOutlets: outlets,
      variant: "comparison-row",
    });

    assert.ok(clusterElement !== null);
    assert.strictEqual(
      clusterElement.props["data-testid"],
      "syndicated-cluster-wrapper",
      "Syndicated cluster must have wrapper"
    );

    const children = React.Children.toArray(clusterElement.props.children);
    assert.strictEqual(children.length, 2);

    // First child is origin card <a>
    const originCard = children[0] as React.ReactElement<any>;
    assert.strictEqual(originCard.type, "a");
    assert.strictEqual(originCard.props.href, originUrl);
    assert.strictEqual(originCard.props.target, "_blank");
    assert.strictEqual(originCard.props.rel, "noopener noreferrer nofollow");

    // Second child is SyndicatedOutletsToggle component
    const toggleComp = children[1] as React.ReactElement<any>;
    assert.ok(toggleComp !== null);
    assert.strictEqual(toggleComp.props.outlets.length, 2);
    assert.strictEqual(toggleComp.props.outlets[0].domain, "ndtv.com");
    assert.strictEqual(toggleComp.props.outlets[1].domain, "hindustantimes.com");
  });

  // ─── 4. Hover, Focus, Reduced Motion and Touch Configuration ───────────────
  it("4. Hover-lift configuration defines -4px translateY, 180ms ease-out, deeper shadow, AA focus ring, and touch fallback", () => {
    // Config values
    assert.strictEqual(DEFAULT_SOURCE_CARD_CONFIG.liftDistance, "-4px");
    assert.strictEqual(DEFAULT_SOURCE_CARD_CONFIG.liftDistancePx, 4);
    assert.strictEqual(DEFAULT_SOURCE_CARD_CONFIG.transitionDurationMs, 180);
    assert.strictEqual(DEFAULT_SOURCE_CARD_CONFIG.transitionEasing, "cubic-bezier(0, 0, 0.2, 1)");
    assert.strictEqual(DEFAULT_SOURCE_CARD_CONFIG.focusRingColor, "#10B981");

    // CSS class checks
    assert.ok(SOURCE_LINK_MOTION_CLASSES.includes("duration-[180ms]"), "Must specify 180ms duration");
    assert.ok(SOURCE_LINK_MOTION_CLASSES.includes("ease-out"), "Must specify ease-out timing");
    assert.ok(
      SOURCE_LINK_MOTION_CLASSES.includes("[@media(hover:hover)]:hover:-translate-y-1"),
      "Must lift by -4px (-translate-y-1) on hover-capable devices"
    );
    assert.ok(
      SOURCE_LINK_MOTION_CLASSES.includes("focus-visible:ring-emerald-400"),
      "Must include visible AA emerald focus ring"
    );
    assert.ok(
      SOURCE_LINK_MOTION_CLASSES.includes("motion-reduce:transform-none"),
      "prefers-reduced-motion must disable transform movement"
    );
    assert.ok(
      SOURCE_LINK_MOTION_CLASSES.includes("[@media(hover:none)]:hover:translate-y-0"),
      "Touch devices must disable hover lift"
    );
    assert.ok(
      SOURCE_LINK_MOTION_CLASSES.includes("active:scale-[0.98]"),
      "Touch devices must support pressed state"
    );
  });

  // ─── 5. URL Safety: Safe http(s) validation and non-http rejection ─────────
  it("5. URL safety: Only allows http and https protocols, safely degrading for bad URLs", () => {
    // Valid http(s)
    assert.strictEqual(isValidHttpUrl("https://example.com/news/123"), true);
    assert.strictEqual(isValidHttpUrl("http://reuters.com/article"), true);

    // Invalid or dangerous
    assert.strictEqual(isValidHttpUrl("javascript:alert(1)"), false);
    assert.strictEqual(isValidHttpUrl("data:text/html,malicious"), false);
    assert.strictEqual(isValidHttpUrl("file:///etc/passwd"), false);
    assert.strictEqual(isValidHttpUrl(""), false);
    assert.strictEqual(isValidHttpUrl(null), false);
    assert.strictEqual(isValidHttpUrl("not a url"), false);

    // When an invalid URL is passed, SourceLink renders a styled <div> without <a> or href
    const badLink = SourceLink({
      url: "javascript:alert(1)",
      domain: "malicious.com",
      title: "Attack",
      variant: "hero-strip",
    });
    assert.notStrictEqual(badLink.type, "a", "Must NOT render an <a> for unsafe URLs");
    assert.strictEqual(badLink.props.href, undefined, "Unsafe URL must not have href");
  });

  // ─── 6. Integration: NewsBackdrop Hero Strip & Floating Card ───────────────
  it("6. Integration: NewsBackdrop renders cross-checked sources and floating card as hover-lift SourceLinks", () => {
    const mockReport: VerificationReport = {
      articleTitle: "Cabinet Approves Decrees",
      sourceDomain: "reuters.com",
      articleUrl: "https://reuters.com/article",
      overallTrustScore: 85,
      veracityVerdict: "mostly_true",
      confidence: "high",
      summary: "Summary text",
      claimSummary: { total: 1, supporting: 1, contradicting: 0, qualifying: 0, insufficient: 0 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 85, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 85 },
      crossSourceComparison: {
        originalPublisher: "reuters.com",
        totalPublicationsExamined: 2,
        independentSourcesCount: 2,
        syndicatedSourcesCount: 0,
        wireAgenciesDetected: [],
        publications: [
          {
            domain: "reuters.com",
            url: "https://reuters.com/world/article",
            title: "Reuters report",
            sourceType: "wire",
            relationship: "original",
            isIndependent: true,
            isWireSyndicated: false,
          },
          {
            domain: "ansa.it",
            url: "https://ansa.it/news/decree",
            title: "ANSA report",
            sourceType: "national_news",
            relationship: "independent",
            isIndependent: true,
            isWireSyndicated: false,
          },
        ],
        claimsCompared: [],
        claimsAgreedCount: 1,
        claimsConflictingCount: 0,
        claimsUnresolvedCount: 0,
        hasNumericalConflict: false,
        hasDirectQuoteConflict: false,
        summary: "Comparison summary",
      },
    };

    const evidence: Evidence[] = [
      {
        id: "ev-1",
        claimId: "c-1",
        domain: "reuters.com",
        url: "https://reuters.com/world/article",
        title: "Reuters report",
        snippet: "Snippet text",
        sourceRelationship: "original",
        relationship: "supporting",
        sourceType: "wire",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const hero = NewsBackdrop({ report: mockReport, evidence });
    assert.ok(hero !== null);

    // Check floating card child
    const children = React.Children.toArray(hero.props.children);
    const contentArea = children.find(
      (c: any) => c?.props?.className?.includes("max-w-7xl") && c?.props?.className?.includes("py-8")
    ) as any;
    assert.ok(contentArea, "Content area must be present");

    const gridCol = contentArea.props.children;
    const gridChildren = React.Children.toArray(gridCol.props.children);
    const rightCol = gridChildren.find((c: any) => c?.props?.className?.includes("lg:col-span-5")) as any;
    const floatingCardWrapper =
      gridChildren.find((c: any) => c?.props?.["data-testid"] === "hero-floating-card") ||
      (rightCol && React.Children.toArray(rightCol.props.children).find((c: any) => c?.props?.["data-testid"] === "hero-floating-card")) as any;
    assert.ok(floatingCardWrapper, "hero-floating-card must be present");

    const floatingCardLink =
      React.Children.toArray(floatingCardWrapper.props.children).find(
        (c: any) => c?.props?.variant === "floating-card"
      ) || floatingCardWrapper.props.children;
    assert.strictEqual(floatingCardLink.props.variant, "floating-card");
    assert.strictEqual(floatingCardLink.props.url, "https://reuters.com/world/article");

    // Check bottom strip cards
    const bottomStrip = children.find(
      (c: any) => c?.props?.["data-testid"] === "hero-bottom-strip"
    ) as any;
    assert.ok(bottomStrip, "hero-bottom-strip must be present");
  });

  // ─── 7. Integration: CrossSourceSection Dimension Rows & Conflict Quotes ──
  it("7. Integration: CrossSourceSection renders dimension source values and conflict quotes with SourceLink", () => {
    const evidence: Evidence[] = [
      {
        id: "ev-101",
        claimId: "claim-1",
        domain: "lemonde.fr",
        url: "https://lemonde.fr/article-101",
        title: "Le Monde Report",
        snippet: "French reporting on youth crime",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "international_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-102",
        claimId: "claim-1",
        domain: "corriere.it",
        url: "https://corriere.it/article-102",
        title: "Corriere della Sera",
        snippet: "Italian local reporting",
        sourceRelationship: "independent",
        relationship: "contradicting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const section = CrossSourceSection({
      comparison: {
        totalIndependentClusters: 2,
        totalConflicts: 1,
        totalUnresolvedDimensions: 0,
        coverageLimited: false,
        claims: [
          {
            claimId: "claim-1",
            independentClusterCount: 2,
            agreementSummary: "moderate",
            dimensions: [
              {
                dimension: "numbers",
                outcome: "contradiction",
                articleValue: "5 years",
                sourceValues: [
                  {
                    clusterId: "cluster-1",
                    evidenceId: "ev-101",
                    value: "2 to 5 years",
                    quote: "two to five years maximum",
                  },
                ],
              },
            ],
            conflicts: [
              {
                dimension: "numbers",
                description: "Sentence duration varies across outlets",
                evidenceIds: ["ev-102"],
              },
            ],
          },
        ],
      },
      evidence,
    });

    assert.ok(section !== null);
    assert.ok(React.isValidElement(section), "CrossSourceSection must return a valid React element");
    assert.strictEqual((section.type as any).name, "CrossSourceInner");

    // Also test SourceLink comparison-row directly
    const rowLink = SourceLink({
      variant: "comparison-row",
      url: "https://lemonde.fr/article-101",
      domain: "lemonde.fr",
      title: "Le Monde Report",
      originType: "independent",
      quote: "two to five years maximum",
      children: React.createElement("p", null, "2 to 5 years"),
    });
    assert.strictEqual(rowLink.type, "a");
    assert.strictEqual(rowLink.props.href, "https://lemonde.fr/article-101");
    assert.strictEqual(rowLink.props.target, "_blank");
    assert.strictEqual(rowLink.props.rel, "noopener noreferrer nofollow");
  });

  // ─── 8. Integration: ClaimBreakdownSection & EvidenceSection ───────────────
  it("8. Integration: ClaimBreakdownSection and EvidenceSection render SourceLink cards and citation pills", () => {
    const evidence: Evidence[] = [
      {
        id: "ev-1",
        claimId: "claim-1",
        domain: "bbc.com",
        url: "https://www.bbc.com/news/world-123",
        title: "BBC News Coverage",
        snippet: "Full coverage of the decree",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "international_news",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    // EvidenceSection element creation
    const evSectionElement = React.createElement(EvidenceSection, {
      evidence,
      defaultExpandedMobile: true,
    });
    assert.ok(React.isValidElement(evSectionElement), "EvidenceSection must be a valid React element");

    // Test SourceLink with variant='evidence-card' directly
    const evCardLink = SourceLink({
      variant: "evidence-card",
      id: "evidence-ev-1",
      url: "https://www.bbc.com/news/world-123",
      domain: "bbc.com",
      title: "BBC News Coverage",
      originType: "independent",
      children: React.createElement("p", null, "Full coverage of the decree"),
    });
    assert.strictEqual(evCardLink.type, "a");
    assert.strictEqual(evCardLink.props.href, "https://www.bbc.com/news/world-123");
    assert.strictEqual(evCardLink.props.target, "_blank");
    assert.strictEqual(evCardLink.props.rel, "noopener noreferrer nofollow");
    assert.strictEqual(evCardLink.props.id, "evidence-ev-1");

    // ClaimBreakdownSection renders citations with SourceLink citation-pill
    const claimSection = ClaimBreakdownSection({
      evaluations: [
        {
          claimId: "claim-1",
          verdict: "supporting",
          confidence: "high",
          explanation: "Supported by BBC",
          evidenceIds: ["ev-1"],
          importantNotes: [],
          layer: "event_occurred",
        },
      ],
      claims: [
        {
          id: "claim-1",
          text: "The Italian cabinet met in Rome",
          importance: "high",
          layer: "event_occurred",
          claimType: "event",
        },
      ],
      evidence,
    });
    assert.ok(claimSection !== null);
    assert.strictEqual(claimSection.props["data-testid"], "claim-breakdown-section");

    // Test SourceLink with variant='citation-pill' directly
    const pillLink = SourceLink({
      variant: "citation-pill",
      url: "https://www.bbc.com/news/world-123",
      domain: "bbc.com",
      title: "BBC News Coverage",
      originType: "independent",
    });
    assert.strictEqual(pillLink.type, "a");
    assert.strictEqual(pillLink.props.href, "https://www.bbc.com/news/world-123");
    assert.strictEqual(pillLink.props.target, "_blank");
    assert.strictEqual(pillLink.props.rel, "noopener noreferrer nofollow");
  });
});
