import fs from "node:fs";
import path from "node:path";
import process from "node:process";

if (fs.existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
process.env.FAKENEWZZ_TRACE = "true";

import { parseAndAnalyzeInput } from "../src/lib/input/detectInputType";
import { decomposeStatementClaims } from "../src/lib/verification/statementIntent";
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
import { withTrace } from "../src/lib/debug/trace";

function isNavOrSectionPage(rawUrl: string, title: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.toLowerCase().replace(/\/$/, "");
    if (!pathname || pathname === "" || pathname === "/") return true;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1 && !/\d/.test(pathname) && !pathname.endsWith(".html") && !pathname.endsWith(".cms")) {
      return true;
    }
    if (/\b(tag|category|topic|section|news|latest|breaking|browse|search|archive)\b/i.test(pathname)) {
      return true;
    }
    if (/\b(home|index|top stories|today's top)\b/i.test(title)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

interface RegressionCase {
  id: string;
  name: string;
  input: string;
  expectedConclusion: string;
}

const CASES: RegressionCase[] = [
  {
    id: "case-1",
    name: "The Sun revolves around the Earth.",
    input: "The Sun revolves around the Earth.",
    expectedConclusion: "False",
  },
  {
    id: "case-2",
    name: "Water boils at 100°C at sea level.",
    input: "Water boils at 100°C at sea level.",
    expectedConclusion: "True or Mostly true",
  },
  {
    id: "case-3",
    name: "India became independent in 1947.",
    input: "India became independent in 1947.",
    expectedConclusion: "True or Mostly true",
  },
  {
    id: "case-4",
    name: "India became independent in 1950.",
    input: "India became independent in 1950.",
    expectedConclusion: "False",
  },
];

async function runCase(c: RegressionCase) {
  console.log(`\n================================================================================`);
  console.log(`DIAGNOSING: [${c.id}] "${c.input}"`);
  console.log(`Expected Conclusion: ${c.expectedConclusion}`);
  console.log(`================================================================================`);

  const rawInput = c.input.trim();
  const parsedInput = parseAndAnalyzeInput(rawInput);
  console.log(`1. INPUT DETECTION:`);
  console.log(`   - Detected Type: ${parsedInput.type}`);

  let article: Article = {
    title: rawInput,
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

  let claims: ClaimInput[];
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
    claims = [
      {
        id: "claim-1",
        text: rawInput,
        importance: "high",
        claimType: "factual",
        certainty: inferClaimCertainty(rawInput),
      },
    ];
  }

  console.log(`\n2. EXTRACTED CLAIMS:`);
  for (const cl of claims) {
    console.log(`   - ID: ${cl.id}`);
    console.log(`     Text: "${cl.text}"`);
    console.log(`     Certainty: ${cl.certainty || "undefined"}`);
    console.log(`     ClaimType: ${cl.claimType || "undefined"}`);
    console.log(`     Layer: ${cl.layer || "undefined"}`);
  }

  const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key || "";
  const provider = new SerperProvider(apiKey);

  const searchResults = await searchMultipleClaims(claims, provider, {
    limit: 5,
    timeoutMs: 10000,
  });

  const queriesSent = searchResults.flatMap((sr) => sr.queries || []);
  console.log(`\n3. SEARCH QUERIES SENT:`);
  queriesSent.forEach((q, idx) => console.log(`   [${idx + 1}] "${q}"`));

  const rankedEvidenceByClaim = new Map<string, Evidence[]>();
  for (const sr of searchResults) {
    const claim = claims.find((cl) => cl.id === sr.claimId) || claims[0];
    const ranked = rankEvidenceForClaim(claim, sr.evidence);
    rankedEvidenceByClaim.set(sr.claimId, ranked);
  }
  const allRankedEvidence = Array.from(rankedEvidenceByClaim.values()).flat();

  console.log(`\n4. SEARCH RESULTS RECEIVED (Total: ${allRankedEvidence.length}):`);
  allRankedEvidence.forEach((e, idx) => {
    let urlPath = "";
    try {
      urlPath = new URL(e.url).pathname;
    } catch {
      urlPath = e.url;
    }
    const isNav = isNavOrSectionPage(e.url, e.title);
    console.log(`   [${idx + 1}] Domain: ${e.domain}`);
    console.log(`       Title: "${e.title}"`);
    console.log(`       Path: ${urlPath}`);
    console.log(`       Is Homepage/Section/Tag Page: ${isNav}`);
    console.log(`       Snippet: "${e.snippet.slice(0, 100)}..."`);
    console.log(`       Relevance: ${e.relevance} | Quality: ${e.evidenceQuality}`);
  });

  console.log(`\n5. EVIDENCE PASSED TO EVALUATOR (Total: ${allRankedEvidence.length}):`);
  allRankedEvidence.forEach((e, idx) => {
    console.log(`   - Evidence #${idx + 1} (${e.id}): "${e.title}"`);
    console.log(`     Passage: "${e.snippet}"`);
  });

  const { evaluations, evidence: evaluatedEvidence } = await evaluateClaims(
    claims,
    allRankedEvidence
  );

  console.log(`\n6. EVALUATION RESULTS:`);
  for (const ev of evaluations) {
    console.log(`   - Claim ID: ${ev.claimId}`);
    console.log(`     Verdict: ${ev.verdict}`);
    console.log(`     Confidence: ${ev.confidence}`);
    console.log(`     Cited Evidence IDs: [${ev.evidenceIds.join(", ")}]`);
    console.log(`     Explanation: "${ev.explanation}"`);
  }

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

  const clusters = clusterEvidenceIndependence(evaluatedEvidence);
  console.log(`\n7. INDEPENDENCE CLUSTERING & COMPARISON:`);
  console.log(`   - Raw Evidence Count: ${evaluatedEvidence.length}`);
  console.log(`   - Total Clusters Formed: ${clusters.length}`);
  clusters.forEach((cl, idx) => {
    console.log(`     Cluster [${idx + 1}] ID: ${cl.clusterId}, Origin: ${cl.originType}, Members: ${cl.memberEvidenceIds.length}, Rule: ${cl.clusterRule}`);
  });

  let comparisonReport: any = undefined;
  if (isComparisonEnabled()) {
    try {
      comparisonReport = await compareClaimsAcrossClusters(
        claims,
        evaluatedEvidence,
        clusters,
        { articleText: article.content }
      );
      console.log(`   - Agreement Summary: ${comparisonReport.agreementSummary}`);
      console.log(`   - Total Independent Clusters: ${comparisonReport.totalIndependentClusters}`);
    } catch (err: any) {
      console.log(`   - Comparison Engine failed: ${err.message}`);
    }
  }

  const report = await buildReport(article, claims, evaluations, omissions, {
    evidence: evaluatedEvidence,
    comparison: comparisonReport,
    sourceReadStatus: "readable",
  });

  console.log(`\n8. SCORING & CONCLUSION:`);
  console.log(`   - Overall Trust Score: ${report.overallTrustScore}`);
  console.log(`   - Score Breakdown:`);
  console.log(`       Base Score: ${(report.scoreBreakdown as any)?.claimScore ?? "N/A"}`);
  console.log(`       Context Penalty: ${(report.scoreBreakdown as any)?.contextPenalty ?? "N/A"}`);
  console.log(`       Final Score: ${report.overallTrustScore}`);
  console.log(`   - Veracity Verdict: ${report.veracityVerdict}`);
  console.log(`   - Confidence: ${report.confidence}`);
  console.log(`   - Conclusion Label: "${report.conclusion?.label}"`);
  console.log(`   - Conclusion Explanation: "${report.conclusion?.explanation}"`);
  console.log(`   - Conclusion Reason Codes: [${(report.conclusion?.reasonCodes || []).join(", ")}]`);

  return {
    id: c.id,
    input: c.input,
    certainty: claims[0]?.certainty,
    claimType: claims[0]?.claimType,
    queriesSent,
    evidenceCount: allRankedEvidence.length,
    evaluations: evaluations.map(e => ({ verdict: e.verdict, confidence: e.confidence, cited: e.evidenceIds })),
    clustersCount: clusters.length,
    agreement: comparisonReport?.agreementSummary || "none",
    score: report.overallTrustScore,
    verdict: report.veracityVerdict,
    conclusionLabel: report.conclusion?.label,
    reasonCodes: report.conclusion?.reasonCodes || [],
  };
}

async function main() {
  const summary: any[] = [];
  for (const c of CASES) {
    try {
      const res = await withTrace(() => runCase(c));
      summary.push(res.result);
    } catch (err: any) {
      console.error(`ERROR running ${c.id}:`, err);
    }
  }

  console.log(`\n\n================================================================================`);
  console.log(`SUMMARY TABLE FOR REGRESSION CASES 1-4:`);
  console.log(`================================================================================`);
  console.table(summary.map(s => ({
    Case: s.id,
    Input: s.input,
    Certainty: s.certainty,
    Type: s.claimType,
    Queries: s.queriesSent.length,
    Evidence: s.evidenceCount,
    Evaluations: s.evaluations.map((e: any) => `${e.verdict} (${e.confidence})`).join(", "),
    Clusters: s.clustersCount,
    Agreement: s.agreement,
    Score: s.score,
    Verdict: s.verdict,
    Conclusion: s.conclusionLabel,
    Reason: s.reasonCodes.join("; ")
  })));
}

main().catch(console.error);
