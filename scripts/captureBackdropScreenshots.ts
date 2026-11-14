import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinalVerificationDashboard } from "../src/components/verification/FinalVerificationDashboard";
import { VerificationReport } from "../src/schemas/verification";
import {
  DEFAULT_BACKDROP_CONFIG,
  getEffectiveBackdropConfig,
} from "../src/lib/ui/backdropConfig";

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

// ── Realistic Inline High-Resolution Data URIs for Headless Chrome ───────────

// 1. Newsroom / Government Press Briefing (1280x720, 16:9, Normal Newsroom)
const normalNewsPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141E30" />
      <stop offset="50%" stop-color="#243B55" />
      <stop offset="100%" stop-color="#0B1320" />
    </linearGradient>
    <radialGradient id="spotLight" cx="60%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#FFD194" stop-opacity="0.45" />
      <stop offset="60%" stop-color="#70A1FF" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)" />
  <rect width="100%" height="100%" fill="url(#spotLight)" />
  <path d="M 680 220 L 730 220 L 750 680 L 660 680 Z" fill="#1B263B" opacity="0.85" />
  <path d="M 850 200 L 910 200 L 940 680 L 820 680 Z" fill="#1B263B" opacity="0.7" />
  <ellipse cx="780" cy="420" rx="140" ry="220" fill="#2E4057" opacity="0.6" />
  <circle cx="780" cy="280" r="65" fill="#FFEAA7" opacity="0.8" />
  <path d="M 720 540 L 760 480 M 740 550 L 780 475 M 820 550 L 795 478" stroke="#A4B0BE" stroke-width="4" />
</svg>
`)}`;

// 2. Related Report Press Wire Image (1280x720, Wire Agency Coverage)
const wirePhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="wireGrad" x1="0%" y1="0%" x2="100%" y2="80%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="50%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <radialGradient id="stageWarm" cx="65%" cy="35%" r="45%">
      <stop offset="0%" stop-color="#FDE047" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#38BDF8" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#wireGrad)" />
  <rect width="100%" height="100%" fill="url(#stageWarm)" />
  <rect x="620" y="260" width="340" height="460" rx="8" fill="#1E293B" opacity="0.8" />
  <circle cx="790" cy="240" r="55" fill="#FED7AA" opacity="0.85" />
  <path d="M 740 340 L 840 340 L 860 680 L 720 680 Z" fill="#0F172A" opacity="0.9" />
  <line x1="790" y1="360" x2="790" y2="480" stroke="#E2E8F0" stroke-width="3" />
</svg>
`)}`;

// 3. Sports Stadium Floodlights (1280x720, Cricket / Stadium Claim)
const sportsPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="stadiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="45%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
    <radialGradient id="floodLights" cx="70%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.5" />
      <stop offset="70%" stop-color="#0F172A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#stadiumGrad)" />
  <rect width="100%" height="100%" fill="url(#floodLights)" />
  <circle cx="950" cy="180" r="8" fill="#F0F9FF" />
  <circle cx="975" cy="185" r="8" fill="#F0F9FF" />
  <circle cx="1000" cy="190" r="8" fill="#F0F9FF" />
  <path d="M 700 720 Q 820 400 950 720" fill="#1E3A8A" opacity="0.7" />
</svg>
`)}`;

// 4. Portrait Orientation Image (800x1067, 3:4 Aspect Ratio, object-position center 30%)
const portraitPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1067" viewBox="0 0 800 1067">
  <defs>
    <linearGradient id="portraitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="50%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <radialGradient id="faceGlow" cx="50%" cy="30%" r="35%">
      <stop offset="0%" stop-color="#FED7AA" stop-opacity="0.9" />
      <stop offset="60%" stop-color="#F97316" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#portraitGrad)" />
  <circle cx="400" cy="320" r="130" fill="url(#faceGlow)" />
  <path d="M 280 460 Q 400 440 520 460 L 590 1067 L 210 1067 Z" fill="#0B132B" opacity="0.9" />
  <rect x="350" y="650" width="100" height="417" fill="#1C2541" />
  <line x1="400" y1="520" x2="400" y2="700" stroke="#38BDF8" stroke-width="3" />
</svg>
`)}`;

// 5. High-Key Sunlit Snow & Ice Scene (1280x720, Bright Image Case, Luminance ~0.82)
const brightPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="snowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="40%" stop-color="#F1F5F9" />
      <stop offset="80%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="75%" cy="20%" r="40%">
      <stop offset="0%" stop-color="#FFFBEB" stop-opacity="1" />
      <stop offset="50%" stop-color="#FEF3C7" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#snowGrad)" />
  <rect width="100%" height="100%" fill="url(#sunGlow)" />
  <polygon points="500,720 720,240 920,720" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2" />
  <polygon points="680,720 860,180 1080,720" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
  <polygon points="850,220 920,340 820,350" fill="#38BDF8" opacity="0.3" />
</svg>
`)}`;

// 6. Deep Dark Night / Midnight Parliament Scene (1280x720, Luminance ~0.10)
const darkNightPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="nightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="60%" stop-color="#0B0F19" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#nightGrad)" />
  <!-- Distant parliament silhouette with faint warm candlelit windows -->
  <rect x="520" y="340" width="560" height="380" fill="#050B14" />
  <polygon points="800,220 700,340 900,340" fill="#070E1A" />
  <!-- Small lit windows -->
  <rect x="620" y="400" width="24" height="40" fill="#FBBF24" opacity="0.65" />
  <rect x="680" y="400" width="24" height="40" fill="#FBBF24" opacity="0.45" />
  <rect x="740" y="400" width="24" height="40" fill="#FBBF24" opacity="0.75" />
  <rect x="840" y="400" width="24" height="40" fill="#FBBF24" opacity="0.55" />
  <rect x="900" y="400" width="24" height="40" fill="#FBBF24" opacity="0.6" />
</svg>
`)}`;

// 7. Very Wide Panoramic Assembly Hall Scene (1800x600, 3:1 Aspect Ratio)
const panoramaPhotoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="600" viewBox="0 0 1800 600">
  <defs>
    <linearGradient id="panoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0B1329" />
      <stop offset="30%" stop-color="#1C2541" />
      <stop offset="70%" stop-color="#2D3748" />
      <stop offset="100%" stop-color="#0B1329" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#panoGrad)" />
  <!-- Panoramic semi-circular delegation seating and EU flags -->
  <path d="M 200 600 Q 900 280 1600 600" fill="none" stroke="#4A5568" stroke-width="60" opacity="0.6" />
  <path d="M 300 600 Q 900 360 1500 600" fill="none" stroke="#2B6CB0" stroke-width="40" opacity="0.7" />
  <!-- Flags across top gallery -->
  <circle cx="850" cy="220" r="18" fill="#F6E05E" />
  <circle cx="950" cy="220" r="18" fill="#F6E05E" />
</svg>
`)}`;

// ── Shared Realistic Mock Comparison Data ─────────────────────────────────────
const baseComparison = {
  originalPublisher: "reuters.com",
  totalPublicationsExamined: 3,
  independentSourcesCount: 3,
  syndicatedSourcesCount: 0,
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
      title: "Cabinet backs Caivano youth crime package",
      sourceType: "national_news",
      relationship: "independent",
      isIndependent: true,
      isWireSyndicated: false,
    },
    {
      domain: "ilpost.it",
      title: "What is actually inside the new government security decree",
      sourceType: "national_news",
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
  summary: "Complete corroboration across Italian legal and national publications.",
};

// ── 10 REQUIRED SCENARIOS ────────────────────────────────────────────────────

// 1. Normal news URL
const report1_normal_news: VerificationReport = {
  articleTitle: "Italy's Meloni Toughens Protest Laws and Extends Juvenile Penalties",
  sourceDomain: "reuters.com",
  articleUrl: "https://www.reuters.com/world/europe/italy-youth-crime-decree-2023-09-07/",
  featuredImage: normalNewsPhotoDataUri,
  backgroundImage: {
    url: normalNewsPhotoDataUri,
    sourceType: "article",
    credit: "reuters.com",
    luminance: 0.32,
  },
  author: "Angelo Amante",
  publishedAt: "Sept 7, 2023",
  overallTrustScore: 92,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "Italian Cabinet decree approving harsher penalties for juvenile carrying of weapons and street protests is corroborated by official gazettes, government briefings, and Italian legal wire reports.",
  claimSummary: { total: 3, supporting: 3, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Corroborated by official gazette text and Reuters Rome bureau reporting.",
      evidenceIds: ["ev1", "ev2"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 92, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 92 },
  crossSourceComparison: baseComparison,
};

// 2. Blocked-publisher URL
const report2_blocked_publisher: VerificationReport = {
  articleTitle: "Cabinet Passes Tough New Security and Juvenile Measures in Caivano Decree",
  sourceDomain: "corriere.it",
  articleUrl: "https://www.corriere.it/politica/23_settembre_07/decreto-caivano-giovani.shtml",
  sourceReadStatus: "unreadable",
  featuredImage: null,
  backgroundImage: {
    url: wirePhotoDataUri,
    sourceType: "evidence",
    credit: "ansa.it",
    luminance: 0.35,
  },
  author: null,
  publishedAt: "Sept 8, 2023",
  overallTrustScore: 90,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "We couldn't read the original article, so this check is based on independent reporting of the same story. Italian decree verified across multiple accredited European wire services.",
  claimSummary: { total: 3, supporting: 3, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Corroborated by independent reports from ANSA and Reuters.",
      evidenceIds: ["ev1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 90, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 90 },
  crossSourceComparison: baseComparison,
};

// 3. Headline input
const report3_headline_input: VerificationReport = {
  articleTitle: "Italy's Meloni Toughens Protest Laws, Teen Detentions, 5-Year Jail Term",
  sourceDomain: "Headline Input",
  articleUrl: null,
  featuredImage: null,
  backgroundImage: {
    url: normalNewsPhotoDataUri,
    sourceType: "evidence",
    credit: "reuters.com",
    luminance: 0.32,
  },
  author: null,
  publishedAt: null,
  overallTrustScore: 88,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "Cabinet decree details matched across independent news outlets; provisions set lower thresholds for juvenile custody and stricter sanctions for blocking transport arteries.",
  claimSummary: { total: 2, supporting: 2, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Corroborated by Reuters and ANSA dispatches.",
      evidenceIds: ["ev1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 88, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 88 },
  crossSourceComparison: baseComparison,
};

// 4. Short claim input
const report4_short_claim: VerificationReport = {
  articleTitle: "Hardik Pandya Will Join Punjab Kings in IPL 2027",
  sourceDomain: "Claim Input",
  articleUrl: null,
  featuredImage: null,
  backgroundImage: {
    url: sportsPhotoDataUri,
    sourceType: "evidence",
    credit: "espncricinfo.com",
    luminance: 0.28,
  },
  author: null,
  publishedAt: null,
  overallTrustScore: 32,
  veracityVerdict: "misleading",
  confidence: "high",
  summary:
    "No official franchise announcements or BCCI filings confirm any trade agreement for the 2027 season. Mumbai Indians leadership and sports analysts characterize claims as speculative rumor.",
  claimSummary: { total: 2, supporting: 0, contradicting: 2, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "contradicting",
      confidence: "high",
      explanation: "Franchise retention contracts run through 2026 auction cycle; no trade discussions confirmed.",
      evidenceIds: ["ev-cric-1"],
      importantNotes: [],
      layer: "underlying_fact",
      certainty: "speculation",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 35, contextPenalty: 3, confidenceAdjustment: 0, finalScore: 32 },
  crossSourceComparison: {
    originalPublisher: "Independent Claim",
    totalPublicationsExamined: 2,
    independentSourcesCount: 2,
    syndicatedSourcesCount: 0,
    wireAgenciesDetected: [],
    publications: [
      {
        domain: "espncricinfo.com",
        title: "IPL franchise retention dynamics for upcoming cycles",
        sourceType: "specialized_trade",
        relationship: "independent",
        isIndependent: true,
        isWireSyndicated: false,
      },
      {
        domain: "cricbuzz.com",
        title: "BCCI clarifies trading window dates",
        sourceType: "specialized_trade",
        relationship: "independent",
        isIndependent: true,
        isWireSyndicated: false,
      },
    ],
    claimsCompared: [],
    claimsAgreedCount: 0,
    claimsConflictingCount: 2,
    claimsUnresolvedCount: 0,
    hasNumericalConflict: false,
    hasDirectQuoteConflict: false,
    summary: "Mainstream cricket desks contradict unverified transfer rumors.",
  },
};

// 5. Pasted multi-paragraph text
const report5_pasted_text: VerificationReport = {
  articleTitle: "Rome Approves Sweeping Youth Decree with Tougher Penalties for Protest Roadblocks",
  sourceDomain: "Pasted Text",
  articleUrl: null,
  featuredImage: null,
  backgroundImage: {
    url: wirePhotoDataUri,
    sourceType: "evidence",
    credit: "ilpost.it",
    luminance: 0.35,
  },
  author: null,
  publishedAt: null,
  overallTrustScore: 85,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "Pasted news excerpt describing Italian cabinet decree on juvenile crime is verified against Italian legislative records and accredited daily coverage.",
  claimSummary: { total: 3, supporting: 3, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Corroborated by independent Italian press coverage.",
      evidenceIds: ["ev1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 85, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 85 },
  crossSourceComparison: baseComparison,
};

// 6. Article with no og:image (gradient fallback)
const report6_no_image_fallback: VerificationReport = {
  articleTitle: "Supreme Court Issues Regulatory Notice on High Dynamic Airfares",
  sourceDomain: "timesofindia.indiatimes.com",
  articleUrl: "https://timesofindia.indiatimes.com/india/sc-dynamic-airfares/108345.cms",
  featuredImage: null,
  backgroundImage: undefined,
  author: "Legal Bureau",
  publishedAt: "May 2, 2026",
  overallTrustScore: 78,
  veracityVerdict: "mostly_true",
  confidence: "medium",
  summary:
    "The Supreme Court of India heard petitions regarding airline pricing volatility and requested input from civil aviation authorities regarding consumer transparency.",
  claimSummary: { total: 2, supporting: 2, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Confirmed by official Supreme Court cause list and legal portal reporting.",
      evidenceIds: ["ev-legal-1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 80, contextPenalty: 2, confidenceAdjustment: 0, finalScore: 78 },
  crossSourceComparison: {
    originalPublisher: "timesofindia.indiatimes.com",
    totalPublicationsExamined: 2,
    independentSourcesCount: 2,
    syndicatedSourcesCount: 0,
    wireAgenciesDetected: ["PTI"],
    publications: [
      {
        domain: "barandbench.com",
        title: "Supreme Court notice on airline pricing petition",
        sourceType: "legal_database",
        relationship: "independent",
        isIndependent: true,
        isWireSyndicated: false,
      },
      {
        domain: "livelaw.in",
        title: "Plea challenging surging festive airfares admitted",
        sourceType: "legal_database",
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
    summary: "Judicial order corroborated by multiple accredited legal observers.",
  },
};

// 7. Article with portrait-orientation image (3:4 ratio, object-position center 30%)
const report7_portrait_image: VerificationReport = {
  articleTitle: "Prime Minister Addresses Chamber of Deputies on Public Safety Decree",
  sourceDomain: "ansa.it",
  articleUrl: "https://www.ansa.it/sito/notizie/politica/2023/09/07/meloni-aula-decreto_829.html",
  featuredImage: portraitPhotoDataUri,
  backgroundImage: {
    url: portraitPhotoDataUri,
    sourceType: "article",
    credit: "ansa.it / ANSA Archive",
    luminance: 0.30,
  },
  author: "Rome Political Desk",
  publishedAt: "Sept 7, 2023",
  overallTrustScore: 91,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "Speech transcripts and official parliamentary broadcasts confirm Prime Minister's statements outlining government legal priorities.",
  claimSummary: { total: 2, supporting: 2, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Confirmed by official Hansard parliamentary transcript.",
      evidenceIds: ["ev-pol-1"],
      importantNotes: [],
      layer: "statement_made",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 91, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 91 },
  crossSourceComparison: baseComparison,
};

// 8. Very bright image (high-key snow/sky, Luminance ~0.82)
const report8_bright_image: VerificationReport = {
  articleTitle: "Alpine Glacial Retreat Accelerates According to European Climate Service",
  sourceDomain: "bbc.com",
  articleUrl: "https://bbc.com/news/science-alpine-glaciers-2026",
  featuredImage: brightPhotoDataUri,
  backgroundImage: {
    url: brightPhotoDataUri,
    sourceType: "article",
    credit: "Copernicus Climate Service / ESA",
    luminance: 0.82,
  },
  author: "Science Reporter",
  publishedAt: "Nov 9, 2026",
  overallTrustScore: 96,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary:
    "Satellite radar altimetry and in-situ monitoring data verify unprecedented summer ice volume loss across Swiss and Italian alpine basins.",
  claimSummary: { total: 3, supporting: 3, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Direct satellite altimetry and ground sensor records confirm volume loss.",
      evidenceIds: ["ev-esa-1"],
      importantNotes: [],
      layer: "underlying_fact",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 96, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 96 },
  crossSourceComparison: {
    originalPublisher: "bbc.com",
    totalPublicationsExamined: 3,
    independentSourcesCount: 3,
    syndicatedSourcesCount: 0,
    wireAgenciesDetected: ["Reuters"],
    publications: [
      {
        domain: "bbc.com",
        title: "Glaciers in the Alps lose 10% volume in two years",
        sourceType: "international_news",
        relationship: "original",
        isIndependent: true,
        isWireSyndicated: false,
      },
      {
        domain: "reuters.com",
        title: "Swiss monitoring network records rapid glacial melt",
        sourceType: "wire",
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
    summary: "Full consensus among climate observatories and wire reports.",
  },
};

// 9. Very dark image (night/interior, Luminance ~0.10)
const report9_dark_image: VerificationReport = {
  articleTitle: "Parliament Passes Midnight Emergency Security Package in Rome",
  sourceDomain: "ansa.it",
  articleUrl: "https://www.ansa.it/sito/notizie/cronaca/2023/09/08/decreto-notte_912.html",
  featuredImage: darkNightPhotoDataUri,
  backgroundImage: {
    url: darkNightPhotoDataUri,
    sourceType: "article",
    credit: "ansa.it / ANSA Archive",
    luminance: 0.10,
  },
  author: "Rome Night Bureau",
  publishedAt: "Sept 8, 2023",
  overallTrustScore: 89,
  veracityVerdict: "mostly_true",
  confidence: "high",
  summary:
    "Late-night voting session concluded at 02:40 with passage of key legislative articles. Recorded voting results corroborated by chamber records.",
  claimSummary: { total: 2, supporting: 2, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Electronic roll-call records confirm passage of articles 1-12.",
      evidenceIds: ["ev-chamber-1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 89, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 89 },
  crossSourceComparison: baseComparison,
};

// 10. Very wide panorama image (1800x600, 3:1 ratio)
const report10_panorama_image: VerificationReport = {
  articleTitle: "European Union Ministers Convene for Pan-European Security Summit",
  sourceDomain: "euronews.com",
  articleUrl: "https://www.euronews.com/2023/09/10/eu-interior-ministers-summit",
  featuredImage: panoramaPhotoDataUri,
  backgroundImage: {
    url: panoramaPhotoDataUri,
    sourceType: "article",
    credit: "euronews.com / Council of the EU",
    luminance: 0.26,
  },
  author: "Brussels Bureau",
  publishedAt: "Sept 10, 2023",
  overallTrustScore: 94,
  veracityVerdict: "verified_true",
  confidence: "high",
  summary:
    "Interior ministers from 27 member states gathered in Brussels to coordinate youth justice and border coordination frameworks.",
  claimSummary: { total: 2, supporting: 2, contradicting: 0, qualifying: 0, insufficient: 0 },
  evaluations: [
    {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Confirmed by official Council of the European Union press release and participant schedules.",
      evidenceIds: ["ev-eu-1"],
      importantNotes: [],
      layer: "event_occurred",
    },
  ],
  omittedContext: [],
  scoreBreakdown: { claimScore: 94, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 94 },
  crossSourceComparison: baseComparison,
};

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

  const scenarios = [
    {
      id: "scenario1_normal_news_url",
      name: "1. Normal News URL",
      description: "Standard editorial article with 16:9 featured photo and full cross-source corroboration.",
      report: report1_normal_news,
    },
    {
      id: "scenario2_blocked_publisher_url",
      name: "2. Blocked-Publisher URL",
      description: "Publisher blocked ingestion (403/paywall); verified via independent reporting, image retrieved from high-confidence related report.",
      report: report2_blocked_publisher,
    },
    {
      id: "scenario3_headline_input",
      name: "3. Headline Input",
      description: "Direct headline submitted in search box; photo retrieved from related news report with proper credit line.",
      report: report3_headline_input,
    },
    {
      id: "scenario4_short_claim_input",
      name: "4. Short Claim Input",
      description: "Rumor / speculation query; photo retrieved from sports evidence reporting; verdict reflects misleading status.",
      report: report4_short_claim,
    },
    {
      id: "scenario5_pasted_text",
      name: "5. Pasted Multi-Paragraph Text",
      description: "Multi-paragraph news draft verified against wire archives; evidence photo credited to accredited reporting outlet.",
      report: report5_pasted_text,
    },
    {
      id: "scenario6_no_image_fallback",
      name: "6. No Image (Gradient Fallback)",
      description: "Article without og:image; seamlessly falls back to dark gradient hero preserving identical typography and cards.",
      report: report6_no_image_fallback,
    },
    {
      id: "scenario7_portrait_image",
      name: "7. Portrait-Orientation Image",
      description: "3:4 vertical photo framed at object-position: center 30% preventing forehead truncation.",
      report: report7_portrait_image,
    },
    {
      id: "scenario8_bright_image",
      name: "8. Very Bright Image (Snow/Sky)",
      description: "High-key image (luminance 0.82) with dynamic scrim boost guaranteeing WCAG AA text contrast.",
      report: report8_bright_image,
    },
    {
      id: "scenario9_dark_image",
      name: "9. Very Dark Image (Night/Interior)",
      description: "Low-key nocturnal scene (luminance 0.10) with crisp white Newsreader serif title and contrast.",
      report: report9_dark_image,
    },
    {
      id: "scenario10_panorama_image",
      name: "10. Very Wide Panorama Image",
      description: "3:1 panoramic summit photo scaled and cropped seamlessly across the 1280px full-bleed hero banner.",
      report: report10_panorama_image,
    },
  ];

  console.log(`Generating full-bleed NewsBackdrop HTML and capturing screenshots for all ${scenarios.length} scenarios...`);

  for (const s of scenarios) {
    const markup = renderToStaticMarkup(
      React.createElement(FinalVerificationDashboard, {
        report: s.report,
        onReset: () => {},
      })
    );

    const fullHtml = buildHtmlPage(s.name, markup);
    const htmlFilePath = path.join(HTML_DIR, `${s.id}.html`);
    fs.writeFileSync(htmlFilePath, fullHtml, "utf8");

    // 1. Mobile viewport at 375px
    const outMobile = path.join(SCREENSHOT_DIR, `${s.id}_375px.png`);
    execFileSync(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      "--window-size=375,1200",
      `--screenshot=${outMobile}`,
      `file:///${htmlFilePath.replace(/\\/g, "/")}`,
    ]);

    // Copy to artifact root as well for direct linking
    fs.copyFileSync(outMobile, path.join(ARTIFACT_DIR, `${s.id}_375px.png`));

    // 2. Desktop viewport at 1280px
    const outDesktop = path.join(SCREENSHOT_DIR, `${s.id}_1280px.png`);
    execFileSync(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,1200",
      `--screenshot=${outDesktop}`,
      `file:///${htmlFilePath.replace(/\\/g, "/")}`,
    ]);

    fs.copyFileSync(outDesktop, path.join(ARTIFACT_DIR, `${s.id}_1280px.png`));

    const effConfig = getEffectiveBackdropConfig(
      DEFAULT_BACKDROP_CONFIG,
      s.report.backgroundImage?.luminance
    );

    console.log(
      `✓ Captured ${s.id} (375px & 1280px) | blur: ${effConfig.blurPx}px (mobile: ${effConfig.mobileBlurPx}px) | scrims: left=${effConfig.leftScrimOpacity.toFixed(2)}, right=${effConfig.rightScrimOpacity.toFixed(2)}, bottom=${effConfig.bottomScrimOpacity.toFixed(2)}`
    );
  }

  console.log(`\nAll ${scenarios.length * 2} screenshots successfully captured and stored in artifact directory!`);
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
