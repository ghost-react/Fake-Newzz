import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Ensure .env.local is loaded
if (fs.existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
process.env.FAKENEWZZ_TRACE = "true";

import { parseAndAnalyzeInput } from "../src/lib/input/detectInputType";
import { decomposeStatementClaims } from "../src/lib/verification/statementIntent";
function extractClaimsFromArticle(article: {
  title?: string;
  description?: string | null;
  content?: string;
}): ClaimInput[] {
  const claims: ClaimInput[] = [];
  if (article.title && article.title.trim()) {
    claims.push({
      id: "claim-1",
      text: article.title.trim(),
      importance: "high",
      claimType: "event",
    });
  }
  if (article.description && article.description.trim()) {
    const desc = article.description.trim();
    if (desc !== article.title?.trim()) {
      claims.push({
        id: "claim-2",
        text: desc,
        importance: "medium",
        claimType: "factual",
      });
    }
  }
  if (article.content && article.content.trim()) {
    const sentences = article.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^#+\s*/, ""))
      .filter((s) => s.length >= 30 && s.length <= 280 && !s.includes("http"));

    for (const sentence of sentences) {
      if (
        sentence !== article.title?.trim() &&
        sentence !== article.description?.trim() &&
        claims.length < 4
      ) {
        claims.push({
          id: `claim-${claims.length + 1}`,
          text: sentence,
          importance: claims.length === 1 ? "medium" : "low",
          claimType: "factual",
        });
      }
    }
  }
  if (claims.length === 0) {
    claims.push({
      id: "claim-1",
      text: article.title || "Primary news story assertion",
      importance: "high",
      claimType: "factual",
    });
  }
  return claims;
}
import { inferClaimCertainty } from "../src/lib/verification/claimExtractor";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { Article } from "../src/schemas/article";
import { SerperProvider } from "../src/lib/search/serper";
import { searchMultipleClaims } from "../src/lib/search/searchClaims";
import { rankEvidenceForClaim } from "../src/lib/search/rankEvidence";
import { evaluateClaims } from "../src/lib/verification/evaluateClaims";
import { analyzeArticleContext } from "../src/lib/verification/contextAnalysis";
import { clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import { compareClaimsAcrossClusters } from "../src/lib/comparison/compareClaims";
import { isComparisonEnabled } from "../src/lib/comparison/config";
import { buildReport } from "../src/lib/verification/buildReport";
import { withTrace, getActiveTrace } from "../src/lib/debug/trace";

interface TestCase {
  id: string;
  name: string;
  category: string;
  input: string;
  expectedConclusions: string[];
  description: string;
}

interface DiagnosisResult {
  id: string;
  name: string;
  input: string;
  detectedInputType: string;
  claimsExtracted: string[];
  queriesSent: string[];
  topResults: { title: string; domain: string; snippet: string }[];
  evidencePassedToEvaluatorCount: number;
  evaluations: { claimId: string; verdict: string; confidence: string; explanation: string }[];
  score: number;
  verdict: string;
  conclusionLabel: string;
  expectedConclusions: string[];
  traceFile?: string;
}

async function runSingleCase(testCase: TestCase): Promise<DiagnosisResult> {
  const rawInput = testCase.input.trim();
  const parsedInput = parseAndAnalyzeInput(rawInput);

  let article: Article;
  let claims: ClaimInput[];

  const isHeadlineOrClaim = parsedInput.type === "headline" || parsedInput.type === "claim";
  const headlineTitle = isHeadlineOrClaim
    ? rawInput
    : rawInput.split(/\n+/)[0].slice(0, 150).trim() || "Pasted News Story";

  article = {
    title: headlineTitle,
    description: null,
    sourceDomain: "Independent Claim",
    url: null as unknown as string,
    author: null,
    publishedAt: null,
    featuredImage: null,
    content: rawInput,
    wordCount: rawInput.split(/\s+/).filter(Boolean).length,
    sourceReadStatus: "readable",
  } as Article;

  if (parsedInput.type === "claim") {
    claims = decomposeStatementClaims(rawInput, "claim");
  } else if (parsedInput.type === "headline") {
    claims = [
      {
        id: "claim-1",
        text: rawInput,
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: inferClaimCertainty(rawInput),
      },
    ];
  } else {
    claims = extractClaimsFromArticle(article);
  }

  const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key || "";
  const provider = new SerperProvider(apiKey);

  const searchResults = await searchMultipleClaims(claims, provider, {
    limit: 5,
    timeoutMs: 10000,
    articleContext: {
      title: article.title,
      text: article.content,
    },
  });

  const queriesSent = searchResults.flatMap((sr) => sr.queries || []);

  const rankedEvidenceByClaim = new Map<string, Evidence[]>();
  for (const sr of searchResults) {
    const claim = claims.find((c) => c.id === sr.claimId) || {
      id: sr.claimId,
      text: sr.claimId,
      importance: "high" as const,
    };
    const ranked = rankEvidenceForClaim(claim, sr.evidence);
    rankedEvidenceByClaim.set(sr.claimId, ranked);
  }
  const allRankedEvidence = Array.from(rankedEvidenceByClaim.values()).flat();

  const topResults = allRankedEvidence.slice(0, 5).map((e) => ({
    title: e.title,
    domain: e.domain,
    snippet: e.snippet.slice(0, 120),
  }));

  const { evaluations, evidence: evaluatedEvidence } = await evaluateClaims(
    claims,
    allRankedEvidence
  );

  let omissions: any[] = [];
  try {
    omissions = await analyzeArticleContext(
      article,
      claims,
      evaluatedEvidence,
      evaluations
    );
  } catch {
    omissions = [];
  }

  let comparisonReport: any = undefined;
  if (isComparisonEnabled()) {
    try {
      const clusters = clusterEvidenceIndependence(evaluatedEvidence);
      comparisonReport = await compareClaimsAcrossClusters(
        claims,
        evaluatedEvidence,
        clusters,
        { articleText: article.content }
      );
    } catch {
      comparisonReport = undefined;
    }
  }

  const report = await buildReport(article, claims, evaluations, omissions, {
    evidence: evaluatedEvidence,
    comparison: comparisonReport,
    sourceReadStatus: "readable",
  });

  const activeTrace = getActiveTrace();
  const traceFile = activeTrace?.traceId ? `scratch/traces/trace_${activeTrace.traceId}.json` : undefined;

  return {
    id: testCase.id,
    name: testCase.name,
    input: testCase.input,
    detectedInputType: parsedInput.type,
    claimsExtracted: claims.map((c) => c.text),
    queriesSent,
    topResults,
    evidencePassedToEvaluatorCount: allRankedEvidence.length,
    evaluations: evaluations.map((e) => ({
      claimId: e.claimId,
      verdict: e.verdict,
      confidence: e.confidence,
      explanation: e.explanation,
    })),
    score: report.overallTrustScore,
    verdict: report.veracityVerdict,
    conclusionLabel: report.conclusion?.label || "None",
    expectedConclusions: testCase.expectedConclusions,
    traceFile,
  };
}

async function main() {
  const casesPath = path.resolve("tests/benchmark/text_cases.json");
  const testCases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, "utf-8"));

  console.log(`\n========================================================================`);
  console.log(`STEP 1: TEXT VERIFICATION PATH CONTROLLED DIAGNOSIS (8 CASES)`);
  console.log(`========================================================================\n`);

  const results: DiagnosisResult[] = [];

  for (const tc of testCases) {
    console.log(`Running [${tc.id}] ${tc.name}...`);
    try {
      const res = await withTrace(async () => runSingleCase(tc));
      results.push(res.result);
      console.log(`  -> Detected Type: ${res.result.detectedInputType}`);
      console.log(`  -> Claims: ${res.result.claimsExtracted.length}`);
      console.log(`  -> Queries Sent: ${res.result.queriesSent.length} queries: [${res.result.queriesSent.join("; ")}]`);
      console.log(`  -> Evidence passed to evaluator: ${res.result.evidencePassedToEvaluatorCount}`);
      console.log(`  -> Evaluations: ${JSON.stringify(res.result.evaluations.map(e => `${e.verdict} (${e.confidence})`))}`);
      console.log(`  -> Score: ${res.result.score} | Verdict: ${res.result.verdict} | Conclusion: ${res.result.conclusionLabel}`);
      console.log(`  -> Expected: ${res.result.expectedConclusions.join(" or ")}`);
      console.log(`  -> Trace: ${res.tracePath || "none"}\n`);
    } catch (err: any) {
      console.error(`  ERROR on ${tc.id}:`, err?.message || err);
    }
  }

  // Save diagnostic output JSON
  const outPath = path.resolve("scratch/text_cases_diagnosis.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`Diagnosis results written to ${outPath}`);
}

main().catch(console.error);
