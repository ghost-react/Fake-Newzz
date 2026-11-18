import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "../src/components/layout/Header";
import { SearchBar } from "../src/components/verification/SearchBar";
import { ErrorState } from "../src/components/verification/ErrorState";
import { FinalVerificationDashboard } from "../src/components/verification/FinalVerificationDashboard";
import { VerificationReport } from "../src/schemas/verification";
import { Evidence } from "../src/schemas/evidence";
import { ShieldCheck } from "lucide-react";

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

const validReport: VerificationReport = {
  articleTitle: "JWST Confirms Atmospheric Carbon Dioxide on Exoplanet K2-18b",
  sourceDomain: "astronomyherald.org",
  articleUrl: "https://astronomyherald.org/news/jwst-k2-18b-atmosphere",
  featuredImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200",
  author: "Dr. Sarah Chen, Astrophysics Correspondent",
  publishedAt: "2026-05-12T14:30:00Z",
  overallTrustScore: 96,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary:
    "Strong evidence from NASA, ESA, and international peer-reviewed spectroscopic analyses corroborates the detection of carbon dioxide and methane in the atmosphere of exoplanet K2-18b. Multiple independent research groups confirm observational data.",
  claimSummary: {
    total: 3,
    supporting: 3,
    contradicting: 0,
    qualifying: 0,
    insufficient: 0,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Independent spectroscopic absorption profiles published by NASA directly verify carbon dioxide spectral lines.",
      evidenceIds: ["ev-1", "ev-2"],
      importantNotes: [],
      layer: "event_occurred",
    },
    {
      claimId: "c2",
      verdict: "supporting",
      confidence: "high",
      explanation: "Official press conference transcript confirms research leads announced findings at American Astronomical Society.",
      evidenceIds: ["ev-3"],
      importantNotes: [],
      layer: "statement_made",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 96,
    contextPenalty: 0,
    confidenceAdjustment: 0,
    finalScore: 96,
  },
  comparison: {
    totalIndependentClusters: 4,
    totalConflicts: 0,
    totalUnresolvedDimensions: 0,
    coverageLimited: false,
    claims: [
      {
        claimId: "c1",
        independentClusterCount: 4,
        agreementSummary: "strong",
        conflicts: [],
        dimensions: [
          {
            dimension: "event",
            outcome: "agreement",
            articleValue: "JWST detected carbon dioxide in K2-18b",
            sourceValues: [
              {
                clusterId: "nasa-gov",
                evidenceId: "ev-1",
                value: "NASA STScI confirms CO2 spectral signatures",
                quote: "spectroscopic evidence confirms atmospheric carbon dioxide",
              },
            ],
          },
        ],
      },
    ],
  },
  editorialTone: {
    tone: "neutral",
    sensationalScore: 5,
    flaggedPhrases: [],
    analysis: "Neutral and factual scientific reporting.",
  },
  sourceReadStatus: "readable",
};

const commonEvidence: Evidence[] = [
  {
    id: "ev-1",
    claimId: "c1",
    title: "NASA Webb Discovers Carbon Dioxide in Atmosphere of Exoplanet",
    snippet: "Data from the James Webb Space Telescope confirms carbon dioxide absorption lines.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "international_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2026-05-12T14:35:00Z",
    sourceContentStatus: "snippet_only",
    url: "https://nasa.gov/news/jwst-k2-18b",
    domain: "nasa.gov",
  },
  {
    id: "ev-2",
    claimId: "c1",
    title: "Nature Astronomy: Atmospheric Carbon Dioxide Detected in K2-18b",
    snippet: "Spectroscopic transmission spectra from NIRSpec reveal robust signatures of CO2.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "international_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2026-05-12T15:00:00Z",
    sourceContentStatus: "snippet_only",
    url: "https://nature.com/articles/s41550-026-0182",
    domain: "nature.com",
  },
];

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
<body class="min-h-screen text-[#F5F5F5] bg-[#0B0F17]">
  ${content}
</body>
</html>`;
}

function renderHomepage(): string {
  const headerMarkup = renderToStaticMarkup(
    React.createElement(Header, {
      onOpenMethodology: () => {},
      onSelectSample: () => {},
      onScrollToSearch: () => {},
    })
  );

  const searchBarMarkup = renderToStaticMarkup(
    React.createElement(SearchBar, {
      onSearch: () => {},
      placeholder: "Paste a news article link",
    })
  );

  return `
  <div class="flex flex-col min-h-screen">
    ${headerMarkup}
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      <section id="search-section" class="text-center space-y-6 pt-4 pb-2">
        <div class="space-y-3 max-w-3xl mx-auto">
          <h1 class="text-3xl sm:text-5xl lg:text-6xl font-editorial font-bold text-white tracking-tight leading-[1.15]">
            Is this news trustworthy?
          </h1>
          <p class="text-sm sm:text-base text-[#A1A1AA] max-w-xl mx-auto leading-relaxed font-sans">
            Check the evidence before you believe or share it.
          </p>
        </div>
        <div class="pt-2">
          ${searchBarMarkup}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-3 text-xs font-mono text-[#717B89]">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Evidence-based verification</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>Independent source comparison</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Missing context detection</span>
          </div>
        </div>
      </section>

      <div id="verification-results" class="pt-2">
        <div class="text-center py-16 px-4 space-y-4 max-w-lg mx-auto border-t border-white/[0.04]">
          <div class="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-emerald-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          <h3 class="font-editorial text-2xl font-bold text-[#F5F5F5]">
            Paste a news article link above to check its trustworthiness.
          </h3>
          <p class="text-xs sm:text-sm text-[#A1A1AA] font-sans leading-relaxed">
            FakeNewzz analyzes the article, cross-references independent primary records, and identifies missing context so you get a transparent, evidence-backed trust score.
          </p>
        </div>
      </div>
    </main>
  </div>`;
}

function renderInvalidInputScreen(): string {
  const headerMarkup = renderToStaticMarkup(
    React.createElement(Header, {
      onOpenMethodology: () => {},
      onSelectSample: () => {},
      onScrollToSearch: () => {},
    })
  );

  const searchBarMarkup = renderToStaticMarkup(
    React.createElement(SearchBar, {
      onSearch: () => {},
      initialQuery: "Italy Meloni protest laws with 5-year jail term",
      placeholder: "Paste a news article link",
    })
  );

  const errorMarkup = renderToStaticMarkup(
    React.createElement(ErrorState, {
      type: "INVALID_URL",
      message: "FakeNewzz currently checks news article links. Paste a link to the article.",
    })
  );

  return `
  <div class="flex flex-col min-h-screen">
    ${headerMarkup}
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      <section id="search-section" class="text-center space-y-6 pt-4 pb-2">
        <div class="space-y-3 max-w-3xl mx-auto">
          <h1 class="text-3xl sm:text-5xl lg:text-6xl font-editorial font-bold text-white tracking-tight leading-[1.15]">
            Is this news trustworthy?
          </h1>
          <p class="text-sm sm:text-base text-[#A1A1AA] max-w-xl mx-auto leading-relaxed font-sans">
            Check the evidence before you believe or share it.
          </p>
        </div>
        <div class="pt-2">
          ${searchBarMarkup}
        </div>
      </section>

      <div id="verification-results" class="pt-2">
        ${errorMarkup}
      </div>
    </main>
  </div>`;
}

function renderUnreadableArticleScreen(): string {
  const headerMarkup = renderToStaticMarkup(
    React.createElement(Header, {
      onOpenMethodology: () => {},
      onSelectSample: () => {},
      onScrollToSearch: () => {},
    })
  );

  const searchBarMarkup = renderToStaticMarkup(
    React.createElement(SearchBar, {
      onSearch: () => {},
      initialQuery: "https://wsj.com/articles/paywalled-subscription-required-12345",
      placeholder: "Paste a news article link",
    })
  );

  const errorMarkup = renderToStaticMarkup(
    React.createElement(ErrorState, {
      type: "EXTRACTION_FAILED",
      message: "The publisher may block automated access or require a subscription. Try another link to the same story.",
    })
  );

  return `
  <div class="flex flex-col min-h-screen">
    ${headerMarkup}
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      <section id="search-section" class="text-center space-y-6 pt-4 pb-2">
        <div class="space-y-3 max-w-3xl mx-auto">
          <h1 class="text-3xl sm:text-5xl lg:text-6xl font-editorial font-bold text-white tracking-tight leading-[1.15]">
            Is this news trustworthy?
          </h1>
          <p class="text-sm sm:text-base text-[#A1A1AA] max-w-xl mx-auto leading-relaxed font-sans">
            Check the evidence before you believe or share it.
          </p>
        </div>
        <div class="pt-2">
          ${searchBarMarkup}
        </div>
      </section>

      <div id="verification-results" class="pt-2">
        ${errorMarkup}
      </div>
    </main>
  </div>`;
}

function renderValidResultScreen(): string {
  const dashboardMarkup = renderToStaticMarkup(
    React.createElement(FinalVerificationDashboard, {
      report: validReport,
      evidence: commonEvidence,
      onReset: () => {},
    })
  );

  return `
  <div id="verification-results" data-tone="green" class="flex-1 w-full flex flex-col space-y-12 transition-colors duration-300">
    ${dashboardMarkup}
  </div>`;
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
  const userDataDir = path.resolve("scratch/chrome-url-only-profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const screens = [
    {
      id: "homepage",
      name: "FakeNewzz URL-Only Homepage",
      html: renderHomepage(),
    },
    {
      id: "valid_result",
      name: "FakeNewzz Valid Article Result",
      html: renderValidResultScreen(),
    },
    {
      id: "invalid_input",
      name: "FakeNewzz Invalid Input Notice",
      html: renderInvalidInputScreen(),
    },
    {
      id: "unreadable_article",
      name: "FakeNewzz Unreadable Article Screen",
      html: renderUnreadableArticleScreen(),
    },
  ];

  const viewports = [
    { name: "375px", width: 375, height: 900 },
    { name: "1280px", width: 1280, height: 950 },
  ];

  console.log("Capturing screenshots at 375px and 1280px for URL-only delivery...");

  for (const screen of screens) {
    const fullHtml = buildHtmlPage(screen.name, screen.html);
    const htmlFilePath = path.join(HTML_DIR, `${screen.id}.html`);
    fs.writeFileSync(htmlFilePath, fullHtml, "utf8");

    for (const vp of viewports) {
      const outPng = path.join(SCREENSHOT_DIR, `${screen.id}_${vp.name}.png`);
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

      const artifactPng = path.join(ARTIFACT_DIR, `${screen.id}_${vp.name}.png`);
      fs.copyFileSync(outPng, artifactPng);
      console.log(`  ✓ Captured ${screen.id}_${vp.name}.png`);
    }
  }

  console.log("\nAll requested screenshots successfully captured!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
