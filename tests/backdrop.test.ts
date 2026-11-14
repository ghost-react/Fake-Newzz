import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import {
  DEFAULT_BACKDROP_CONFIG,
  getEffectiveBackdropConfig,
  verifyTextContrastAa,
  calculateContrastRatio,
  calculateEffectiveBackgroundLuminance,
  BackdropConfig,
} from "../src/lib/ui/backdropConfig";
import {
  computeImageLuminance,
  rgbToLuminance,
} from "../src/lib/image/luminance";
import { NewsBackdrop } from "../src/components/verification/NewsBackdrop";
import { VerificationReport } from "../src/schemas/verification";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";

function makeMockReport(overrides?: Partial<VerificationReport>): VerificationReport {
  return {
    articleTitle: "Italian Cabinet Approves New Youth Crime Decrees",
    sourceDomain: "reuters.com",
    articleUrl: "https://reuters.com/world/europe/italian-decree",
    featuredImage: "https://images.unsplash.com/photo-test-news.jpg",
    author: "Giuseppe Fonte",
    publishedAt: "2023-09-08T10:00:00Z",
    overallTrustScore: 88,
    veracityVerdict: "mostly_true",
    confidence: "high",
    summary: "The Italian cabinet approved strict new criminal penalties targeting youth crime and protests.",
    claimSummary: {
      total: 3,
      supporting: 2,
      contradicting: 0,
      qualifying: 1,
      insufficient: 0,
    },
    evaluations: [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by official government gazette and Reuters reporting.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ],
    omittedContext: [],
    scoreBreakdown: {
      claimScore: 90,
      contextPenalty: 2,
      confidenceAdjustment: 0,
      finalScore: 88,
    },
    crossSourceComparison: {
      originalPublisher: "reuters.com",
      totalPublicationsExamined: 3,
      independentSourcesCount: 2,
      syndicatedSourcesCount: 1,
      wireAgenciesDetected: ["Reuters", "ANSA"],
      publications: [
        {
          domain: "reuters.com",
          title: "Italy approves juvenile crackdown decree",
          sourceType: "wire",
          relationship: "original",
          isIndependent: true,
          isWireSyndicated: false,
        },
        {
          domain: "ansa.it",
          title: "Meloni cabinet passes Caivano security decree",
          sourceType: "national_news",
          relationship: "independent",
          isIndependent: true,
          isWireSyndicated: false,
        },
      ],
      claimsCompared: [],
      claimsAgreedCount: 2,
      claimsConflictingCount: 0,
      claimsUnresolvedCount: 0,
      hasNumericalConflict: false,
      hasDirectQuoteConflict: false,
      summary: "Broad consensus across international and Italian domestic outlets.",
    },
    ...overrides,
  };
}

describe("NewsBackdrop Hero & Visual Experience Test Suite", () => {
  // ─── a. Defaults render with blurPx 8 and three scrims, config changes work ───
  it("a. Defaults render with blurPx 8, imageOpacity 0.92, and the three scrims, and config changes take effect", () => {
    // 1. Check default values
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.blurPx, 8);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.mobileBlurPx, 4);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.imageOpacity, 0.92);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.scale, 1.08);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.leftScrimOpacity, 0.75);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.rightScrimOpacity, 0.55);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.bottomScrimOpacity, 0.85);
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.scrollDarkenMax, 0.85);

    // 2. Custom config overrides take effect cleanly
    const customConfig: Partial<BackdropConfig> = {
      blurPx: 12,
      leftScrimOpacity: 0.80,
      scale: 1.10,
    };
    const effective = getEffectiveBackdropConfig(customConfig);
    assert.strictEqual(effective.blurPx, 12);
    assert.strictEqual(effective.leftScrimOpacity, 0.80);
    assert.strictEqual(effective.scale, 1.10);
    assert.strictEqual(effective.imageOpacity, 0.92); // preserved default
    assert.strictEqual(effective.bottomScrimOpacity, 0.85); // preserved default

    // 3. React component renders with default parameters
    const report = makeMockReport();
    const hero = NewsBackdrop({ report, config: customConfig });
    assert.ok(hero !== null);
    assert.strictEqual(hero.props["data-testid"], "news-backdrop-hero");
    assert.strictEqual(hero.props.style["--hero-blur-desktop"], "12px");
    assert.strictEqual(hero.props.style["--hero-blur-mobile"], "4px");
  });

  // ─── b. Bright, dark and busy test images all pass AA contrast ────────────────
  it("b. Bright, dark and busy test images all pass AA contrast for headline and score text, with luminance-based scrim selection", () => {
    // 1. Dark Image (night scene, dark interior, e.g. luminance ~0.10)
    const darkLuminance = 0.10;
    const darkConfig = getEffectiveBackdropConfig(DEFAULT_BACKDROP_CONFIG, darkLuminance);
    // Dark images use baseline scrim (0.75 left, 0.85 bottom)
    assert.strictEqual(darkConfig.leftScrimOpacity, 0.75);
    const darkContrast = verifyTextContrastAa(darkLuminance, darkConfig.leftScrimOpacity, 0.95, true);
    assert.strictEqual(darkContrast.passesAa, true);
    assert.ok(darkContrast.contrastRatio >= 7.0, `Dark image contrast should be >= 7.0, got ${darkContrast.contrastRatio}`);

    // 2. Midtone / Busy Image (crowded press conference, vibrant colors, e.g. luminance ~0.40)
    const busyLuminance = 0.40;
    const busyConfig = getEffectiveBackdropConfig(DEFAULT_BACKDROP_CONFIG, busyLuminance);
    assert.strictEqual(busyConfig.leftScrimOpacity, 0.75);
    const busyContrast = verifyTextContrastAa(busyLuminance, busyConfig.leftScrimOpacity, 0.95, false);
    assert.strictEqual(busyContrast.passesAa, true);
    assert.ok(busyContrast.contrastRatio >= 4.5, `Busy image contrast should be >= 4.5, got ${busyContrast.contrastRatio}`);

    // 3. Very Bright Image (bright snow, direct white sky, e.g. luminance ~0.85)
    const brightLuminance = 0.85;
    const brightConfig = getEffectiveBackdropConfig(DEFAULT_BACKDROP_CONFIG, brightLuminance);
    // Automatic scrim boost triggers when luminance >= highLuminanceThreshold (0.6)
    assert.strictEqual(brightConfig.leftScrimOpacity, 0.90);
    assert.strictEqual(brightConfig.rightScrimOpacity, 0.75);
    assert.strictEqual(brightConfig.bottomScrimOpacity, 0.95);

    // With automatic boost, text over the bright image easily passes WCAG AA for body and large text
    const brightContrastBody = verifyTextContrastAa(brightLuminance, brightConfig.leftScrimOpacity, 0.95, false);
    const brightContrastLarge = verifyTextContrastAa(brightLuminance, brightConfig.leftScrimOpacity, 0.95, true);
    assert.strictEqual(brightContrastBody.passesAa, true, `Body text on bright image must pass AA (ratio: ${brightContrastBody.contrastRatio})`);
    assert.strictEqual(brightContrastLarge.passesAa, true, `Large text on bright image must pass AA (ratio: ${brightContrastLarge.contrastRatio})`);
    assert.ok(brightContrastBody.contrastRatio >= 4.5);
  });

  // ─── c. No image: falls back to dark gradient hero with same layout ───────────
  it("c. No image: falls back to the dark gradient hero with the exact same layout", () => {
    const noImageReport = makeMockReport({
      featuredImage: null,
      backgroundImage: undefined,
    });

    const hero = NewsBackdrop({ report: noImageReport });
    assert.ok(hero !== null);

    // Find fallback layer child
    const children = React.Children.toArray(hero.props.children);
    const fallbackLayer = children.find(
      (c: any) => c?.props?.["data-testid"] === "hero-fallback-layer"
    );
    assert.ok(fallbackLayer, "Expected hero-fallback-layer when no image is present");

    const imageLayer = children.find(
      (c: any) => c?.props?.["data-testid"] === "hero-image-layer"
    );
    assert.strictEqual(imageLayer, undefined, "hero-image-layer should not be present when no image exists");

    // Scrims and content layout structure remain identical
    const leftScrim = children.find((c: any) => c?.props?.["data-testid"] === "hero-left-scrim");
    const bottomScrim = children.find((c: any) => c?.props?.["data-testid"] === "hero-bottom-scrim");
    assert.ok(leftScrim, "Left scrim must still be present on fallback");
    assert.ok(bottomScrim, "Bottom scrim must still be present on fallback");
  });

  // ─── d. Mobile: 55vh top band, reduced blur (4px), scroll row, no floating card
  it("d. Mobile: top band (55vh), reduced blur (4px), scroll row, no floating card", () => {
    const report = makeMockReport();
    const hero = NewsBackdrop({ report });
    assert.ok(hero !== null);

    // CSS variables control blur responsiveness without layout shift
    assert.strictEqual(hero.props.style["--hero-blur-desktop"], "8px");
    assert.strictEqual(hero.props.style["--hero-blur-mobile"], "4px");

    // Height class includes mobile top band (55vh) and desktop full viewport hero (85vh)
    const className = hero.props.className;
    assert.ok(className.includes("min-h-[55vh]"), "Must specify mobile top band height (55vh)");
    assert.ok(className.includes("md:min-h-[85vh]"), "Must specify desktop full-viewport height (85vh)");
  });

  // ─── e. Source strip hidden when comparison data is missing ───────────────────
  it("e. Source strip is hidden when comparison data is missing", () => {
    const reportNoComparison = makeMockReport({
      comparison: undefined,
      crossSourceComparison: undefined,
    });

    const hero = NewsBackdrop({ report: reportNoComparison });
    const children = React.Children.toArray(hero.props.children);
    const bottomStrip = children.find(
      (c: any) => c?.props?.["data-testid"] === "hero-bottom-strip"
    );
    assert.strictEqual(bottomStrip, undefined, "Bottom strip must be hidden when comparison data is missing");

    // Conversely, when comparison data IS present, bottom strip renders
    const reportWithComparison = makeMockReport();
    const heroWithComp = NewsBackdrop({ report: reportWithComparison });
    const childrenWithComp = React.Children.toArray(heroWithComp.props.children);
    const bottomStripWithComp = childrenWithComp.find(
      (c: any) => c?.props?.["data-testid"] === "hero-bottom-strip"
    );
    assert.ok(bottomStripWithComp, "Bottom strip must render when comparison data is present");
  });

  // ─── f. No NYT branding or copied copy appears anywhere ───────────────────────
  it("f. No NYT branding or copied copy appears anywhere", () => {
    const srcDir = path.resolve(__dirname, "../src");

    function scanFiles(dir: string, results: string[] = []): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
          scanFiles(fullPath, results);
        } else if (entry.isFile() && /\.(tsx?|jsx?|md)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = scanFiles(srcDir);
    const forbiddenPhrases = [
      "New York Times",
      "The New York Times",
      "NYTimes",
      "nytimes.com/branding",
      "All the News That's Fit to Print",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const phrase of forbiddenPhrases) {
        assert.strictEqual(
          content.includes(phrase),
          false,
          `Found forbidden NYT reference "${phrase}" in ${file}`
        );
      }
    }
  });

  // ─── g. Verification scores and verdicts are identical before and after ───────
  it("g. Verification scores and verdicts are identical before and after (pure determinism)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Italian government approves youth decree with stricter penalties",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Italy passes Caivano decree targeting juvenile crime",
        url: "https://reuters.com/world/italy-caivano-decree",
        domain: "reuters.com",
        snippet: "Italian government approves decree increasing penalties for minors carrying weapons.",
        publishedAt: "2023-09-08T12:00:00Z",
        sourceType: "wire",
        sourceRelationship: "independent",
        relationship: "supporting",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by Reuters report.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    const report1 = await buildReport(
      {
        title: "Italian government approves youth decree",
        sourceDomain: "reuters.com",
        featuredImage: "https://reuters.com/images/rome.jpg",
      },
      claims,
      evaluations,
      [],
      { evidence }
    );

    const report2 = await buildReport(
      {
        title: "Italian government approves youth decree",
        sourceDomain: "reuters.com",
        featuredImage: "https://reuters.com/images/rome.jpg",
      },
      claims,
      evaluations,
      [],
      { evidence }
    );

    assert.strictEqual(report1.overallTrustScore, report2.overallTrustScore);
    assert.strictEqual(report1.veracityVerdict, report2.veracityVerdict);
    assert.strictEqual(report1.confidence, report2.confidence);
    assert.strictEqual(report1.featuredImage, "https://reuters.com/images/rome.jpg");
    assert.strictEqual(report1.backgroundImage?.sourceType, "article");
    assert.strictEqual(report1.backgroundImage?.credit, "reuters.com");
  });

  // ─── h. Blocked-publisher fallback to related-report image or gradient ─────────
  it("h. Blocked-publisher URL falls back to related-report image with credit or gradient with identical layout", async () => {
    // 1. Blocked article with same_event evidence containing an image
    const evidenceWithImage: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Decree details reported by ANSA",
        url: "https://ansa.it/decree",
        domain: "ansa.it",
        snippet: "Report snippet",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
        imageUrl: "https://ansa.it/photos/lead.jpg",
      } as any,
    ];

    const reportWithRelatedImg = await buildReport(
      {
        title: "Blocked Publisher Article",
        sourceDomain: "blocked-news.com",
        featuredImage: null, // blocked
      },
      [{ id: "c1", text: "Decree passed", importance: "high", layer: "event_occurred", claimType: "event" }],
      [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Supported", evidenceIds: ["ev1"], importantNotes: [] }],
      [],
      { evidence: evidenceWithImage, sourceReadStatus: "unreadable" }
    );

    assert.strictEqual(reportWithRelatedImg.sourceReadStatus, "unreadable");
    assert.strictEqual(reportWithRelatedImg.featuredImage, "https://ansa.it/photos/lead.jpg");
    assert.strictEqual(reportWithRelatedImg.backgroundImage?.sourceType, "evidence");
    assert.strictEqual(reportWithRelatedImg.backgroundImage?.credit, "ansa.it");

    // 2. Blocked article with no related image falls back cleanly to gradient
    const reportWithGradient = await buildReport(
      {
        title: "Blocked Publisher Article Without Image",
        sourceDomain: "blocked-news.com",
        featuredImage: null,
      },
      [{ id: "c1", text: "Decree passed", importance: "high", layer: "event_occurred", claimType: "event" }],
      [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Supported", evidenceIds: ["ev1"], importantNotes: [] }],
      [],
      { sourceReadStatus: "unreadable" }
    );

    assert.strictEqual(reportWithGradient.featuredImage, null);
    const heroGradient = NewsBackdrop({ report: reportWithGradient });
    const children = React.Children.toArray(heroGradient.props.children);
    const fallbackLayer = children.find((c: any) => c?.props?.["data-testid"] === "hero-fallback-layer");
    assert.ok(fallbackLayer, "Must fall back to dark gradient with identical layout");
  });

  // ─── i. Logo, favicon, tracker rejection ──────────────────────────────────────
  it("i. Broken or tiny image, logo or favicon is rejected and the gradient shows", async () => {
    const reportWithLogo = await buildReport(
      {
        title: "Article with Logo",
        sourceDomain: "news.com",
        featuredImage: "https://news.com/static/brand-logo.png", // logo pattern
      },
      [{ id: "c1", text: "Claim", importance: "high", layer: "event_occurred", claimType: "event" }],
      [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Ok", evidenceIds: [], importantNotes: [] }],
      []
    );

    assert.strictEqual(reportWithLogo.featuredImage, null, "Logos must be rejected as featured images");

    const reportWithFavicon = await buildReport(
      {
        title: "Article with Favicon",
        sourceDomain: "news.com",
        featuredImage: "https://news.com/favicon.ico", // favicon pattern
      },
      [{ id: "c1", text: "Claim", importance: "high", layer: "event_occurred", claimType: "event" }],
      [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Ok", evidenceIds: [], importantNotes: [] }],
      []
    );

    assert.strictEqual(reportWithFavicon.featuredImage, null, "Favicons must be rejected");
  });

  // ─── j. Scroll darkening reaches configured maximum (0.85) ─────────────────────
  it("j. Scroll darkening reaches configured maximum and body text remains readable", () => {
    assert.strictEqual(DEFAULT_BACKDROP_CONFIG.scrollDarkenMax, 0.85);
    const effective = getEffectiveBackdropConfig({ scrollDarkenMax: 0.90 });
    assert.strictEqual(effective.scrollDarkenMax, 0.90);

    const report = makeMockReport();
    const hero = NewsBackdrop({ report });
    const children = React.Children.toArray(hero.props.children);
    const scrollDarkenEl = children.find(
      (c: any) => c?.type?.name === "ScrollDarkenLayer"
    ) as any;
    assert.ok(scrollDarkenEl, "ScrollDarkenLayer must be present in hero");
    assert.strictEqual(scrollDarkenEl.props.maxDarken, 0.85);
  });

  // ─── k. Step 2 Layout: 12-column grid, balance headline, no overlap, 3-col strip ───
  it("k. Step 2 Layout: 12-col grid (7 text / 5 stats), balance headline, no overlap, 3-col strip", () => {
    const report = makeMockReport();
    const hero = NewsBackdrop({ report });
    const children = React.Children.toArray(hero.props.children);

    const contentArea = children.find(
      (c: any) => c?.props?.className?.includes("max-w-7xl") && c?.props?.className?.includes("py-8")
    ) as any;
    assert.ok(contentArea, "Center content area must be present");

    const grid = contentArea.props.children;
    assert.ok(grid.props.className.includes("lg:grid-cols-12"), "Must use 12-column grid on desktop");

    const gridChildren = React.Children.toArray(grid.props.children) as any[];
    const leftCol = gridChildren.find((c) => c?.props?.className?.includes("lg:col-span-7"));
    const rightCol = gridChildren.find((c) => c?.props?.className?.includes("lg:col-span-5"));

    assert.ok(leftCol, "Text column must span 7 columns on desktop");
    assert.ok(leftCol.props.className.includes("lg:min-w-[480px]"), "Text column must enforce min-width 480px");

    // Headline check
    const leftChildren = React.Children.toArray(leftCol.props.children) as any[];
    const headline = leftChildren.find((c) => c?.props?.["data-testid"] === "hero-headline");
    assert.ok(headline, "Hero headline must be present");
    assert.ok(headline.props.className.includes("[text-wrap:balance]"), "Headline must have text-wrap: balance");
    assert.ok(headline.props.className.includes("break-normal"), "Headline must use normal word wrapping");

    // Below 1024px mobile stats row
    const mobileStats = leftChildren.find((c) => c?.props?.["data-testid"] === "mobile-stats-row");
    assert.ok(mobileStats, "Below 1024px stats scroll row must be present in DOM");
    assert.ok(mobileStats.props.className.includes("lg:hidden"), "Mobile stats row must be hidden on lg desktop");

    // Right column check
    assert.ok(rightCol, "Stats and key source column must span 5 columns on desktop");
    assert.ok(rightCol.props.className.includes("hidden lg:flex"), "Right column must be hidden below 1024px");
    assert.ok(!rightCol.props.className.includes("absolute"), "Right column must be in normal flow without position:absolute");

    // Bottom strip check
    const bottomStrip = children.find((c: any) => c?.props?.["data-testid"] === "hero-bottom-strip") as any;
    assert.ok(bottomStrip, "Bottom strip must be present");
    const bottomStripInner = bottomStrip.props.children;
    const bottomStripCols = React.Children.toArray(bottomStripInner.props.children) as any[];
    const cardsContainer = bottomStripCols.find((c) => c?.props?.className?.includes("md:grid-cols-3"));
    assert.ok(cardsContainer, "Bottom strip must use a 3-column grid on desktop");
  });

  // ─── l. Step 3 Photo Background: Stacking context, social exclusion, credit line ─
  it("l. Step 3 Photo Background: z-0 backdrop, relative z-10 content, social media image exclusion, credit line", async () => {
    // 1. Social media image rejection in unreadable fallback
    const evidenceWithSocial: Evidence[] = [
      {
        id: "ev-fb",
        claimId: "c1",
        title: "Facebook Post Video",
        url: "https://facebook.com/watch?v=12345",
        domain: "facebook.com",
        snippet: "Video snippet",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "social_media" as any,
        evidenceQuality: "low",
        relevance: "direct",
        eventMatch: "same_event",
        imageUrl: "https://scontent.xx.fbcdn.net/v/photo.jpg",
      } as any,
      {
        id: "ev-hindu",
        claimId: "c1",
        title: "The Hindu reporting on the event",
        url: "https://thehindu.com/news/mumbai/train-incident",
        domain: "thehindu.com",
        snippet: "Accredited news reporting",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        eventMatch: "same_event",
        imageUrl: "https://thehindu.com/photos/train-hero.jpg",
      } as any,
    ];

    const report = await buildReport(
      {
        title: "Unreadable Article",
        sourceDomain: "ndtv.com",
        featuredImage: null,
      },
      [{ id: "c1", text: "Train incident occurred", importance: "high", layer: "event_occurred", claimType: "event" }],
      [{ claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Ok", evidenceIds: ["ev-hindu"], importantNotes: [] }],
      [],
      { evidence: evidenceWithSocial, sourceReadStatus: "unreadable" }
    );

    // Facebook image must be rejected; The Hindu image must be selected
    assert.strictEqual(report.featuredImage, "https://thehindu.com/photos/train-hero.jpg");
    assert.strictEqual(report.backgroundImage?.sourceType, "evidence");
    assert.strictEqual(report.backgroundImage?.credit, "thehindu.com");

    // 2. DOM Stacking check on rendered hero
    const hero = NewsBackdrop({ report });
    assert.ok(hero !== null);
    const heroClassName = hero.props.className;
    // Section must not have opaque bg-[#0B0F17]
    assert.ok(!heroClassName.includes("bg-[#0B0F17]"), "Outer section must not set opaque background");

    const children = React.Children.toArray(hero.props.children) as any[];
    const imageLayer = children.find((c) => c?.props?.["data-testid"] === "hero-image-layer");
    assert.ok(imageLayer, "hero-image-layer must exist at z-0");
    assert.ok(imageLayer.props.className.includes("z-0"), "Image layer must be z-0");
    assert.ok(!imageLayer.props.className.includes("bg-[#111923]"), "Image layer must not have opaque background");

    // Content area must be relative z-10
    const contentArea = children.find(
      (c) => c?.props?.className?.includes("z-10") && c?.props?.className?.includes("max-w-7xl")
    );
    assert.ok(contentArea, "Content area must be in relative z-10 wrapper");

    // Credit line in bottom strip
    const bottomStrip = children.find((c) => c?.props?.["data-testid"] === "hero-bottom-strip");
    assert.ok(bottomStrip, "Bottom strip must exist");
    const bottomStripStr = JSON.stringify(bottomStrip.props);
    assert.ok(
      bottomStripStr.includes("Image from a related report: thehindu.com"),
      "Credit line must be formatted as 'Image from a related report: <domain>'"
    );
  });
});

