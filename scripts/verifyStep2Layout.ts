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

const photoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141E30" />
      <stop offset="60%" stop-color="#243B55" />
      <stop offset="100%" stop-color="#0B1320" />
    </linearGradient>
    <radialGradient id="r" cx="70%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#FFD194" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)" />
  <rect width="100%" height="100%" fill="url(#r)" />
</svg>
`)}`;

const mockReport: VerificationReport = {
  articleTitle: "Woman Objects To 'Bad Touch', Pushed Off Mumbai Local Train, Loses Arm",
  sourceDomain: "ndtv.com",
  articleUrl: "https://www.ndtv.com/mumbai-news/woman-objects-to-bad-touch-pushed-off-mumbai-local-train-loses-arm-6948529",
  sourceReadStatus: "unreadable",
  sourceReadNote: "We couldn't read the original article, so this check is based on independent reporting of the same story.",
  featuredImage: photoDataUri,
  backgroundImage: {
    url: photoDataUri,
    sourceType: "evidence",
    credit: "thehindu.com",
    luminance: 0.30,
  },
  author: "Mumbai News Desk",
  publishedAt: "Nov 5, 2026",
  overallTrustScore: 88,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "An altercation inside a Mumbai local train compartment near Naigaon railway station resulted in a 20-year-old passenger being pushed off the train, corroborated by national and municipal railway police accounts.",
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
      explanation: "Corroborated by official railway police FIR filings and eyewitness statements.",
      evidenceIds: ["ev-hindu-1", "ev-express-1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 88,
    contextPenalty: 0,
    confidenceAdjustment: 0,
    finalScore: 88,
  },
  crossSourceComparison: {
    originalPublisher: "thehindu.com",
    totalPublicationsExamined: 3,
    independentSourcesCount: 3,
    syndicatedSourcesCount: 0,
    wireAgenciesDetected: ["PTI"],
    publications: [
      {
        domain: "thehindu.com",
        title: "Woman pushed off local train after resisting harassment near Naigaon",
        sourceType: "national_news",
        relationship: "original",
        isIndependent: true,
        isWireSyndicated: false,
      },
      {
        domain: "indianexpress.com",
        title: "Mumbai local train attack: Accused arrested after woman loses arm",
        sourceType: "national_news",
        relationship: "independent",
        isIndependent: true,
        isWireSyndicated: false,
      },
      {
        domain: "mumbaimirror.indiatimes.com",
        title: "Railway police arrest 53-year-old commuter in train assault case",
        sourceType: "regional_news",
        relationship: "independent",
        isIndependent: true,
        isWireSyndicated: false,
      },
    ],
    claimsCompared: [],
    claimsAgreedCount: 3,
    claimsConflictingCount: 0,
    claimsUnresolvedCount: 0,
    hasNumericalConflict: false,
    hasDirectQuoteConflict: false,
    summary: "Consistent reporting across accredited publications on suspect arrest and incident sequence.",
  },
};

const mockEvidence: Evidence[] = [
  {
    id: "ev-hindu-1",
    claimId: "c1",
    domain: "thehindu.com",
    url: "https://www.thehindu.com/news/cities/mumbai/woman-pushed-local-train/article6948.ece",
    title: "Woman pushed off local train after resisting harassment near Naigaon",
    snippet: "Railway police arrested a 53-year-old commuter after woman was pushed near Naigaon.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "national_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2026-11-05T08:30:00Z",
  },
  {
    id: "ev-express-1",
    claimId: "c1",
    domain: "indianexpress.com",
    url: "https://indianexpress.com/article/cities/mumbai/local-train-attack-naigaon-965412/",
    title: "Mumbai local train attack: Accused arrested after woman loses arm",
    snippet: "Police confirm suspect charged with attempted murder following suburban railway incident.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "national_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2026-11-05T11:15:00Z",
  },
  {
    id: "ev-mirror-1",
    claimId: "c1",
    domain: "mumbaimirror.indiatimes.com",
    url: "https://mumbaimirror.indiatimes.com/mumbai/crime/accused-remanded-railway-court/7821.cms",
    title: "Railway police arrest 53-year-old commuter in train assault case",
    snippet: "CCTV footage and passenger statements corroborate confrontation.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "regional_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2026-11-06T09:00:00Z",
  },
];

function buildHtmlPage(title: string, componentMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FakeNewzz</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '#0B0F17',
            surface: '#111923',
            'surface-secondary': '#171E29',
            verified: '#10B981',
            context: '#F59E0B',
            contradicted: '#EF4444',
            neutral: '#64748B',
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            editorial: ['Newsreader', 'Georgia', 'serif'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #0B0F17;
      color: #F5F5F5;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    .font-editorial {
      font-family: 'Newsreader', Georgia, serif;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body class="bg-[#0B0F17] text-[#F5F5F5] min-h-screen">
  ${componentMarkup}
</body>
</html>`;
}

async function run() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = path.resolve("scratch/chrome-profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const widths = [375, 768, 1024, 1280, 1920];

  const markup = renderToStaticMarkup(
    React.createElement(FinalVerificationDashboard, {
      report: mockReport,
      evidence: mockEvidence,
      onReset: () => {},
    })
  );

  const fullHtml = buildHtmlPage("Step 2 Layout Verification", markup);
  const htmlFilePath = path.join(HTML_DIR, "step2_layout_verification.html");
  fs.writeFileSync(htmlFilePath, fullHtml, "utf8");

  console.log("Verifying Step 2 Hero layout across all 5 widths: 375, 768, 1024, 1280, 1920px...");

  for (const w of widths) {
    const filename = `step2_hero_${w}px.png`;
    const outPath = path.join(SCREENSHOT_DIR, filename);

    execFileSync(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      `--window-size=${w},1200`,
      `--screenshot=${outPath}`,
      `file:///${htmlFilePath.replace(/\\/g, "/")}`,
    ]);

    fs.copyFileSync(outPath, path.join(ARTIFACT_DIR, filename));
    console.log(`✓ Captured ${filename} (${w}px)`);
  }

  console.log("\nAll 5 layout width screenshots successfully captured!");
}

run().catch((err) => {
  console.error("Verification capture failed:", err);
  process.exit(1);
});

