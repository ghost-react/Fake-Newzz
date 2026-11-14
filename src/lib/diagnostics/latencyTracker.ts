export interface StageMetric {
  name: string;
  durationMs: number;
  details?: Record<string, any>;
}

export class LatencyTracker {
  private startTime: number;
  private metrics: Map<string, StageMetric> = new Map();
  private serperCalls = 0;
  private firecrawlCalls = 0;
  private llmCalls = 0;
  private claimCount = 0;
  private evidenceCount = 0;

  constructor() {
    this.startTime = Date.now();
  }

  public recordFirecrawlCall() {
    this.firecrawlCalls++;
  }

  public recordSerperCall() {
    this.serperCalls++;
  }

  public recordLlmCall() {
    this.llmCalls++;
  }

  public setClaimCount(count: number) {
    this.claimCount = count;
  }

  public setEvidenceCount(count: number) {
    this.evidenceCount = count;
  }

  public async track<T>(
    name: string,
    operation: () => Promise<T>,
    details?: Record<string, any>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const durationMs = Date.now() - start;
      this.metrics.set(name, { name, durationMs, details });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      this.metrics.set(name, {
        name,
        durationMs,
        details: { ...details, error: true },
      });
      throw err;
    }
  }

  public trackSync<T>(
    name: string,
    operation: () => T,
    details?: Record<string, any>
  ): T {
    const start = Date.now();
    try {
      const result = operation();
      const durationMs = Date.now() - start;
      this.metrics.set(name, { name, durationMs, details });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      this.metrics.set(name, {
        name,
        durationMs,
        details: { ...details, error: true },
      });
      throw err;
    }
  }

  public printReport(): string {
    const totalMs = Date.now() - this.startTime;
    const toSeconds = (ms: number) => (ms / 1000).toFixed(2) + "s";

    const ingestionMs = this.metrics.get("article_ingestion")?.durationMs || 0;
    const claimsMs = this.metrics.get("claim_extraction")?.durationMs || 0;
    const searchMetric = this.metrics.get("search");
    const searchMs = searchMetric?.durationMs || 0;
    const rankingMs = this.metrics.get("evidence_ranking")?.durationMs || 0;
    const retrievalMetric = this.metrics.get("source_retrieval");
    const retrievalMs = retrievalMetric?.durationMs || 0;
    const evalMetric = this.metrics.get("claim_evaluation");
    const evalMs = evalMetric?.durationMs || 0;
    const contextMs = this.metrics.get("context_analysis")?.durationMs || 0;
    const scoreMs = this.metrics.get("scoring")?.durationMs || 0;
    const summaryMs = this.metrics.get("summary")?.durationMs || 0;

    // Find the bottleneck (stage with largest wall-clock time)
    const stageTimes: { name: string; ms: number }[] = [
      { name: "Article Ingestion (Firecrawl/Fetch)", ms: ingestionMs },
      { name: "Claim Extraction", ms: claimsMs },
      { name: "Multi-Source Search (Serper)", ms: searchMs },
      { name: "Evidence Ranking", ms: rankingMs },
      { name: "Source Content Retrieval", ms: retrievalMs },
      { name: "Claim Evaluation (AI/LLM)", ms: evalMs },
      { name: "Context / Omission Analysis (AI/LLM)", ms: contextMs },
      { name: "Deterministic Scoring", ms: scoreMs },
      { name: "Summary Generation", ms: summaryMs },
    ];

    stageTimes.sort((a, b) => b.ms - a.ms);
    const bottleneck = stageTimes[0];

    const report = [
      "=== FakeNewzz Latency Diagnostic ===",
      "",
      `TOTAL: ${toSeconds(totalMs)}`,
      "",
      `Article ingestion: ${toSeconds(ingestionMs)}`,
      `Claim extraction: ${toSeconds(claimsMs)}`,
      "",
      "Search:",
      `  requests: ${this.serperCalls}`,
      `  total wall time: ${toSeconds(searchMs)}`,
      `  slowest request: ${toSeconds(searchMetric?.details?.slowestMs || searchMs)}`,
      `  sequential/parallel behavior: ${searchMetric?.details?.mode || "batch concurrent"}`,
      "",
      `Evidence ranking: ${toSeconds(rankingMs)}`,
      "",
      "Source retrieval:",
      `  requests: ${this.firecrawlCalls}`,
      `  unique URLs: ${retrievalMetric?.details?.uniqueUrls || 0}`,
      `  total wall time: ${toSeconds(retrievalMs)}`,
      `  slowest request: ${toSeconds(retrievalMetric?.details?.slowestMs || 0)}`,
      `  duplicate fetches: ${retrievalMetric?.details?.duplicates || 0}`,
      "",
      "Claim evaluation:",
      `  batches: ${evalMetric?.details?.batches || 1}`,
      `  total wall time: ${toSeconds(evalMs)}`,
      `  slowest batch: ${toSeconds(evalMetric?.details?.slowestBatchMs || evalMs)}`,
      "",
      `Context analysis: ${toSeconds(contextMs)}`,
      `Summary: ${toSeconds(summaryMs)}`,
      `Scoring: ${toSeconds(scoreMs)}`,
      "",
      `LLM calls: ${this.llmCalls}`,
      `Serper calls: ${this.serperCalls}`,
      `Firecrawl calls: ${this.firecrawlCalls}`,
      `Claims analyzed: ${this.claimCount}`,
      `Evidence citations: ${this.evidenceCount}`,
      "",
      "BOTTLENECK:",
      `${bottleneck.name} (${toSeconds(bottleneck.ms)}, ${(
        (bottleneck.ms / Math.max(1, totalMs)) *
        100
      ).toFixed(1)}% of total time)`,
      "=====================================",
    ].join("\n");

    console.log("\n" + report + "\n");
    return report;
  }
}

