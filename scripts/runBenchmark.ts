import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { BenchmarkCasesSchema, BenchmarkCase } from "../tests/benchmark/schema";
import { POST as verifyRoutePost } from "../src/app/api/verify/route";
import { decomposeStatementClaims } from "../src/lib/verification/statementIntent";
import { searchMultipleClaims } from "../src/lib/search/searchClaims";
import { SerperProvider } from "../src/lib/search/serper";
import { SearchProvider, SearchOptions, RawSearchResultItem } from "../src/lib/search/provider";
import { rankEvidenceForClaim } from "../src/lib/search/rankEvidence";
import { evaluateClaims } from "../src/lib/verification/evaluateClaims";
import { analyzeArticleContext } from "../src/lib/verification/contextAnalysis";
import { buildReport } from "../src/lib/verification/buildReport";
import { isComparisonEnabled } from "../src/lib/comparison/config";
import { clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import { compareClaimsAcrossClusters } from "../src/lib/comparison/compareClaims";
import { withTrace } from "../src/lib/debug/trace";
import { Evidence, ClaimInput } from "../src/schemas/evidence";
import { Omission } from "../src/schemas/omission";

export interface CaseRunResult {
  runIndex: number;
  verdict: string | null;
  score: number | null;
  confidence: string | null;
  latencyMs: number;
  claimCount: number;
  independentSourceCount: number;
  error: string | null;
  passed: boolean;
  hardFailure: boolean;
  failureReason?: string;
  tracePath?: string | null;
}

export interface CaseBenchmarkSummary {
  id: string;
  category: string;
  inputType: string;
  input: string;
  runs: CaseRunResult[];
  verdict: string | null;
  score: number | null;
  confidence: string | null;
  medianLatencyMs: number;
  passed: boolean;
  hardFailure: boolean;
  isStable: boolean;
  notes: string;
  tracePath?: string | null;
}

export interface BenchmarkReport {
  timestamp: string;
  config: {
    concurrency: number;
    repeat: number;
    categoryFilter?: string;
    idFilter?: string;
    quick: boolean;
  };
  totalCases: number;
  passedCases: number;
  failedCases: number;
  hardFailures: number;
  overallPassRatePercent: number;
  categoryStats: Record<
    string,
    {
      total: number;
      passed: number;
      failed: number;
      hardFailures: number;
      passRatePercent: number;
    }
  >;
  latencyStats: {
    medianMs: number;
    p95Ms: number;
  };
  unstableCases: string[];
  cases: CaseBenchmarkSummary[];
}

/**
 * Removes sensitive tokens or API keys before serialization or logging.
 */
function sanitizeSecrets(str: string): string {
  if (!str) return str;
  const keys = [
    process.env.SERPER_API_KEY,
    process.env.Serper_API_Key,
    process.env.FIRECRAWL_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
  ].filter((k): k is string => Boolean(k && k.length > 5));

  let sanitized = str;
  for (const k of keys) {
    sanitized = sanitized.split(k).join("[REDACTED]");
  }
  return sanitized;
}

/**
 * Computes median and 95th percentile latencies.
 */
function calculatePercentiles(latencies: number[]): { medianMs: number; p95Ms: number } {
  if (latencies.length === 0) return { medianMs: 0, p95Ms: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length * 0.5)];
  const p95Ms = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  return { medianMs, p95Ms };
}

function createBenchmarkMockSearchProvider(caseItem: BenchmarkCase): SearchProvider {
  return {
    name: "mock-benchmark-search",
    async search(query: string, _options?: SearchOptions): Promise<RawSearchResultItem[]> {
      const input = (caseItem.input || "").toLowerCase();

      // Case: Hedged analysis (Hardik Pandya trade rumours)
      if (
        caseItem.id.includes("hedged") ||
        (input.includes("hardik") && (input.includes("could") || input.includes("exploring")))
      ) {
        return [
          {
            title: "IPL Trade Rumours: PBKS explore all-rounder options",
            url: "https://cricinfo.com/trade-talks-pbks",
            domain: "cricinfo.com",
            snippet:
              "Punjab Kings are reportedly exploring options to trade for Hardik Pandya, though discussions remain preliminary and no deal is signed.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Delhi Capitals monitor auction market",
            url: "https://cricbuzz.com/dc-trade",
            domain: "cricbuzz.com",
            snippet:
              "Delhi Capitals management is considering trade scenarios for senior Indian all-rounders including Hardik Pandya.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
          {
            title: "Franchises explore trade possibilities ahead of IPL auction deadline",
            url: "https://sportstar.com/lsg-talks",
            domain: "sportstar.com",
            snippet:
              "Insiders suggest multiple franchises may emerge in trade discussions as retention deadline approaches.",
            publishedAt: "2026-05-01T12:00:00Z",
          },
        ];
      }

      // Case: Rumour stated as fact (Hardik joins PBKS)
      if (
        caseItem.id.includes("rumour-stated-as-fact") ||
        (input.includes("hardik") && input.includes("joins"))
      ) {
        return [
          {
            title: "Fact Check: Hardik Pandya has not joined Punjab Kings",
            url: "https://thehindu.com/sport/fact-check-hardik",
            domain: "thehindu.com",
            snippet:
              "Reports claiming Hardik Pandya joined PBKS are refuted; franchise confirms only exploratory discussions occurred and no signing took place.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "PBKS and MI in preliminary trade talks",
            url: "https://cricinfo.com/pbks-talks",
            domain: "cricinfo.com",
            snippet:
              "Franchises held informal talks regarding trade possibilities, but no agreement, contract or signing has occurred.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
        ];
      }

      // Case: Denied rumour
      if (
        caseItem.id.includes("denied") ||
        input.includes("denial") ||
        input.includes("despite franchise ceo denial")
      ) {
        return [
          {
            title: "Reports claim PBKS submitted formal trade offer for Hardik Pandya",
            url: "https://sportskeeda.com/ipl/pbks-offer",
            domain: "sportskeeda.com",
            snippet:
              "Reports claim Punjab Kings submitted formal trade offer for Hardik Pandya ahead of the deadline.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "PBKS CEO denies formal trade approach or offer for Hardik Pandya",
            url: "https://indiatoday.in/sports/pbks-ceo-denial",
            domain: "indiatoday.in",
            snippet:
              "Punjab Kings CEO issues statement denying formal trade offer, calling reports premature.",
            publishedAt: "2026-05-01T12:00:00Z",
          },
        ];
      }

      // Case: Confirmed trade official announcement
      if (
        caseItem.id.includes("confirmed-trade") ||
        input.includes("bcci approves")
      ) {
        return [
          {
            title: "BCCI approves official player trade ahead of IPL retention deadline",
            url: "https://bcci.tv/news/player-trade-approved",
            domain: "bcci.tv",
            snippet:
              "BCCI confirms approval of official player trade ahead of IPL retention deadline following formal agreement between franchises.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Reuters: BCCI confirms approved player trades for IPL 2025",
            url: "https://reuters.com/sports/ipl-trades-approved",
            domain: "reuters.com",
            snippet:
              "The Board of Control for Cricket in India officially announced regulatory approval for player trade transactions.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case: Developing injury report
      if (caseItem.id.includes("injury") || input.includes("bumrah")) {
        return [
          {
            title: "Jasprit Bumrah undergoes fitness assessment at NCA Bengaluru",
            url: "https://hindustantimes.com/cricket/bumrah-nca-assessment",
            domain: "hindustantimes.com",
            snippet:
              "Jasprit Bumrah undergoes fitness assessment in NCA ahead of Test series; official medical update awaited from staff.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Bumrah attends National Cricket Academy for routine fitness checks",
            url: "https://indianexpress.com/sports/bumrah-fitness",
            domain: "indianexpress.com",
            snippet:
              "Pacer Jasprit Bumrah is undergoing assessment at the NCA ahead of selection, final clearance awaited.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case: Forecast monsoon arrival IMD
      if (
        caseItem.id.includes("forecast") ||
        input.includes("monsoon") ||
        input.includes("imd")
      ) {
        return [
          {
            title: "IMD official weather bulletin: Monsoon onset over Kerala forecast by June 1",
            url: "https://mausam.imd.gov.in/monsoon-forecast",
            domain: "mausam.imd.gov.in",
            snippet:
              "IMD forecasts monsoon arrival over Kerala by June 1 according to meteorological models.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "The Hindu: IMD forecasts monsoon arrival over Kerala by June 1",
            url: "https://thehindu.com/news/monsoon-kerala-imd",
            domain: "thehindu.com",
            snippet:
              "India Meteorological Department IMD forecasts monsoon arrival over Kerala coast by June 1.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case 1 (Prompt 10): Blocked-site genuine story (Supreme Court airfare petition)
      if (
        caseItem.id.includes("blocked-site") ||
        (input.includes("supreme court") && input.includes("airfare"))
      ) {
        return [
          {
            title: "Supreme Court issues notice to civil aviation ministry on airfare caps petition",
            url: "https://thehindu.com/news/national/sc-notice-airfare-petition",
            domain: "thehindu.com",
            snippet:
              "The Supreme Court issued notice to the Ministry of Civil Aviation on a petition seeking caps on airline ticket prices during festival and peak seasons.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "SC seeks Centre's response on airfare regulation plea",
            url: "https://ndtv.com/india-news/supreme-court-airfare-caps",
            domain: "ndtv.com",
            snippet:
              "A bench headed by the Chief Justice agreed to examine arbitrary surge pricing and issued notice to civil aviation authorities.",
            publishedAt: "2026-05-01T10:30:00Z",
          },
          {
            title: "Notice issued to civil aviation ministry over airfare regulation petition",
            url: "https://indianexpress.com/article/india/supreme-court-airfare-pricing",
            domain: "indianexpress.com",
            snippet:
              "Supreme Court judges issued formal notice on a public interest plea regarding airfare ceilings across domestic routes.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case 2 (Prompt 10): Genuine policy decree with minor detail variation (Meloni youth decree)
      if (
        caseItem.id.includes("meloni") ||
        caseItem.id.includes("policy-decree") ||
        (input.includes("meloni") && input.includes("decree"))
      ) {
        return [
          {
            title: "Italy passes Meloni decree cracking down on youth crime",
            url: "https://ansa.it/english/news/meloni-decree-youth-crime",
            domain: "ansa.it",
            snippet:
              "Prime Minister Giorgia Meloni's cabinet approved a decree cracking down on youth crime with penalties for parents up to EUR 20,000 and measures for youth aged 14-17.",
            publishedAt: "2026-09-08T10:00:00Z",
          },
          {
            title: "Italian government approves youth crime crackdown decree",
            url: "https://reuters.com/world/europe/italy-youth-crime-decree",
            domain: "reuters.com",
            snippet:
              "Italy approved a decree targeting juvenile delinquency where parents face fines up to ₹21 lakh if children skip school.",
            publishedAt: "2026-09-08T11:00:00Z",
          },
          {
            title: "Meloni cabinet introduces new rules for juvenile offenders",
            url: "https://corriere.it/politica/meloni-decreto-giovani",
            domain: "corriere.it",
            snippet:
              "The decree establishes new sanctions for youth delinquency, addressing offenders aged 16+ with parental accountability measures.",
            publishedAt: "2026-09-08T12:00:00Z",
          },
        ];
      }

      // Case 3 (Prompt 10): Related-but-different-event evidence (September decree with July bill)
      if (
        caseItem.id.includes("different-event") ||
        caseItem.id.includes("maritime") ||
        (input.includes("september decree") && input.includes("maritime"))
      ) {
        return [
          {
            title: "Cabinet approves September decree establishing revised maritime security measures",
            url: "https://reuters.com/world/maritime-security-decree",
            domain: "reuters.com",
            snippet:
              "The cabinet approved a September decree establishing revised maritime security regulations and port inspection standards.",
            publishedAt: "2026-09-15T10:00:00Z",
          },
          {
            title: "Government approves September decree on maritime security protocols",
            url: "https://thehindu.com/news/maritime-security-decree",
            domain: "thehindu.com",
            snippet:
              "A new September decree introduces revised maritime security and surveillance standards approved by the cabinet.",
            publishedAt: "2026-09-15T11:00:00Z",
          },
          {
            title: "July legislative draft proposed initial maritime framework",
            url: "https://legalarchive.org/july-maritime-bill",
            domain: "legalarchive.org",
            snippet:
              "Earlier in July 2026, lawmakers discussed an initial draft bill on coastal port security before the final decree was formulated.",
            publishedAt: "2026-07-10T10:00:00Z",
          },
        ];
      }

      // Case 4 (Prompt 10): Wire story syndicated coverage
      if (
        caseItem.id.includes("wire-story") ||
        (input.includes("isro") && input.includes("satellite"))
      ) {
        return [
          {
            title: "ISRO places ocean observation satellite into orbit",
            url: "https://ndtv.com/india-news/isro-satellite-launch-sriharikota",
            domain: "ndtv.com",
            snippet:
              "Sriharikota (PTI): ISRO successfully placed the EOS ocean observation satellite into its intended sun-synchronous orbit on Tuesday.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Ocean satellite successfully launched by ISRO from Sriharikota",
            url: "https://timesofindia.indiatimes.com/india/isro-ocean-satellite",
            domain: "timesofindia.indiatimes.com",
            snippet:
              "Sriharikota: ISRO on Tuesday launched the earth observation satellite into sun-synchronous orbit, space agency officials confirmed. (PTI)",
            publishedAt: "2026-05-01T10:15:00Z",
          },
          {
            title: "ISRO launches EOS ocean satellite into intended orbit",
            url: "https://indianexpress.com/article/technology/science/isro-launch",
            domain: "indianexpress.com",
            snippet:
              "India's space agency ISRO successfully placed its advanced ocean observation satellite into polar sun-synchronous orbit from Sriharikota.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case 5 (Prompt 10): Official statement confirmed by government and press
      if (
        caseItem.id.includes("official-statement") ||
        (input.includes("finance ministry") && input.includes("hydrogen"))
      ) {
        return [
          {
            title: "Notification 14/2026-Customs: Basic customs duty exemption on green hydrogen machinery",
            url: "https://egazette.gov.in/notification-green-hydrogen",
            domain: "egazette.gov.in",
            snippet:
              "Ministry of Finance official notification: Central Government exempts specified equipment and machinery for green hydrogen production from basic customs duty.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Finance ministry notifies customs duty exemption for green hydrogen equipment",
            url: "https://thehindu.com/business/finance-ministry-green-hydrogen-duty",
            domain: "thehindu.com",
            snippet:
              "The Finance Ministry issued a notification granting full basic customs duty exemption on capital goods imported for green hydrogen generation projects.",
            publishedAt: "2026-05-01T11:00:00Z",
          },
        ];
      }

      // Case 6 (Prompt 10): Genuinely false claim with contradicting evidence
      if (
        caseItem.id.includes("false-currency") ||
        (input.includes("rbi") && (input.includes("demonetisation") || input.includes("500 rupee") || input.includes("invalidation")))
      ) {
        return [
          {
            title: "PIB Fact Check: Viral claim of RBI banning 500 rupee notes is fake",
            url: "https://factcheck.pib.gov.in/rbi-500-notes-fake",
            domain: "pib.gov.in",
            snippet:
              "PIB Fact Check has refuted social media claims that RBI will invalidate 500 rupee notes starting midnight as completely false and fabricated.",
            publishedAt: "2026-05-01T10:00:00Z",
          },
          {
            title: "Fact Check: No, RBI has not banned or demonetised Rs 500 currency notes",
            url: "https://boomlive.in/fact-check/rbi-500-note-demonetisation-fake",
            domain: "boomlive.in",
            snippet:
              "Reserve Bank of India has issued no notification banning 500 rupee banknotes. The viral advisory is a hoax and fake claim.",
            publishedAt: "2026-05-01T10:30:00Z",
          },
        ];
      }

      // Generic fallback
      return [
        {
          title: `Reporting on: ${query}`,
          url: `https://example.org/news?q=${encodeURIComponent(query)}`,
          domain: "example.org",
          snippet: `Public reporting details regarding ${query}`,
          publishedAt: "2026-05-01T10:00:00Z",
        },
      ];
    },
  };
}

/**
 * Executes a single verification case using FakeNewzz's verification pipeline.
 */
async function executeCaseOnce(
  caseItem: BenchmarkCase,
  runIndex: number
): Promise<CaseRunResult> {
  const startTime = performance.now();
  let verdict: string | null = null;
  let score: number | null = null;
  let confidence: string | null = null;
  let claimCount = 0;
  let independentSourceCount = 0;
  let error: string | null = null;

  try {
    const isUrl =
      caseItem.inputType === "url" ||
      caseItem.input.startsWith("http://") ||
      caseItem.input.startsWith("https://");

    let report: any = null;

    if (process.env.BENCHMARK_BASE_URL) {
      // Optional: HTTP mode against a running server
      const baseUrl = process.env.BENCHMARK_BASE_URL.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        body: JSON.stringify(isUrl ? { url: caseItem.input } : { text: caseItem.input }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      report = data;
    } else if (isUrl) {
      // In-process URL verification via /api/verify route handler
      const req = new Request("http://localhost:3000/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ url: caseItem.input }),
      });
      const res = await verifyRoutePost(req as any);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Verify route error status ${res.status}`);
      }
      report = data;
    } else {
      // In-process Text/Headline/Claim verification
      const claims: ClaimInput[] = decomposeStatementClaims(caseItem.input, "claim");
      const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key;
      const provider: SearchProvider = apiKey
        ? new SerperProvider(apiKey)
        : createBenchmarkMockSearchProvider(caseItem);
      const searchResults = await searchMultipleClaims(claims, provider, {
        limit: 5,
        timeoutMs: 10000,
        articleContext: {
          title: caseItem.input,
        },
      });

      const allRankedEvidence: Evidence[] = [];
      for (const sr of searchResults) {
        const claim = claims.find((c) => c.id === sr.claimId) || {
          id: sr.claimId,
          text: sr.claimId,
        };
        allRankedEvidence.push(...rankEvidenceForClaim(claim, sr.evidence));
      }

      const { evaluations, evidence: evaluatedEvidence } = await evaluateClaims(
        claims,
        allRankedEvidence
      );

      let omissions: Omission[] = [];
      const pseudoArticle = {
        url: "https://fakenewzz.local/claim",
        title: caseItem.input,
        description: caseItem.input,
        sourceDomain: "claim.input",
        content: caseItem.input,
        author: null,
        publishedAt: null,
        featuredImage: null,
        wordCount: caseItem.input.split(/\s+/).length,
      };

      try {
        omissions = await analyzeArticleContext(
          pseudoArticle,
          claims,
          evaluatedEvidence,
          evaluations
        );
      } catch {
        omissions = [];
      }

      let comparisonReport;
      if (isComparisonEnabled()) {
        try {
          const clusters = clusterEvidenceIndependence(evaluatedEvidence);
          comparisonReport = await compareClaimsAcrossClusters(
            claims,
            evaluatedEvidence,
            clusters
          );
        } catch {
          comparisonReport = undefined;
        }
      }

      report = await buildReport(
        {
          title: caseItem.input,
          sourceDomain: "Independent Claim",
          url: null,
          author: null,
          publishedAt: null,
          featuredImage: null,
        },
        claims,
        evaluations,
        omissions,
        { evidence: evaluatedEvidence, comparison: comparisonReport }
      );
    }

    verdict = report?.veracityVerdict ?? null;
    score = typeof report?.overallTrustScore === "number" ? report.overallTrustScore : null;
    confidence = report?.confidence ?? null;
    claimCount = report?.claimSummary?.total ?? report?.evaluations?.length ?? 0;

    if (report?.crossSourceComparison?.sourcesExamined) {
      independentSourceCount = report.crossSourceComparison.sourcesExamined.filter(
        (s: any) => s.isIndependent
      ).length;
    } else if (report?.evidence && Array.isArray(report.evidence)) {
      independentSourceCount = new Set(
        report.evidence
          .filter((e: any) => e.sourceRelationship === "independent" || e.sourceRelationship === "original")
          .map((e: any) => e.domain)
      ).size;
    }
  } catch (err: any) {
    error = sanitizeSecrets(err?.message || String(err));
  }

  const latencyMs = Math.round(performance.now() - startTime);

  // Evaluate pass / fail conditions
  const hardFailure = Boolean(verdict && caseItem.forbiddenVerdicts.includes(verdict));

  let passed = false;
  let failureReason: string | undefined;

  if (hardFailure) {
    failureReason = `Forbidden verdict "${verdict}" received (forbidden: [${caseItem.forbiddenVerdicts.join(", ")}])`;
  } else if (error) {
    failureReason = `Execution error: ${error}`;
  } else if (!verdict || !caseItem.acceptableVerdicts.includes(verdict)) {
    failureReason = `Verdict "${verdict}" not in acceptable: [${caseItem.acceptableVerdicts.join(", ")}]`;
  } else if (
    caseItem.scoreRange &&
    score !== null &&
    (score < caseItem.scoreRange[0] || score > caseItem.scoreRange[1])
  ) {
    failureReason = `Score ${score} outside expected range [${caseItem.scoreRange[0]}, ${caseItem.scoreRange[1]}]`;
  } else {
    passed = true;
  }

  return {
    runIndex,
    verdict,
    score,
    confidence,
    latencyMs,
    claimCount,
    independentSourceCount,
    error,
    passed,
    hardFailure,
    failureReason,
  };
}

/**
 * Runs items through an async worker pool with bounded concurrency.
 */
async function runWithBoundedConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      while (currentIndex < items.length) {
        const idx = currentIndex++;
        results[idx] = await task(items[idx], idx);
      }
    }
  );

  await Promise.all(workers);
  return results;
}

/**
 * Formats a terminal summary table with aligned columns.
 */
function printTable(headers: string[], rows: (string | number)[][]): void {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = rows.reduce(
      (max, row) => Math.max(max, String(row[i] ?? "").length),
      0
    );
    return Math.max(h.length, maxRowWidth);
  });

  const headerLine = headers
    .map((h, i) => h.padEnd(colWidths[i]))
    .join("  ");
  const separator = colWidths.map((w) => "-".repeat(w)).join("  ");

  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(
      row.map((cell, i) => String(cell ?? "").padEnd(colWidths[i])).join("  ")
    );
  }
}

/**
 * Main benchmark execution runner.
 */
async function main() {
  const args = process.argv.slice(2);
  let concurrency = 3;
  let categoryFilter: string | undefined;
  let idFilter: string | undefined;
  let repeat = 1;
  let quick = false;
  let casesPath = path.join(process.cwd(), "tests", "benchmark", "cases.json");

  for (const arg of args) {
    if (arg.startsWith("--concurrency=")) {
      concurrency = Math.max(1, parseInt(arg.split("=")[1], 10) || 3);
    } else if (arg.startsWith("--category=")) {
      categoryFilter = arg.split("=")[1].trim();
    } else if (arg.startsWith("--id=")) {
      idFilter = arg.split("=")[1].trim();
    } else if (arg.startsWith("--repeat=")) {
      repeat = Math.max(1, parseInt(arg.split("=")[1], 10) || 1);
    } else if (arg === "--quick") {
      quick = true;
    } else if (arg.startsWith("--cases=")) {
      casesPath = path.resolve(process.cwd(), arg.split("=")[1].trim());
    }
  }

  console.log("================================================================================");
  console.log("FAKENEWZZ VERIFICATION ENGINE BENCHMARK HARNESS");
  console.log(`Cases file:  ${casesPath}`);
  console.log(`Concurrency: ${concurrency} | Repeat: ${repeat} | Quick mode: ${quick}`);
  if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
  if (idFilter) console.log(`ID filter: ${idFilter}`);
  console.log("================================================================================\n");

  if (!fs.existsSync(casesPath)) {
    console.error(`Error: Cases file not found at ${casesPath}`);
    process.exit(1);
  }

  const rawCasesJson = fs.readFileSync(casesPath, "utf-8");
  let parsedCases: any;
  try {
    parsedCases = JSON.parse(rawCasesJson);
  } catch (err: any) {
    console.error(`Error parsing cases.json: ${err.message}`);
    process.exit(1);
  }

  const validatedCases = BenchmarkCasesSchema.parse(parsedCases);

  // 1. Filter out cases whose input is "TODO"
  let activeCases = validatedCases.filter((c) => c.input.trim() !== "TODO");

  const textInputEnabled = process.env.TEXT_INPUT_ENABLED === "true";
  let skippedTextCases = 0;
  if (!textInputEnabled) {
    activeCases = activeCases.filter((c) => {
      const isUrl = c.inputType === "url" || c.input.startsWith("http://") || c.input.startsWith("https://");
      if (!isUrl) {
        skippedTextCases++;
        return false;
      }
      return true;
    });
  }

  if (categoryFilter) {
    activeCases = activeCases.filter((c) => c.category === categoryFilter);
  }
  if (idFilter) {
    activeCases = activeCases.filter((c) => c.id === idFilter);
  }

  // Quick mode: pick one case per category
  if (quick) {
    const seenCategories = new Set<string>();
    activeCases = activeCases.filter((c) => {
      if (seenCategories.has(c.category)) return false;
      seenCategories.add(c.category);
      return true;
    });
  }

  console.log(`Total defined cases:    ${validatedCases.length}`);
  console.log(`Active testable cases:  ${activeCases.length} (${validatedCases.length - activeCases.length} skipped with input "TODO" or TEXT_INPUT_ENABLED=false)\n`);
  if (skippedTextCases > 0) {
    console.log(`ℹ Marked ${skippedTextCases} text-type cases as skipped (TEXT_INPUT_ENABLED is false).\n`);
  }

  const resultsDir = path.join(process.cwd(), "tests", "benchmark", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // If no active cases are ready, exit cleanly
  if (activeCases.length === 0) {
    console.log("ℹ All cases in cases.json are currently placeholders ('TODO').");
    console.log("To run live benchmarks, replace 'TODO' in tests/benchmark/cases.json with genuine URLs or claims.\n");

    const placeholderReport: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      config: { concurrency, repeat, categoryFilter, idFilter, quick },
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      hardFailures: 0,
      overallPassRatePercent: 100,
      categoryStats: {},
      latencyStats: { medianMs: 0, p95Ms: 0 },
      unstableCases: [],
      cases: [],
    };

    const outPath = path.join(
      resultsDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    fs.writeFileSync(outPath, JSON.stringify(placeholderReport, null, 2), "utf-8");
    console.log(`Result file saved to ${outPath}`);
    process.exit(0);
  }

  // 2. Run cases with bounded concurrency
  console.log(`Executing ${activeCases.length} benchmark case(s) with concurrency ${concurrency}...`);
  const caseSummaries: CaseBenchmarkSummary[] = await runWithBoundedConcurrency(
    activeCases,
    concurrency,
    async (caseItem) => {
      const runs: CaseRunResult[] = [];
      for (let r = 0; r < repeat; r++) {
        const customRunId = `${caseItem.id}-run${r + 1}`;
        const { result: runRes, tracePath } = await withTrace(
          () => executeCaseOnce(caseItem, r + 1),
          customRunId
        );
        runRes.tracePath = tracePath;
        runs.push(runRes);
      }

      const allVerdicts = runs.map((r) => r.verdict);
      const isStable = allVerdicts.every((v) => v === allVerdicts[0]);
      const anyHardFailure = runs.some((r) => r.hardFailure);
      const allPassed = runs.every((r) => r.passed);
      const medianLatencyMs = calculatePercentiles(runs.map((r) => r.latencyMs)).medianMs;

      const latestRun = runs[runs.length - 1];

      return {
        id: caseItem.id,
        category: caseItem.category,
        inputType: caseItem.inputType,
        input: caseItem.input,
        runs,
        verdict: latestRun.verdict,
        score: latestRun.score,
        confidence: latestRun.confidence,
        medianLatencyMs,
        passed: allPassed && (repeat === 1 || isStable),
        hardFailure: anyHardFailure,
        isStable,
        notes: caseItem.notes,
        tracePath: latestRun.tracePath,
      };
    }
  );

  // 3. Compute Aggregated Metrics
  const totalCases = caseSummaries.length;
  const passedCases = caseSummaries.filter((c) => c.passed).length;
  const failedCases = totalCases - passedCases;
  const hardFailures = caseSummaries.filter((c) => c.hardFailure).length;
  const overallPassRatePercent = totalCases > 0 ? (passedCases / totalCases) * 100 : 0;

  const categoryStats: BenchmarkReport["categoryStats"] = {};
  for (const c of caseSummaries) {
    if (!categoryStats[c.category]) {
      categoryStats[c.category] = {
        total: 0,
        passed: 0,
        failed: 0,
        hardFailures: 0,
        passRatePercent: 0,
      };
    }
    const stat = categoryStats[c.category];
    stat.total++;
    if (c.passed) stat.passed++;
    else stat.failed++;
    if (c.hardFailure) stat.hardFailures++;
    stat.passRatePercent = (stat.passed / stat.total) * 100;
  }

  const allLatencies = caseSummaries.flatMap((c) => c.runs.map((r) => r.latencyMs));
  const latencyStats = calculatePercentiles(allLatencies);
  const unstableCases = caseSummaries.filter((c) => !c.isStable).map((c) => c.id);

  // 4. Output Summary Tables
  console.log("\n--------------------------------------------------------------------------------");
  console.log("CATEGORY BREAKDOWN");
  console.log("--------------------------------------------------------------------------------");
  const categoryRows = Object.entries(categoryStats).map(([cat, stat]) => [
    cat,
    stat.total,
    stat.passed,
    stat.failed,
    stat.hardFailures,
    `${stat.passRatePercent.toFixed(1)}%`,
  ]);
  categoryRows.push([
    "TOTAL",
    totalCases,
    passedCases,
    failedCases,
    hardFailures,
    `${overallPassRatePercent.toFixed(1)}%`,
  ]);
  printTable(
    ["Category", "Total", "Passed", "Failed", "Hard Fail", "Pass Rate"],
    categoryRows
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("PERFORMANCE & STABILITY");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Median Latency: ${latencyStats.medianMs} ms`);
  console.log(`P95 Latency:    ${latencyStats.p95Ms} ms`);
  if (repeat > 1) {
    console.log(
      `Unstable Cases across ${repeat} runs: ${
        unstableCases.length > 0 ? unstableCases.join(", ") : "None (100% stable)"
      }`
    );
  }

  if (failedCases > 0 || hardFailures > 0) {
    console.log("\n--------------------------------------------------------------------------------");
    console.log("FAILED & HARD-FAILED CASES (with debug trace)");
    console.log("--------------------------------------------------------------------------------");
    for (const c of caseSummaries.filter((cs) => !cs.passed || cs.hardFailure)) {
      const reason =
        c.runs.find((r) => r.hardFailure || !r.passed)?.failureReason ||
        "Expectation mismatch";
      console.log(`- [${c.id}] (${c.category}): ${reason}`);
      if (c.tracePath) {
        console.log(`  Trace file: ${c.tracePath}`);
      }
    }
  }

  // 5. Compare with Most Recent Previous Results
  const existingResultFiles = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let regressions: string[] = [];
  let improvements: string[] = [];

  if (existingResultFiles.length > 0) {
    const lastFile = existingResultFiles[existingResultFiles.length - 1];
    try {
      const prevData: BenchmarkReport = JSON.parse(
        fs.readFileSync(path.join(resultsDir, lastFile), "utf-8")
      );
      const prevStatusMap = new Map(prevData.cases?.map((c) => [c.id, c.passed]) || []);

      for (const curr of caseSummaries) {
        const prevPassed = prevStatusMap.get(curr.id);
        if (prevPassed !== undefined) {
          if (prevPassed === true && curr.passed === false) {
            regressions.push(curr.id);
          } else if (prevPassed === false && curr.passed === true) {
            improvements.push(curr.id);
          }
        }
      }

      console.log("\n--------------------------------------------------------------------------------");
      console.log(`COMPARISON AGAINST PREVIOUS RUN (${lastFile})`);
      console.log("--------------------------------------------------------------------------------");
      console.log(`Regressions (Pass -> Fail): ${regressions.length > 0 ? regressions.join(", ") : "0"}`);
      console.log(`Improvements (Fail -> Pass): ${improvements.length > 0 ? improvements.join(", ") : "0"}`);
    } catch {
      // Previous file unparseable or schema changed
    }
  }

  // 6. Save Result File
  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
  const reportOutFile = path.join(resultsDir, `${timestampStr}.json`);
  const finalReport: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    config: { concurrency, repeat, categoryFilter, idFilter, quick },
    totalCases,
    passedCases,
    failedCases,
    hardFailures,
    overallPassRatePercent,
    categoryStats,
    latencyStats,
    unstableCases,
    cases: caseSummaries,
  };

  fs.writeFileSync(reportOutFile, JSON.stringify(finalReport, null, 2), "utf-8");
  console.log(`\nResults written to: ${reportOutFile}\n`);

  // 7. Exit Code Determination
  if (hardFailures > 0 || regressions.length > 0) {
    console.error("❌ BENCHMARK FAILED: Hard failures or regressions detected.");
    process.exit(1);
  } else {
    console.log("✅ BENCHMARK COMPLETED: No hard failures or regressions detected.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled fatal benchmark error:", sanitizeSecrets(err?.message || String(err)));
  process.exit(1);
});
