import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinalVerificationDashboard } from "../src/components/verification/FinalVerificationDashboard";
import { VerificationReport } from "../src/schemas/verification";
import { ClaimInput, Evidence } from "../src/schemas/evidence";

const ARTIFACT_DIR = path.resolve(
  "C:/Users/laksh/.gemini/antigravity/brain/f69ac038-1823-4a97-b1e8-caddbc7a4b43"
);
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const HTML_DIR = path.resolve("scratch/html");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
if (!fs.existsSync(HTML_DIR)) {
  fs.mkdirSync(HTML_DIR, { recursive: true });
}

// High-resolution SVGs for realistic visuals
const trainPhotoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="trainBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="60%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="platformLight" cx="65%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.3" />
      <stop offset="60%" stop-color="#38BDF8" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#trainBg)" />
  <rect width="100%" height="100%" fill="url(#platformLight)" />
  <rect x="580" y="220" width="460" height="340" rx="16" fill="#334155" opacity="0.85" />
  <rect x="620" y="270" width="160" height="120" rx="8" fill="#0EA5E9" opacity="0.7" />
  <rect x="820" y="270" width="180" height="120" rx="8" fill="#0EA5E9" opacity="0.7" />
  <line x1="500" y1="560" x2="1280" y2="560" stroke="#94A3B8" stroke-width="8" />
  <line x1="450" y1="600" x2="1280" y2="600" stroke="#64748B" stroke-width="12" />
</svg>
`)}`;

const newsPhotoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="newsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
    <radialGradient id="podiumGlow" cx="70%" cy="35%" r="50%">
      <stop offset="0%" stop-color="#FCD34D" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#38BDF8" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#newsGrad)" />
  <rect width="100%" height="100%" fill="url(#podiumGlow)" />
  <circle cx="820" cy="260" r="75" fill="#FED7AA" opacity="0.9" />
  <path d="M 720 380 L 920 380 L 950 680 L 690 680 Z" fill="#1E293B" opacity="0.9" />
  <rect x="780" y="480" width="80" height="240" fill="#047857" opacity="0.75" />
</svg>
`)}`;

const sportsPhotoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="sportsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="50%" stop-color="#1E3A8A" />
      <stop offset="100%" stop-color="#0369A1" />
    </linearGradient>
    <radialGradient id="floodlights" cx="68%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.5" />
      <stop offset="70%" stop-color="#0F172A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sportsGrad)" />
  <rect width="100%" height="100%" fill="url(#floodlights)" />
  <circle cx="850" cy="220" r="60" fill="#FDBA74" />
  <path d="M 760 320 L 940 320 L 980 680 L 720 680 Z" fill="#DC2626" opacity="0.85" />
  <path d="M 600 720 Q 800 480 1000 720" fill="#15803D" opacity="0.6" />
</svg>
`)}`;

// ── 1. Scenario: NDTV Mumbai Local Story (Unreadable, 0 Independent, "Unable to Verify") ──
const report1_ndtv: VerificationReport = {
  articleTitle: "Woman objects to 'bad touch', pushed off Mumbai local train, loses arm",
  sourceDomain: "ndtv.com",
  articleUrl: "https://www.ndtv.com/mumbai-news/woman-objects-to-bad-touch-pushed-off-mumbai-local-train-loses-arm-6948529",
  sourceReadStatus: "unreadable",
  sourceReadNote: "No independent reporting of this event was found.",
  featuredImage: trainPhotoSvg,
  backgroundImage: {
    url: trainPhotoSvg,
    sourceType: "evidence",
    credit: "thehindu.com",
    luminance: 0.32,
  },
  publishedAt: "2024-11-04T12:00:00Z",
  overallTrustScore: 48,
  veracityVerdict: "unverified",
  confidence: "low",
  summary: "NDTV report was blocked by anti-bot challenge (HTTP 403). Web search returned social media posts and historic 2023 items outside the 14-day window. With 0 independent news reports corroborating the event, the claim cannot be verified.",
  claimSummary: {
    total: 2,
    supporting: 0,
    contradicting: 0,
    qualifying: 0,
    insufficient: 2,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "insufficient",
      confidence: "low",
      explanation: "No independent news reporting found within the event window; social media posts are excluded.",
      evidenceIds: [],
      importantNotes: ["Social media excluded from independent corroboration."],
      layer: "event_occurred",
      certainty: "asserted_fact",
    },
    {
      claimId: "c2",
      verdict: "insufficient",
      confidence: "low",
      explanation: "Suspect arrest details cannot be corroborated by accredited outlets.",
      evidenceIds: [],
      importantNotes: [],
      layer: "underlying_fact",
      certainty: "asserted_fact",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 50,
    contextPenalty: 0,
    confidenceAdjustment: -2,
    finalScore: 48,
  },
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

// ── 2. Scenario: A Readable Article (3 Independent Clusters, "Mostly Trustworthy", High Conf) ──
const report2_readable: VerificationReport = {
  articleTitle: "Italy's Meloni toughens protest laws, teen detentions, 5-year jail term",
  sourceDomain: "reuters.com",
  articleUrl: "https://www.reuters.com/world/europe/italy-approves-youth-crime-crackdown-2023-09-08/",
  sourceReadStatus: "readable",
  featuredImage: newsPhotoSvg,
  backgroundImage: {
    url: newsPhotoSvg,
    sourceType: "article",
    credit: "reuters.com",
    luminance: 0.38,
  },
  publishedAt: "2023-09-08T18:00:00Z",
  overallTrustScore: 88,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary: "The Italian cabinet approved strict new criminal penalties targeting youth crime and protests. Corroborated independently across 3 national and international news agencies.",
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
      explanation: "Government gazette decree confirms new measures passed by cabinet.",
      evidenceIds: ["ev1", "ev2"],
      importantNotes: [],
      layer: "event_occurred",
      certainty: "asserted_fact",
    },
    {
      claimId: "c2",
      verdict: "supporting",
      confidence: "high",
      explanation: "Penalties up to 5 years jail for protest disruptions confirmed by law text.",
      evidenceIds: ["ev1", "ev3"],
      importantNotes: [],
      layer: "legal_policy",
      certainty: "asserted_fact",
    },
    {
      claimId: "c3",
      verdict: "qualifying",
      confidence: "high",
      explanation: "Juvenile detention applies to specific violent offences, not all infractions.",
      evidenceIds: ["ev2"],
      importantNotes: ["Qualification on juvenile detention scope."],
      layer: "underlying_fact",
      certainty: "asserted_fact",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 92,
    contextPenalty: 4,
    confidenceAdjustment: 0,
    finalScore: 88,
  },
  comparison: {
    totalIndependentClusters: 3,
    totalConflicts: 0,
    totalUnresolvedDimensions: 0,
    coverageLimited: false,
    claims: [
      {
        claimId: "c1",
        independentClusterCount: 3,
        agreementSummary: "strong",
        conflicts: [],
        dimensions: [
          {
            dimension: "event",
            outcome: "agreement",
            sourceValues: [
              { sourceName: "reuters.com", evidenceId: "ev1", passageSnippet: "Cabinet decree approved" },
              { sourceName: "ansa.it", evidenceId: "ev2", passageSnippet: "Caivano security decree passed" },
              { sourceName: "corriere.it", evidenceId: "ev3", passageSnippet: "New measures signed into law" },
            ],
          },
        ],
      },
    ],
  },
};

// ── 3. Scenario: A Claim Input (Sports Rumour / Speculation) ──
const report3_claim: VerificationReport = {
  articleTitle: "Hardik Pandya will join Punjab Kings in IPL 2027",
  sourceDomain: "user_claim",
  articleUrl: null,
  featuredImage: sportsPhotoSvg,
  backgroundImage: {
    url: sportsPhotoSvg,
    sourceType: "evidence",
    credit: "espncricinfo.com",
    luminance: 0.35,
  },
  publishedAt: "2026-11-12T12:00:00Z",
  overallTrustScore: 62,
  veracityVerdict: "mixed",
  confidence: "medium",
  storyStatus: "unconfirmed_reports",
  summary: "This story reports unconfirmed developments. Available reports discuss potential franchise interest, but no contract or official transfer has been registered.",
  claimSummary: {
    total: 2,
    supporting: 1,
    contradicting: 0,
    qualifying: 1,
    insufficient: 0,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "medium",
      explanation: "Multiple cricket analysts note Punjab Kings' active scouting interest.",
      evidenceIds: ["ev_cric"],
      importantNotes: ["Hedged reporting: negotiations discussed, not finalized."],
      layer: "statement_made",
      certainty: "speculation",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 65,
    contextPenalty: 0,
    confidenceAdjustment: -3,
    finalScore: 62,
  },
  comparison: {
    totalIndependentClusters: 2,
    totalConflicts: 0,
    totalUnresolvedDimensions: 1,
    coverageLimited: false,
    claims: [
      {
        claimId: "c1",
        independentClusterCount: 2,
        agreementSummary: "moderate",
        conflicts: [],
        dimensions: [
          {
            dimension: "status",
            outcome: "unconfirmed_variation",
            sourceValues: [
              { sourceName: "espncricinfo.com", evidenceId: "ev_cric", passageSnippet: "Preliminary talks ongoing" },
              { sourceName: "cricbuzz.com", evidenceId: "ev_buzz", passageSnippet: "Franchise explores leadership options" },
            ],
          },
        ],
      },
    ],
  },
};

// ── 4. Scenario: A No-Image Fallback (Dark Gradient Hero) ──
const report4_no_image: VerificationReport = {
  articleTitle: "Municipal Water Safety Alert Issued for North District",
  sourceDomain: "cityherald.org",
  articleUrl: "https://cityherald.org/news/water-safety-2026",
  sourceReadStatus: "readable",
  featuredImage: null,
  publishedAt: "2026-11-10T09:00:00Z",
  overallTrustScore: 94,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary: "Official advisory issued following routine pipeline maintenance. Filtered dark gradient hero rendered cleanly with zero images.",
  claimSummary: {
    total: 1,
    supporting: 1,
    contradicting: 0,
    qualifying: 0,
    insufficient: 0,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Water department official advisory confirms advisory.",
      evidenceIds: ["ev_water"],
      importantNotes: [],
      layer: "event_occurred",
      certainty: "asserted_fact",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 94,
    contextPenalty: 0,
    confidenceAdjustment: 0,
    finalScore: 94,
  },
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
            sourceValues: [
              { sourceName: "gov.water.org", evidenceId: "ev_water", passageSnippet: "Notice posted" },
            ],
          },
        ],
      },
    ],
  },
};

const evidenceForReports: Record<string, Evidence[]> = {
  scenario1_ndtv: [
    {
      id: "ev_fb",
      claimId: "c1",
      title: "Video shared on Facebook regarding train incident",
      domain: "facebook.com",
      url: "https://facebook.com/watch?v=12345",
      snippet: "Social post snippet",
      sourceRelationship: "unknown",
      relationship: "supporting",
      sourceType: "social_media" as any,
      evidenceQuality: "low",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2024-11-04T13:00:00Z",
    } as any,
  ],
  scenario2_readable: [
    {
      id: "ev1",
      claimId: "c1",
      title: "Italy approves juvenile crackdown decree",
      domain: "reuters.com",
      url: "https://reuters.com/world/italy-decree",
      snippet: "Cabinet approves security decree",
      sourceRelationship: "original",
      relationship: "supporting",
      sourceType: "wire",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2023-09-08T18:00:00Z",
    } as any,
    {
      id: "ev2",
      claimId: "c1",
      title: "Meloni cabinet passes Caivano security decree",
      domain: "ansa.it",
      url: "https://ansa.it/italy-decree",
      snippet: "Measures passed today in Rome",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2023-09-08T18:30:00Z",
    } as any,
    {
      id: "ev3",
      claimId: "c2",
      title: "Corriere: New sanctions for youth and protest offences",
      domain: "corriere.it",
      url: "https://corriere.it/italy-decree",
      snippet: "Penalties up to five years",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2023-09-08T19:00:00Z",
    } as any,
  ],
  scenario3_claim: [
    {
      id: "ev_cric",
      claimId: "c1",
      title: "Franchise explores strategic trade discussions",
      domain: "espncricinfo.com",
      url: "https://espncricinfo.com/story/ipl-trades-2027",
      snippet: "Punjab Kings monitor captaincy options",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2026-11-12T10:00:00Z",
    } as any,
    {
      id: "ev_buzz",
      claimId: "c1",
      title: "Cricbuzz analysis: Punjab Kings long-term planning",
      domain: "cricbuzz.com",
      url: "https://cricbuzz.com/ipl-talks",
      snippet: "Informal talks reported between agents",
      sourceRelationship: "independent",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2026-11-12T11:00:00Z",
    } as any,
  ],
  scenario4_no_image: [
    {
      id: "ev_water",
      claimId: "c1",
      title: "North District Water Advisory",
      domain: "gov.water.org",
      url: "https://gov.water.org/notices/2026-11",
      snippet: "Precautionary advisory in effect",
      sourceRelationship: "original",
      relationship: "supporting",
      sourceType: "official",
      evidenceQuality: "high",
      relevance: "direct",
      eventMatch: "same_event",
      publishedAt: "2026-11-10T08:00:00Z",
    } as any,
  ],
};

function buildHtmlPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FakeNewzz</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0F17;
      color: #F5F5F5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .font-editorial {
      font-family: 'Newsreader', serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body class="min-h-screen text-[#F5F5F5]">
  ${content}
</body>
</html>`;
}

function findChromePath(): string {
  const candidatePaths = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return "chrome";
}

async function run() {
  const chromePath = findChromePath();
  const userDataDir = path.resolve("scratch/chrome-profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const scenarios = [
    {
      id: "scenario_ndtv_mumbai_local",
      name: "NDTV Mumbai Local Story (Unreadable, 0 Independent, Unable to Verify)",
      report: report1_ndtv,
      evidence: evidenceForReports.scenario1_ndtv,
    },
    {
      id: "scenario_readable_article",
      name: "Readable Article (3 Independent Clusters, Mostly Trustworthy, High Confidence)",
      report: report2_readable,
      evidence: evidenceForReports.scenario2_readable,
    },
    {
      id: "scenario_claim_input",
      name: "Claim Input (IPL 2027 Speculation, 2 Clusters, Medium Confidence)",
      report: report3_claim,
      evidence: evidenceForReports.scenario3_claim,
    },
    {
      id: "scenario_no_image_fallback",
      name: "No-Image Fallback (Dark Gradient Hero, Verified True)",
      report: report4_no_image,
      evidence: evidenceForReports.scenario4_no_image,
    },
  ];

  const viewports = [
    { name: "375px", width: 375, height: 1200 },
    { name: "768px", width: 768, height: 1200 },
    { name: "1280px", width: 1280, height: 1200 },
    { name: "1920px", width: 1920, height: 1200 },
  ];

  console.log(`\nCapturing Step 5 verification screenshots across 4 scenarios at 375, 768, 1280, 1920px...`);

  for (const s of scenarios) {
    const markup = renderToStaticMarkup(
      React.createElement(FinalVerificationDashboard, {
        report: s.report,
        evidence: s.evidence,
        onReset: () => {},
      })
    );

    const fullHtml = buildHtmlPage(s.name, markup);
    const htmlFilePath = path.join(HTML_DIR, `${s.id}.html`);
    fs.writeFileSync(htmlFilePath, fullHtml, "utf8");

    for (const vp of viewports) {
      const outPng = path.join(SCREENSHOT_DIR, `${s.id}_${vp.name}.png`);
      execFileSync(chromePath, [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        `--user-data-dir=${userDataDir}`,
        `--window-size=${vp.width},${vp.height}`,
        `--screenshot=${outPng}`,
        `file:///${htmlFilePath.replace(/\\/g, "/")}`,
      ]);

      // Copy to artifact root as well
      fs.copyFileSync(outPng, path.join(ARTIFACT_DIR, `${s.id}_${vp.name}.png`));
      console.log(`  ✓ Captured ${s.id} at ${vp.name}`);
    }
  }

  console.log(`\nAll 16 screenshots successfully captured across all 4 scenarios and 4 viewports!`);
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

