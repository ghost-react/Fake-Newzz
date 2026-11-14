import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsDashboard } from "../src/components/verification/ResultsDashboard";
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

// ─── SCENARIO 1: Highly Trustworthy ─────────────────────────────────────────
const scenario1Report: VerificationReport = {
  articleTitle: "JWST Confirms Atmospheric Carbon Dioxide on Exoplanet K2-18b",
  sourceDomain: "astronomyherald.org",
  articleUrl: "https://astronomyherald.org/news/jwst-k2-18b-atmosphere",
  featuredImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600",
  author: "Dr. Sarah Chen, Astrophysics Correspondent",
  publishedAt: "2026-05-12T14:30:00Z",
  overallTrustScore: 95,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary:
    "Strong evidence from NASA, ESA, and international peer-reviewed spectroscopic analyses corroborates the detection of carbon dioxide and methane in the atmosphere of exoplanet K2-18b. Multiple independent research groups confirm the observational data.",
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
      explanation: "Independent spectroscopic absorption profiles published by NASA and STScI directly verify carbon dioxide spectral lines.",
      evidenceIds: ["ev-jwst-1", "ev-jwst-2"],
      importantNotes: [],
      layer: "event_occurred",
    },
    {
      claimId: "c2",
      verdict: "supporting",
      confidence: "high",
      explanation: "Official press conference transcript verifies Dr. Chen and research leads announced findings at the American Astronomical Society.",
      evidenceIds: ["ev-jwst-3"],
      importantNotes: [],
      layer: "statement_made",
    },
    {
      claimId: "c3",
      verdict: "supporting",
      confidence: "high",
      explanation: "Published atmospheric density figures match theoretical models within 1.2% uncertainty margins.",
      evidenceIds: ["ev-jwst-1"],
      importantNotes: [],
      layer: "underlying_fact",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 95,
    contextPenalty: 0,
    confidenceAdjustment: 0,
    finalScore: 95,
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
              { clusterId: "nasa-gov", evidenceId: "ev-jwst-1", value: "NASA STScI confirms CO2 spectral signatures in NIRSpec data", quote: "spectroscopic evidence confirms atmospheric carbon dioxide" },
              { clusterId: "nature-astronomy", evidenceId: "ev-jwst-2", value: "Peer-reviewed paper reports 4.2-sigma detection", quote: "statistically significant absorption features" },
            ],
          },
        ],
      },
    ],
  },
};

const scenario1Claims: ClaimInput[] = [
  { id: "c1", text: "JWST detected carbon dioxide in the atmosphere of K2-18b", importance: "high", claimType: "event", layer: "event_occurred" },
  { id: "c2", text: "Lead researchers formally announced findings at the AAS symposium", importance: "medium", claimType: "statement", layer: "statement_made" },
  { id: "c3", text: "Atmospheric density measurements align with hydrogen-rich sub-Neptune models", importance: "medium", claimType: "factual", layer: "underlying_fact" },
];

const scenario1Evidence: Evidence[] = [
  {
    id: "ev-jwst-1",
    claimId: "c1",
    title: "NASA Space Telescope Science Institute Observation Release",
    url: "https://stsci.edu/jwst/news/k2-18b-atmosphere",
    domain: "stsci.edu",
    snippet: "Spectroscopic data collected by the James Webb Space Telescope reveals definitive absorption lines for carbon dioxide in K2-18b.",
    publishedAt: "2026-05-12",
    relationship: "supporting",
    sourceRelationship: "independent",
    sourceType: "official",
    evidenceQuality: "high",
    relevance: "direct",
  },
  {
    id: "ev-jwst-2",
    claimId: "c1",
    title: "Nature Astronomy: Transmission Spectra of Sub-Neptune Exoplanet",
    url: "https://nature.com/articles/natastron-2026-11",
    domain: "nature.com",
    snippet: "Cross-dispersion NIRSpec analysis establishes 4.2-sigma confidence for carbon dioxide and methane atmospheric abundance.",
    publishedAt: "2026-05-13",
    relationship: "supporting",
    sourceRelationship: "independent",
    sourceType: "research",
    evidenceQuality: "high",
    relevance: "direct",
  },
];

// ─── SCENARIO 2: Unable to Verify ───────────────────────────────────────────
const scenario2Report: VerificationReport = {
  articleTitle: "Breaking: Strategic Maritime Strait Reportedly Closed Following Alleged Subsea Pipeline Incident",
  sourceDomain: "breakingmaritime.net",
  articleUrl: "https://breakingmaritime.net/news/strait-closure-allegation",
  featuredImage: null, // Tests typographic fallback
  author: "Anonymous Staff Wire",
  publishedAt: "2026-11-08T08:15:00Z",
  overallTrustScore: 48,
  veracityVerdict: "unverified",
  confidence: "low",
  summary:
    "Available independent evidence is currently insufficient to determine whether the reported maritime transit closure has occurred. No official naval notice to mariners or satellite vessel tracking corroboration is available yet.",
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
      explanation: "Naval authorities and coast guard advisories contain no records or notices of strait closure.",
      evidenceIds: [],
      importantNotes: ["Single uncorroborated social claim"],
      layer: "event_occurred",
    },
    {
      claimId: "c2",
      verdict: "insufficient",
      confidence: "low",
      explanation: "Port operator press offices have not issued emergency closure statements.",
      evidenceIds: [],
      importantNotes: [],
      layer: "statement_made",
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
    totalIndependentClusters: 1,
    totalConflicts: 0,
    totalUnresolvedDimensions: 2,
    coverageLimited: true,
    claims: [
      {
        claimId: "c1",
        independentClusterCount: 1,
        agreementSummary: "none",
        conflicts: [],
        dimensions: [
          {
            dimension: "event",
            outcome: "unresolved",
            articleValue: "Strategic strait closed indefinitely",
            sourceValues: [],
            note: "No independent reports found verifying event occurrence",
          },
        ],
      },
    ],
  },
};

const scenario2Claims: ClaimInput[] = [
  { id: "c1", text: "Strategic maritime strait closed indefinitely following rupture", importance: "high", claimType: "event", layer: "event_occurred" },
  { id: "c2", text: "Port authority issued emergency navigation halt", importance: "medium", claimType: "statement", layer: "statement_made" },
];

// ─── SCENARIO 3: Mixed Evidence with Conflict ───────────────────────────────
const scenario3Report: VerificationReport = {
  articleTitle: "Ministry Imposes 25% Blanket Luxury Surcharge Amid Conflicting Revenue Estimates",
  sourceDomain: "financialtimes.today",
  articleUrl: "https://financialtimes.today/tax-surcharge-conflict",
  featuredImage: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=600",
  author: "Robert Evans",
  publishedAt: "2026-10-20T11:00:00Z",
  overallTrustScore: 52,
  veracityVerdict: "mixed",
  confidence: "medium",
  summary:
    "The core event of a parliamentary luxury tax proposal is corroborated, but the reported 25% blanket rate is directly contradicted by official gazettes showing a 12-18% graduated scale. Independent outlets report conflicting implementation dates.",
  claimSummary: {
    total: 3,
    supporting: 1,
    contradicting: 1,
    qualifying: 1,
    insufficient: 0,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Parliamentary bulletin confirms draft tax bill introduced.",
      evidenceIds: ["ev-fin-1"],
      importantNotes: [],
      layer: "event_occurred",
    },
    {
      claimId: "c2",
      verdict: "contradicting",
      confidence: "high",
      explanation: "Official revenue gazette explicitly specifies graduated 12% to 18% rates, directly refuting the 25% blanket claim.",
      evidenceIds: ["ev-fin-2"],
      importantNotes: ["Direct numerical conflict"],
      layer: "underlying_fact",
    },
    {
      claimId: "c3",
      verdict: "qualifying",
      confidence: "medium",
      explanation: "Effective date requires royal assent and does not apply retroactively as implied.",
      evidenceIds: ["ev-fin-3"],
      importantNotes: [],
      layer: "statement_made",
    },
  ],
  omittedContext: [
    {
      id: "om-1",
      claimId: "c2",
      type: "missing_context",
      severity: "high",
      description: "Article omits standard exemptions for domestic assemblers and hybrid powertrains.",
      whyItMatters: "Distorts impact on everyday vehicle buyers by failing to note that 70% of models are exempt.",
      evidenceIds: ["ev-fin-2"],
      confidence: "high",
    },
  ],
  scoreBreakdown: {
    claimScore: 65,
    contextPenalty: 10,
    confidenceAdjustment: -3,
    finalScore: 52,
  },
  comparison: {
    totalIndependentClusters: 3,
    totalConflicts: 2,
    totalUnresolvedDimensions: 1,
    coverageLimited: false,
    claims: [
      {
        claimId: "c2",
        independentClusterCount: 3,
        agreementSummary: "weak",
        conflicts: [
          {
            dimension: "numbers",
            description: "Article states 25% blanket tax; official gazette shows tiered 12-18% rates.",
            evidenceIds: ["ev-fin-2"],
          },
        ],
        dimensions: [
          {
            dimension: "numbers",
            outcome: "contradiction",
            articleValue: "25% blanket surcharge",
            sourceValues: [
              { clusterId: "revenue-gazette", evidenceId: "ev-fin-2", value: "Tiered 12% to 18% graduated duty", quote: "surcharge shall not exceed 18 percent for category A" },
            ],
          },
          {
            dimension: "date",
            outcome: "partial_agreement",
            articleValue: "Effective immediately",
            sourceValues: [
              { clusterId: "business-standard", evidenceId: "ev-fin-3", value: "Effective next fiscal quarter following gazette notification", quote: "applicable starting April first next fiscal" },
            ],
            note: "Details changed between reports (possible_update)",
          },
        ],
      },
    ],
  },
};

const scenario3Claims: ClaimInput[] = [
  { id: "c1", text: "Finance ministry introduced draft luxury vehicle surcharge", importance: "high", claimType: "event", layer: "event_occurred" },
  { id: "c2", text: "Imposes 25% blanket surcharge on all imported luxury vehicles", importance: "high", claimType: "factual", layer: "underlying_fact" },
  { id: "c3", text: "Minister stated surcharge takes effect immediately", importance: "medium", claimType: "statement", layer: "statement_made" },
];

const scenario3Evidence: Evidence[] = [
  {
    id: "ev-fin-1",
    claimId: "c1",
    title: "Parliamentary Hansard Records: Bill 104 Introduction",
    url: "https://parliament.gov.in/bills/104",
    domain: "parliament.gov.in",
    snippet: "Finance Minister introduces Bill 104 regarding luxury consumption tariffs.",
    publishedAt: "2026-10-19",
    relationship: "supporting",
    sourceRelationship: "original",
    sourceType: "primary_document",
    evidenceQuality: "high",
    relevance: "direct",
  },
  {
    id: "ev-fin-2",
    claimId: "c2",
    title: "Official Gazette Extraordinary: Notification on Motor Duties",
    url: "https://egazette.gov.in/tariffs-2026",
    domain: "egazette.gov.in",
    snippet: "Schedule II duty structure establishes 12% for Tier 1 and maximum 18% for Tier 2 vehicles.",
    publishedAt: "2026-10-20",
    relationship: "contradicting",
    sourceRelationship: "independent",
    sourceType: "primary_document",
    evidenceQuality: "high",
    relevance: "direct",
  },
];

// ─── SCENARIO 4: Syndicated Story ───────────────────────────────────────────
const scenario4Report: VerificationReport = {
  articleTitle: "Supreme Court Directs Aviation Ministry to Review Airline Surge Pricing",
  sourceDomain: "thehindu.com",
  articleUrl: "https://thehindu.com/news/national/sc-airline-fares-directive",
  featuredImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=600",
  author: "PTI Syndicated Feed",
  publishedAt: "2026-05-02T10:00:00Z",
  overallTrustScore: 88,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "The Supreme Court directive asking civil aviation authorities to examine festive season airfare spikes is confirmed by court proceedings; however, widespread coverage traces back to a single wire dispatch by Press Trust of India (PTI).",
  claimSummary: {
    total: 2,
    supporting: 2,
    contradicting: 0,
    qualifying: 0,
    insufficient: 0,
  },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Court order sheet confirms division bench directed ministry to review dynamic pricing within six weeks.",
      evidenceIds: ["ev-pti-1", "ev-pti-2", "ev-pti-3"],
      importantNotes: ["Multiple outlets republishing single PTI dispatch"],
      layer: "event_occurred",
    },
    {
      claimId: "c2",
      verdict: "supporting",
      confidence: "high",
      explanation: "Chief Justice oral observation during hearing noted public hardship.",
      evidenceIds: ["ev-pti-1"],
      importantNotes: [],
      layer: "statement_made",
    },
  ],
  omittedContext: [],
  scoreBreakdown: {
    claimScore: 88,
    contextPenalty: 0,
    confidenceAdjustment: 0,
    finalScore: 88,
  },
  comparison: {
    totalIndependentClusters: 1, // Syndicated wire counts as ONE
    totalConflicts: 0,
    totalUnresolvedDimensions: 0,
    coverageLimited: false,
    claims: [
      {
        claimId: "c1",
        independentClusterCount: 1,
        agreementSummary: "moderate",
        conflicts: [],
        dimensions: [
          {
            dimension: "event",
            outcome: "agreement",
            articleValue: "SC directs aviation ministry review",
            sourceValues: [
              { clusterId: "pti-wire", evidenceId: "ev-pti-1", value: "PTI wire: Bench issued notice returnable in six weeks", quote: "ministry instructed to review festive dynamic pricing" },
            ],
          },
        ],
      },
    ],
  },
  crossSourceComparison: {
    originalPublisher: "Press Trust of India (PTI)",
    totalPublicationsExamined: 5,
    independentSourcesCount: 1,
    syndicatedSourcesCount: 4,
    wireAgenciesDetected: ["PTI"],
    publications: [],
    claimsCompared: [],
    claimsAgreedCount: 1,
    claimsConflictingCount: 0,
    claimsUnresolvedCount: 0,
    hasNumericalConflict: false,
    hasDirectQuoteConflict: false,
    summary: "Reported by PTI, republished by 4 national outlets",
  },
};

const scenario4Claims: ClaimInput[] = [
  { id: "c1", text: "Supreme Court directed ministry to examine airline surge pricing", importance: "high", claimType: "event", layer: "event_occurred" },
  { id: "c2", text: "Bench stated festive season airfares impose undue burden", importance: "medium", claimType: "statement", layer: "statement_made" },
];

const scenario4Evidence: Evidence[] = [
  {
    id: "ev-pti-1",
    claimId: "c1",
    title: "Apex Court asks aviation ministry to examine airfares: PTI",
    url: "https://ndtv.com/sc-airfare-pti",
    domain: "ndtv.com",
    snippet: "Press Trust of India reported that the Supreme Court division bench sought ministry response.",
    publishedAt: "2026-05-02",
    relationship: "supporting",
    sourceRelationship: "syndicated",
    sourceType: "national_news",
    evidenceQuality: "high",
    relevance: "direct",
  },
  {
    id: "ev-pti-2",
    claimId: "c1",
    title: "Airfare Surge Pricing under Supreme Court Lens",
    url: "https://business-standard.com/sc-airfares",
    domain: "business-standard.com",
    snippet: "PTI: High airfares during festive travel prompted apex court to seek government views.",
    publishedAt: "2026-05-02",
    relationship: "supporting",
    sourceRelationship: "syndicated",
    sourceType: "national_news",
    evidenceQuality: "high",
    relevance: "direct",
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
    }
    .font-editorial {
      font-family: 'Newsreader', Georgia, serif;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body class="bg-[#0B0F17] text-[#F5F5F5] min-h-screen py-8">
  <div class="max-w-5xl mx-auto">
    ${componentMarkup}
  </div>
</body>
</html>`;
}

async function run() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = path.resolve("scratch/chrome-profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const scenarios = [
    {
      id: "state1_highly_trustworthy",
      name: "1. Highly Trustworthy",
      report: scenario1Report,
      claims: scenario1Claims,
      evidence: scenario1Evidence,
    },
    {
      id: "state2_unable_to_verify",
      name: "2. Unable to Verify",
      report: scenario2Report,
      claims: scenario2Claims,
      evidence: [],
    },
    {
      id: "state3_mixed_evidence",
      name: "3. Mixed Evidence with Conflict",
      report: scenario3Report,
      claims: scenario3Claims,
      evidence: scenario3Evidence,
    },
    {
      id: "state4_syndicated_story",
      name: "4. Syndicated Story",
      report: scenario4Report,
      claims: scenario4Claims,
      evidence: scenario4Evidence,
    },
  ];

  console.log("Generating HTML pages and capturing screenshots with Chrome...");

  for (const s of scenarios) {
    const markup = renderToStaticMarkup(
      React.createElement(ResultsDashboard, {
        report: s.report,
        claims: s.claims,
        evidence: s.evidence,
      })
    );

    const fullHtml = buildHtmlPage(s.name, markup);
    const htmlFilePath = path.join(HTML_DIR, `${s.id}.html`);
    fs.writeFileSync(htmlFilePath, fullHtml, "utf8");

    // Capture at 375px (mobile)
    const outMobile = path.join(SCREENSHOT_DIR, `${s.id}_375px.png`);
    execFileSync(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      "--window-size=375,1300",
      `--screenshot=${outMobile}`,
      `file:///${htmlFilePath.replace(/\\/g, "/")}`,
    ]);

    // Capture at 1280px (desktop)
    const outDesktop = path.join(SCREENSHOT_DIR, `${s.id}_1280px.png`);
    execFileSync(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,1300",
      `--screenshot=${outDesktop}`,
      `file:///${htmlFilePath.replace(/\\/g, "/")}`,
    ]);

    console.log(`Captured: ${s.id} (375px & 1280px)`);
  }

  console.log("All screenshots successfully captured in:", SCREENSHOT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
