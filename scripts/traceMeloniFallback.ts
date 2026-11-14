import { withTrace, traceStage } from "../src/lib/debug/trace";
import { recoverHeadline } from "../src/lib/ingestion/headlineRecovery";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { SearchProvider } from "../src/lib/search/provider";

class MockSearchProvider implements SearchProvider {
  public readonly name = "serper-mock";
  async search(query: string) {
    return [
      {
        title: "Italian government approves Meloni youth decree targeting juvenile crime",
        url: "https://ansa.it/english/news/meloni-decree-youth-crime",
        snippet: "Cabinet passed youth decree cracking down on youth crime for youths aged 14-17.",
        domain: "ansa.it",
        publishedAt: "2023-09-08",
      },
    ];
  }
}

async function run() {
  process.env.FAKENEWZZ_TRACE = "true";
  const url = "https://ansa.it/english/news/meloni-decree-youth-crime";

  const { result, tracePath } = await withTrace(async () => {
    traceStage("input", {
      inputType: "url",
      inputLength: url.length,
      preview: url,
    });

    // 1. Ingestion failure simulated (e.g. 403 Forbidden / anti-scraping gate)
    traceStage("ingestion_failure", {
      url,
      error: "403 Forbidden: Host blocked automated scraping",
      code: "FIRECRAWL_FAILED",
      hasMetadata: false,
    });

    // 2. Headline Recovery
    const provider = new MockSearchProvider();
    const recovery = await recoverHeadline(url, {
      metadata: null,
      searchProvider: provider,
    });

    traceStage("ingestion", {
      success: false,
      fallbackUsed: true,
      headlineSource: recovery?.headlineSource,
      title: recovery?.headline,
      sourceDomain: "ansa.it",
      wordCount: recovery?.headline.split(/\s+/).length,
      hasFeaturedImage: false,
      error: `Ingestion failed; recovered headline via ${recovery?.headlineSource}`,
    });

    // 3. Extracted claims from recovered headline
    const claims: ClaimInput[] = [
      {
        id: "claim-1",
        text: recovery!.headline,
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    traceStage("claims", claims);

    // 4. Multi-source search finds independent corroborating reporting
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "claim-1",
        title: "Italy cracks down on juvenile crime",
        snippet: "Minors aged 14-17 face stricter penalties under the new decree.",
        url: "https://reuters.com/world/europe/italy-youth-crime-decree",
        domain: "reuters.com",
        sourceType: "wire",
        sourceRelationship: "independent",
        relationship: "supporting",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: "2023-09-08",
        sourceContentStatus: "snippet_only",
      },
      {
        id: "ev2",
        claimId: "claim-1",
        title: "Italian youth crime package",
        snippet: "Cabinet passed package targeting delinquency among youths aged 14-17.",
        url: "https://corriere.it/politica/meloni-decreto-giovani",
        domain: "corriere.it",
        sourceType: "national_news",
        sourceRelationship: "independent",
        relationship: "supporting",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: "2023-09-08",
        sourceContentStatus: "snippet_only",
      },
    ];

    traceStage("search", [
      {
        claimId: "claim-1",
        queries: ["Meloni youth decree juvenile crime"],
        results: evidence.map((e) => ({
          title: e.title,
          url: e.url,
          domain: e.domain,
          snippetLength: e.snippet.length,
          publishedAt: e.publishedAt,
        })),
      },
    ]);

    // 5. Claim evaluation
    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Independently corroborated by Reuters and Corriere della Sera.",
        evidenceIds: ["ev1", "ev2"],
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    // 6. Build report
    const report = await buildReport(
      {
        title: recovery!.headline,
        sourceDomain: "ansa.it",
        url,
      },
      claims,
      evaluations,
      [],
      {
        evidence,
        sourceReadStatus: "unreadable",
        headlineSource: recovery!.headlineSource,
      }
    );

    traceStage("scoring", {
      claimContributions: report.evaluations.map((e) => ({
        claimId: e.claimId,
        verdict: e.verdict,
        confidence: e.confidence,
      })),
      sourceReadStatus: report.sourceReadStatus,
      headlineSource: report.headlineSource,
      finalScore: report.overallTrustScore,
      verdict: report.veracityVerdict,
      confidence: report.confidence,
      note: report.sourceReadNote,
    });

    return report;
  }, "meloni-decree-blocked-url-fallback");

  console.log(`Trace written to: ${tracePath}`);
  console.log(`Report verdict: ${result.veracityVerdict}`);
  console.log(`Overall Trust Score: ${result.overallTrustScore}`);
  console.log(`Source Read Status: ${result.sourceReadStatus}`);
  console.log(`Headline Source: ${result.headlineSource}`);
  console.log(`Source Read Note: ${result.sourceReadNote}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

