import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinalVerificationDashboard } from "../src/components/verification/FinalVerificationDashboard";
import { VerificationReport } from "../src/schemas/verification";
import { Evidence } from "../src/schemas/evidence";

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

// Background SVG images
const darkNewsPhotoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="newsBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="60%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="podiumLight" cx="65%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#newsBg)" />
  <rect width="100%" height="100%" fill="url(#podiumLight)" />
  <rect x="600" y="240" width="420" height="320" rx="16" fill="#334155" opacity="0.8" />
  <line x1="500" y1="560" x2="1280" y2="560" stroke="#94A3B8" stroke-width="8" />
</svg>
`)}`;

// High-key / Bright photo SVG to rigorously test luminance and scrim readability
const brightNewsPhotoSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="brightBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="40%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="65%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#FEF08A" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#E2E8F0" stop-opacity="0.3" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#brightBg)" />
  <rect width="100%" height="100%" fill="url(#sunGlow)" />
  <circle cx="950" cy="220" r="140" fill="#FFFFFF" opacity="0.95" />
  <rect x="700" y="300" width="480" height="260" rx="12" fill="#E2E8F0" opacity="0.9" />
</svg>
`)}`;

const commonEvidence: Evidence[] = [
  {
    id: "ev-1",
    claimId: "c1",
    title: "International Press wire coverage confirms core event",
    url: "https://reuters.com/world/article",
    domain: "reuters.com",
    snippet: "Independent journalists corroborate the sequence of events.",
    publishedAt: "2026-11-12T10:00:00Z",
    sourceType: "wire",
    sourceRelationship: "independent",
    relationship: "supporting",
    evidenceQuality: "high",
    relevance: "direct",
  },
  {
    id: "ev-2",
    claimId: "c1",
    title: "National Broadcaster independent verification report",
    url: "https://bbc.com/news/world",
    domain: "bbc.com",
    snippet: "Official records and satellite telemetry confirm event timeline.",
    publishedAt: "2026-11-12T11:30:00Z",
    sourceType: "primary_source",
    sourceRelationship: "independent",
    relationship: "supporting",
    evidenceQuality: "high",
    relevance: "direct",
  },
  {
    id: "ev-3",
    claimId: "c1",
    title: "Financial Times analysis of economic impact",
    url: "https://ft.com/content/123",
    domain: "ft.com",
    snippet: "Regulatory filings confirm underlying financial figures.",
    publishedAt: "2026-11-12T14:00:00Z",
    sourceType: "press",
    sourceRelationship: "independent",
    relationship: "supporting",
    evidenceQuality: "high",
    relevance: "direct",
  },
];

// 1. Green Tone Report: Verified True / Mostly True
const greenReport: VerificationReport = {
  articleTitle: "Global Health Treaty Ratified by 120 Member Nations",
  sourceDomain: "reuters.com",
  articleUrl: "https://reuters.com/world/health-treaty",
  featuredImage: darkNewsPhotoSvg,
  author: "Sarah Jenkins",
  publishedAt: "2026-11-12T10:00:00Z",
  overallTrustScore: 94,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary:
    "The story reports the formal ratification of the international pandemic accord. Independent reporting across 9 international wires and public gazettes confirms all core provisions. No major factual disputes or material omissions were identified. In conclusion, the story is confirmed true.",
  conclusion: {
    label: "True",
    explanation: "All core claims pass strict verification with zero material conflicts.",
    reasonCodes: ["GATE_100_PASSED", "ALL_CLAIMS_SUPPORTED"],
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Full text matching gazette deposit records",
      evidenceIds: ["ev-1", "ev-2"],
      importantNotes: [],
    },
  ],
  omittedContext: [],
  claimSummary: { totalClaims: 1, verifiedTrue: 1, verifiedFalse: 0, unverified: 0 },
  scoreBreakdown: { finalScore: 94, claimScore: 94, contextPenalty: 0, confidenceAdjustment: 0 },
  comparison: {
    totalIndependentClusters: 3,
    totalConflicts: 0,
    totalUnresolvedDimensions: 0,
    coverageLimited: false,
    claims: [],
  },
};

// 2. Amber Tone Report: Unconfirmed / Developing Rumour
const amberReport: VerificationReport = {
  articleTitle: "Emergency Cabinet Meeting Rumoured Over Tech Regulation",
  sourceDomain: "theguardian.com",
  articleUrl: "https://theguardian.com/politics/rumours",
  featuredImage: darkNewsPhotoSvg,
  author: "David Miller",
  publishedAt: "2026-11-13T08:00:00Z",
  overallTrustScore: 68,
  veracityVerdict: "unverified",
  confidence: "medium",
  summary:
    "The story reports unconfirmed claims of an extraordinary weekend meeting. Independent reports confirm discussions occurred, but officials dispute whether formal binding decisions were tabled. Several key details regarding timing remain unconfirmed. In conclusion, the story remains unconfirmed.",
  conclusion: {
    label: "Unconfirmed",
    explanation: "Developing reports with credible sources but missing official confirmation.",
    reasonCodes: ["UNCONFIRMED_REPORTS", "DEVELOPING_STORY"],
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "qualifying",
      confidence: "medium",
      explanation: "Discussions verified but agenda unconfirmed",
      evidenceIds: ["ev-1"],
      importantNotes: ["Meeting attendees unverified"],
    },
  ],
  omittedContext: [],
  claimSummary: { totalClaims: 1, verifiedTrue: 0, verifiedFalse: 0, unverified: 1 },
  scoreBreakdown: { finalScore: 68, claimScore: 68, contextPenalty: 0, confidenceAdjustment: 0 },
  comparison: {
    totalIndependentClusters: 2,
    totalConflicts: 1,
    totalUnresolvedDimensions: 1,
    coverageLimited: false,
    claims: [],
  },
};

// 3. Red Tone Report: False / Contradicted
const redReport: VerificationReport = {
  articleTitle: "Central Bank Secretly Freezes All Private Foreign Accounts",
  sourceDomain: "conspiracy-wire.org",
  articleUrl: "https://conspiracy-wire.org/freeze",
  featuredImage: darkNewsPhotoSvg,
  author: "Anonymous",
  publishedAt: "2026-11-13T12:00:00Z",
  overallTrustScore: 14,
  veracityVerdict: "false",
  confidence: "high",
  summary:
    "The story alleges a clandestine freeze on private overseas bank accounts. Official statements and financial regulatory disclosures explicitly refute the claim as fabricated. International banking wire records show continuous normal operations without disruption. In conclusion, the story is false.",
  conclusion: {
    label: "False",
    explanation: "Central claims directly refuted by central bank filings and verified records.",
    reasonCodes: ["CONTRADICTED", "FABRICATED_ALLEGATION"],
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "contradicting",
      confidence: "high",
      explanation: "Official regulatory bodies confirm claim is entirely untrue",
      evidenceIds: ["ev-1", "ev-2"],
      importantNotes: [],
    },
  ],
  omittedContext: [],
  claimSummary: { totalClaims: 1, verifiedTrue: 0, verifiedFalse: 1, unverified: 0 },
  scoreBreakdown: { finalScore: 14, claimScore: 14, contextPenalty: 0, confidenceAdjustment: 0 },
  comparison: {
    totalIndependentClusters: 3,
    totalConflicts: 2,
    totalUnresolvedDimensions: 2,
    coverageLimited: false,
    claims: [],
  },
};

// 4. Grey Tone Report: Can't Verify / Blocked Ingestion
const greyReport: VerificationReport = {
  articleTitle: "Local Municipal Zoning Change Adopted in Closed Session",
  sourceDomain: "regional-paywall.local",
  articleUrl: "https://regional-paywall.local/zoning",
  featuredImage: darkNewsPhotoSvg,
  sourceReadStatus: "unreadable",
  sourceReadNote: "We couldn't read the original article, so this check is based on independent reporting.",
  author: null,
  publishedAt: "2026-11-11T16:00:00Z",
  overallTrustScore: 35,
  veracityVerdict: "unverified",
  confidence: "low",
  summary:
    "This verification is based on independent reporting of the same story. Available local gazettes provide insufficient detail to establish whether a formal binding vote concluded. Key council records remain inaccessible. In conclusion, FakeNewzz cannot verify this story.",
  conclusion: {
    label: "Can't verify",
    explanation: "Original source was unreadable and independent records provide insufficient confirmation.",
    reasonCodes: ["UNREADABLE_SOURCE", "INSUFFICIENT_EVIDENCE"],
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "qualifying",
      confidence: "low",
      explanation: "Partial references in local notices without minutes",
      evidenceIds: ["ev-1"],
      importantNotes: [],
    },
  ],
  omittedContext: [],
  claimSummary: { totalClaims: 1, verifiedTrue: 0, verifiedFalse: 0, unverified: 1 },
  scoreBreakdown: { finalScore: 35, claimScore: 35, contextPenalty: 0, confidenceAdjustment: 0 },
};

// 5. Bright Background Photo Report (Confirming AA Readability under Scrims)
const brightPhotoReport: VerificationReport = {
  ...amberReport,
  articleTitle: "Solar Infrastructure Project Milestone Clears State Review",
  sourceDomain: "clean-energy-daily.com",
  featuredImage: brightNewsPhotoSvg,
  conclusion: {
    label: "Partly true",
    explanation: "Permit approved for Phase 1; grid connection approval remains pending.",
    reasonCodes: ["PARTIAL_CORROBORATION", "UNRESOLVED_DETAIL"],
  },
};

function buildHtmlPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FakeNewzz Tone Verification</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --background: #0B0F17;
      --surface: #111923;
    }
    [data-tone="green"] {
      --tone: #10B981;
      --tone-soft: rgba(16, 185, 129, 0.12);
      --tone-border: rgba(16, 185, 129, 0.35);
      --tone-glow: rgba(16, 185, 129, 0.25);
      --tone-text: #34D399;
    }
    [data-tone="amber"] {
      --tone: #F59E0B;
      --tone-soft: rgba(245, 158, 11, 0.12);
      --tone-border: rgba(245, 158, 11, 0.35);
      --tone-glow: rgba(245, 158, 11, 0.25);
      --tone-text: #FBBF24;
    }
    [data-tone="red"] {
      --tone: #EF4444;
      --tone-soft: rgba(239, 68, 68, 0.12);
      --tone-border: rgba(239, 68, 68, 0.35);
      --tone-glow: rgba(239, 68, 68, 0.25);
      --tone-text: #F87171;
    }
    [data-tone="grey"] {
      --tone: #64748B;
      --tone-soft: rgba(100, 116, 139, 0.15);
      --tone-border: rgba(100, 116, 139, 0.35);
      --tone-glow: rgba(100, 116, 139, 0.20);
      --tone-text: #94A3B8;
    }
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
  const userDataDir = path.resolve("scratch/chrome-tone-profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const scenarios = [
    {
      id: "tone_green",
      name: "Green Tone (True / Mostly True)",
      report: greenReport,
      evidence: commonEvidence,
    },
    {
      id: "tone_amber",
      name: "Amber Tone (Partly True / Unconfirmed)",
      report: amberReport,
      evidence: commonEvidence,
    },
    {
      id: "tone_red",
      name: "Red Tone (False / Contradicted)",
      report: redReport,
      evidence: commonEvidence,
    },
    {
      id: "tone_grey",
      name: "Grey Tone (Can't Verify / Unreadable)",
      report: greyReport,
      evidence: commonEvidence,
    },
    {
      id: "tone_bright_photo",
      name: "Bright Photo Readability (Amber Tone with High-Key Photo)",
      report: brightPhotoReport,
      evidence: commonEvidence,
    },
  ];

  const viewports = [
    { name: "375px", width: 375, height: 1200 },
    { name: "1280px", width: 1280, height: 1200 },
  ];

  console.log(`\nCapturing Tone Screenshots across all 4 tones + bright photo at 375px and 1280px...`);

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

  console.log(`\nAll tone screenshots successfully captured!`);
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
