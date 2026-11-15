import { NextRequest, NextResponse } from "next/server";
import { ingestArticle, validateSafeUrl } from "@/lib/ingestion/article";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { searchMultipleClaims } from "@/lib/search/searchClaims";
import { SerperProvider } from "@/lib/search/serper";
import { rankEvidenceForClaim } from "@/lib/search/rankEvidence";
import { evaluateClaims } from "@/lib/verification/evaluateClaims";
import { analyzeArticleContext } from "@/lib/verification/contextAnalysis";
import { buildReport } from "@/lib/verification/buildReport";
import { auditReport } from "@/lib/verification/auditReport";
import { LatencyTracker } from "@/lib/diagnostics/latencyTracker";
import { VerificationDiagnostics } from "@/lib/diagnostics/verificationDiagnostics";
import { determineVerdictWithRule } from "@/lib/scoring/determineVerdict";
import {
  IMPORTANCE_WEIGHTS,
  CONFIDENCE_MULTIPLIERS,
  OMISSION_BASE_PENALTIES,
} from "@/lib/scoring/calculateScore";
import {
  isTracingEnabled,
  getActiveTrace,
  traceStage,
  withTrace,
} from "@/lib/debug/trace";
import { VerificationReport } from "@/schemas/verification";
import { ComparisonReport } from "@/schemas/comparison";
import { isComparisonEnabled } from "@/lib/comparison/config";
import { clusterEvidenceIndependence } from "@/lib/comparison/independence";
import { compareClaimsAcrossClusters } from "@/lib/comparison/compareClaims";
import { Article } from "@/schemas/article";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import { recoverHeadline, HeadlineSource } from "@/lib/ingestion/headlineRecovery";
import { parseAndAnalyzeInput, validateInput } from "@/lib/input/detectInputType";
import { decomposeStatementClaims, detectStatementIntent } from "@/lib/verification/statementIntent";
import { inferClaimCertainty } from "@/lib/verification/claimExtractor";
import { applyRouteGuard, sanitizeErrorMessage } from "@/lib/ratelimit/limiter";

export const maxDuration = 300;

/**
 * Deterministically extracts atomic testable assertions from an ingested article.
 */
function extractClaimsFromArticle(article: {
  title?: string;
  description?: string | null;
  content?: string;
}): ClaimInput[] {
  const claims: ClaimInput[] = [];

  // Claim 1: Headline assertion (High importance)
  if (article.title && article.title.trim()) {
    claims.push({
      id: "claim-1",
      text: article.title.trim(),
      importance: "high",
      claimType: "event",
    });
  }

  // Claim 2: Description assertion if distinct (Medium importance)
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

  // Claim 3 & 4: Core factual sentences from content
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

/**
 * Derives headline text from URL path/slug when page ingestion is blocked or fails.
 */
function extractHeadlineFromUrlSlug(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    let bestSegment = "";
    for (const seg of segments) {
      const clean = seg.replace(/\.(cms|html|htm|php|asp|aspx)$/i, "");
      if (clean.includes("-") || clean.includes("_")) {
        if (clean.length > bestSegment.length) {
          bestSegment = clean;
        }
      }
    }

    if (!bestSegment && segments.length > 0) {
      bestSegment = segments[segments.length - 1].replace(/\.(cms|html|htm|php|asp|aspx)$/i, "");
    }

    const words = bestSegment
      .replace(/[-_]+/g, " ")
      .replace(/\b\d+\b/g, (m) => (m.length > 4 ? "" : m))
      .trim();

    if (words.length >= 8) {
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  } catch {}
  return null;
}

/**
 * POST /api/verify
 *
 * Orchestrates Phase 7 end-to-end verification pipeline:
 * URL -> Ingest -> Extract Claims -> Search -> Rank Evidence -> Evaluate Claims -> Context Analysis -> Deterministic Scoring -> Verdict -> Summary -> VerificationReport
 */
export async function POST(request: NextRequest) {
  if (isTracingEnabled() && !getActiveTrace()) {
    const { result } = await withTrace(async () => handlePost(request));
    return result;
  }
  return handlePost(request);
}

async function handlePost(request: NextRequest) {
  // Rate limit and daily budget protection
  const guard = await applyRouteGuard(request, "verify", { maxRequests: 15, windowSeconds: 60 }, 1);
  if (guard) return guard;

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request payload must be valid JSON.",
          },
        },
        { status: 400 }
      );
    }

    // ── CASE A: Pre-evaluated inputs (from step-by-step pipeline) ──────────────
    if (body.claims && Array.isArray(body.claims) && body.evaluations && Array.isArray(body.evaluations)) {
      const articleTitle = body.articleTitle || body.article?.title || "Analyzed Article";
      const sourceDomain = body.sourceDomain || body.article?.sourceDomain || "unknown";
      const featuredImage = body.featuredImage || body.article?.featuredImage || null;
      const articleUrl = body.articleUrl || body.url || body.article?.url || null;
      const author = body.author || body.article?.author || null;
      const publishedAt = body.publishedAt || body.article?.publishedAt || null;
      const claims: ClaimInput[] = body.claims;
      const evaluations: ClaimEvaluation[] = body.evaluations;
      const omissions: Omission[] = Array.isArray(body.omittedContext)
        ? body.omittedContext
        : Array.isArray(body.omissions)
        ? body.omissions
        : [];

      let comparisonReport: ComparisonReport | undefined;
      const evidence = Array.isArray(body.evidence) ? body.evidence : undefined;
      if (evidence && isComparisonEnabled()) {
        try {
          const clusters = clusterEvidenceIndependence(evidence);
          comparisonReport = await compareClaimsAcrossClusters(claims, evidence, clusters, {
            articleText: body.article?.content || body.content,
          });
        } catch {
          comparisonReport = undefined;
        }
      }

      const report = await buildReport(
        {
          title: articleTitle,
          sourceDomain,
          featuredImage,
          url: articleUrl,
          author,
          publishedAt,
        },
        claims,
        evaluations,
        omissions,
        {
          evidence,
          comparison: comparisonReport,
          sourceReadStatus: body.sourceReadStatus || body.article?.sourceReadStatus,
          sourceReadNote: body.sourceReadNote,
          headlineSource: body.headlineSource || body.article?.headlineSource,
        }
      );

      return NextResponse.json(report, { status: 200 });
    }

    // ── CASE B: Full Verification Flow (URL or Direct Headline/Claim/Text) ────
    const tracker = new LatencyTracker();
    const diagnostics = new VerificationDiagnostics();

    const rawInput =
      typeof body?.input === "string" && body.input.trim()
        ? body.input.trim()
        : typeof body?.url === "string" && body.url.trim()
        ? body.url.trim()
        : "";

    if (!rawInput) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "A valid news article URL, headline, or claim must be provided.",
          },
        },
        { status: 400 }
      );
    }

    const validation = validateInput(rawInput);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: {
            code: validation.errorCode || "INVALID_INPUT",
            message: validation.errorMessage || "Invalid input provided.",
          },
        },
        { status: 400 }
      );
    }

    const parsedInput = parseAndAnalyzeInput(rawInput, body?.inputType);

    try {
      traceStage("input", {
        inputType: parsedInput.type,
        inputLength: rawInput.length,
        preview: rawInput.slice(0, 200),
        extractedUrl: parsedInput.extractedUrl,
        hasContext: Boolean(parsedInput.surroundingContext),
      });
    } catch {}

    let isIngestionFallback = false;
    let sourceReadStatus:
      | "success"
      | "partial"
      | "failed"
      | "insufficient"
      | "readable"
      | "unreadable"
      | "could_not_read" = "success";
    let sourceReadNote: string | undefined;
    let headlineSource: HeadlineSource | null = null;
    let article: Article;
    let claims: ClaimInput[];

    if (parsedInput.type === "url" && parsedInput.url) {
      const rawUrl = parsedInput.url;

      // 1. SSRF & Protocol Safety Check strictly for URLs
      const urlValidation = validateSafeUrl(rawUrl);
      if (!urlValidation.isValid || !urlValidation.sanitizedUrl) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_URL",
              message:
                urlValidation.errorMessage ||
                "Please provide a valid, publicly accessible HTTP or HTTPS URL.",
            },
          },
          { status: 400 }
        );
      }

      // 2. Ingest Article
      try {
        tracker.recordFirecrawlCall();
        article = await tracker.track("article_ingestion", () =>
          ingestArticle(urlValidation.sanitizedUrl!)
        );
        sourceReadStatus = article.sourceReadStatus || "success";
        isIngestionFallback = false;
        sourceReadNote = undefined;
        try {
          traceStage("ingestion", {
            success: true,
            title: article.title,
            sourceDomain: article.sourceDomain,
            wordCount: article.wordCount,
            hasFeaturedImage: Boolean(article.featuredImage),
            sourceReadStatus,
            error: null,
          });
        } catch {}
      } catch (err: any) {
        // 1. Detect: when ingestion fails, record failure reason in trace
        try {
          traceStage("ingestion_failure", {
            url: urlValidation.sanitizedUrl!,
            error: err?.message || String(err),
            code: err?.code,
            hasMetadata: Boolean(err?.metadata),
          });
        } catch {}

        // 2. Recover headline in priority order:
        //    a. metadata
        //    b. search for exact URL
        //    c. URL slug cleaned into words
        let recovery = null;
        try {
          const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key;
          const searchProvider = apiKey ? new SerperProvider(apiKey) : null;
          recovery = await recoverHeadline(urlValidation.sanitizedUrl!, {
            metadata: err?.metadata,
            searchProvider,
          });
        } catch {}

        const domain = new URL(urlValidation.sanitizedUrl!).hostname.replace(/^www\./i, "");

        if (!recovery || !recovery.headline) {
          try {
            traceStage("ingestion", {
              success: false,
              title: null,
              sourceDomain: domain,
              wordCount: 0,
              hasFeaturedImage: false,
              error: "Ingestion failed and no headline could be recovered",
            });
          } catch {}

          return NextResponse.json(
            {
              articleTitle: "Couldn't read this article",
              sourceDomain: domain,
              articleUrl: urlValidation.sanitizedUrl!,
              featuredImage: null,
              author: null,
              publishedAt: null,
              overallTrustScore: 0,
              veracityVerdict: "could_not_read",
              confidence: "low",
              summary: "We couldn't read the original article, and no story could be identified from the URL. Please paste the headline or text.",
              claimSummary: { total: 0, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 0 },
              evaluations: [],
              omittedContext: [],
              scoreBreakdown: { claimScore: 0, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 0 },
              sourceReadStatus: "could_not_read",
              sourceReadNote: "Couldn't read this article. Ingestion failed and no headline could be derived from the URL.",
            },
            { status: 200 }
          );
        }

        // Fallback: use recovered headline and run verification on that
        isIngestionFallback = true;
        sourceReadStatus = "unreadable";
        headlineSource = recovery.headlineSource;
        sourceReadNote =
          recovery.headlineSource === "url_slug"
            ? "We couldn't read the original article, so this check is based on independent reporting of the same story. The headline was inferred from the link."
            : "We couldn't read the original article, so this check is based on independent reporting of the same story.";

        article = {
          title: recovery.headline,
          description: recovery.snippet || null,
          sourceDomain: domain,
          url: urlValidation.sanitizedUrl!,
          content: recovery.snippet || recovery.headline,
          wordCount: (recovery.snippet || recovery.headline).split(/\s+/).filter(Boolean).length,
          sourceReadStatus: "unreadable",
          headlineSource: recovery.headlineSource,
        } as Article;

        try {
          traceStage("ingestion", {
            success: false,
            fallbackUsed: true,
            headlineSource: recovery.headlineSource,
            title: recovery.headline,
            sourceDomain: domain,
            wordCount: article.wordCount,
            hasFeaturedImage: false,
            error: `Ingestion failed; recovered headline via ${recovery.headlineSource}`,
          });
        } catch {}
      }

      // 3. Extract Atomic Claims from article
      claims = tracker.trackSync("claim_extraction", () =>
        extractClaimsFromArticle(article)
      );
    } else {
      // ── Non-URL Input (Headline, Claim, or Text) ──────────────────────────
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

      try {
        traceStage("ingestion", {
          success: true,
          inputType: parsedInput.type,
          title: article.title,
          sourceDomain: article.sourceDomain,
          wordCount: article.wordCount,
          hasFeaturedImage: false,
          error: null,
        });
      } catch {}

      // Extract claims depending on type
      if (parsedInput.type === "claim") {
        claims = tracker.trackSync("claim_extraction", () =>
          decomposeStatementClaims(rawInput, "claim")
        );
      } else if (parsedInput.type === "headline") {
        const intent = detectStatementIntent(rawInput);
        if (intent.isAttributedStatement) {
          claims = tracker.trackSync("claim_extraction", () =>
            decomposeStatementClaims(rawInput, "claim")
          );
        } else {
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
        }
      } else {
        // Multi-line / paragraph text
        claims = tracker.trackSync("claim_extraction", () =>
          extractClaimsFromArticle(article)
        );
      }
    }
    tracker.setClaimCount(claims.length);
    diagnostics.setClaims(claims.length);
    try {
      traceStage("claims", claims.map((c) => ({
        id: c.id,
        text: c.text,
        importance: c.importance,
        claimType: c.claimType,
      })));
    } catch {}

    // 4. Retrieve Evidence via Multi-Source Search
    let searchResults;
    const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "CONFIG_ERROR",
            message: "Search provider configuration (SERPER_API_KEY) is missing on the server.",
          },
        },
        { status: 500 }
      );
    }

    try {
      const provider = new SerperProvider(apiKey);
      claims.forEach(() => tracker.recordSerperCall());
      searchResults = await tracker.track("search", () =>
        searchMultipleClaims(claims, provider, {
          limit: 5,
          timeoutMs: 10000,
          articleContext: {
            title: article.title,
            text: article.content,
          },
        })
      );
      const totalQueries = searchResults.reduce((acc, sr) => acc + (sr.queries?.length || 0), 0);
      diagnostics.setQueries(totalQueries);
      const totalRawItems = searchResults.reduce((acc, sr) => acc + (sr.evidence?.length || 0), 0);
      diagnostics.setSearchResults(totalRawItems);

      try {
        traceStage("search", searchResults.map((sr) => ({
          claimId: sr.claimId,
          queries: sr.queries || [],
          results: (sr.evidence || []).map((e) => ({
            title: e.title,
            url: e.url,
            domain: e.domain,
            snippetLength: e.snippet ? e.snippet.length : 0,
            publishedAt: e.publishedAt ?? null,
          })),
        })));
      } catch {}
    } catch (err: any) {
      return NextResponse.json(
        {
          error: {
            code: err?.code || "SEARCH_ERROR",
            message: err?.message || "Failed to retrieve evidence from search provider.",
          },
        },
        { status: 502 }
      );
    }

    // 5. Rank Evidence per Claim
    const allRankedEvidence = tracker.trackSync("evidence_ranking", () => {
      const rankedEvidenceByClaim = new Map<string, Evidence[]>();
      for (const sr of searchResults) {
        const claim = claims.find((c) => c.id === sr.claimId) || {
          id: sr.claimId,
          text: sr.claimId,
        };
        const ranked = rankEvidenceForClaim(claim, sr.evidence);
        rankedEvidenceByClaim.set(sr.claimId, ranked);
      }
      return Array.from(rankedEvidenceByClaim.values()).flat();
    });
    tracker.setEvidenceCount(allRankedEvidence.length);
    diagnostics.setRetainedEvidence(allRankedEvidence.length);
    const domains = allRankedEvidence.map((e) => e.domain);
    const independentCount = allRankedEvidence.filter((e) => e.sourceRelationship === "independent" || e.sourceRelationship === "original").length;
    const syndicatedCount = allRankedEvidence.filter((e) => e.sourceRelationship === "syndicated" || e.sourceRelationship === "cites_other_source").length;
    diagnostics.setDomainAnalysis(domains, independentCount, syndicatedCount);

    // If fallback was used and search returned zero usable evidence:
    if (isIngestionFallback && allRankedEvidence.length === 0) {
      return NextResponse.json(
        {
          articleTitle: article.title || "Couldn't read this article",
          sourceDomain: article.sourceDomain,
          articleUrl: article.url || null,
          featuredImage: null,
          author: null,
          publishedAt: null,
          overallTrustScore: 0,
          veracityVerdict: "could_not_read",
          confidence: "low",
          summary: "We couldn't read this article and found no independent reporting. Please paste the headline or key claims directly to verify this story.",
          claimSummary: { total: 0, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 0 },
          evaluations: [],
          omittedContext: [],
          scoreBreakdown: { claimScore: 0, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 0 },
          sourceReadStatus: "could_not_read",
          sourceReadNote: "Couldn't read this article. Ingestion failed and no independent reporting was found. Please paste the headline or text.",
        },
        { status: 200 }
      );
    }

    // Ensure blocked original URL is never treated as evidence
    const evidenceToEvaluate = isIngestionFallback && article.url
      ? allRankedEvidence.filter((e) => e.url !== article.url)
      : allRankedEvidence;

    // 6. Claim Evaluation (Phase 5)
    tracker.recordLlmCall();
    const { evaluations, evidence: evaluatedEvidence } = await tracker.track(
      "claim_evaluation",
      () => evaluateClaims(claims, evidenceToEvaluate)
    );
    const successfulRetrievals = evaluatedEvidence.filter((e) => e.sourceContentStatus === "retrieved").length;
    const failedRetrievals = evaluatedEvidence.filter((e) => e.sourceContentStatus === "failed").length;
    diagnostics.setRetrievalStats(successfulRetrievals, failedRetrievals);

    // 7. Material Context & Omission Analysis (Phase 6)
    let omissions: Omission[] = [];
    try {
      tracker.recordLlmCall();
      omissions = await tracker.track("context_analysis", () =>
        analyzeArticleContext(
          article,
          claims,
          evaluatedEvidence,
          evaluations
        )
      );
    } catch {
      // Graceful fallback: omission failure does not crash the verification report
      omissions = [];
    }

    // 7.5 Cross-Source Comparison Engine (Shadow mode, Prompt 10)
    let comparisonReport: ComparisonReport | undefined;
    if (isComparisonEnabled()) {
      try {
        const clusters = clusterEvidenceIndependence(evaluatedEvidence);
        comparisonReport = await tracker.track("comparison", () =>
          compareClaimsAcrossClusters(claims, evaluatedEvidence, clusters, {
            articleText: article.content,
          })
        );
      } catch {
        // Shadow mode must never fail or block verification
        comparisonReport = undefined;
      }
    }

    // 8. Deterministic Scoring, Verdict, Summary & Final Verification Report (Phase 7)
    tracker.recordLlmCall(); // Summary generation
    const report: VerificationReport = await tracker.track("scoring", () =>
      buildReport(article, claims, evaluations, omissions, {
        evidence: evaluatedEvidence,
        comparison: comparisonReport,
        sourceReadStatus,
        sourceReadNote,
        headlineSource,
      })
    );
    diagnostics.setClaimEvaluations(report.claimSummary);
    const verdictDetail = determineVerdictWithRule(report.overallTrustScore, claims, evaluations, omissions);
    diagnostics.setVerdictResult(report.overallTrustScore, report.veracityVerdict, verdictDetail.rule);

    try {
      traceStage("scoring", {
        claimContributions: report.evaluations.map((e) => ({
          claimId: e.claimId,
          verdict: e.verdict,
          confidence: e.confidence,
        })),
        weightsApplied: {
          importanceWeights: IMPORTANCE_WEIGHTS,
          confidenceMultipliers: CONFIDENCE_MULTIPLIERS,
          omissionBasePenalties: OMISSION_BASE_PENALTIES,
        },
        omissionPenalty: report.scoreBreakdown.contextPenalty,
        confidenceAdjustment: report.scoreBreakdown.confidenceAdjustment,
        overridesFired: verdictDetail.rule
          ? [{ name: "verdict_rule", reason: verdictDetail.rule }]
          : [],
        finalScore: report.overallTrustScore,
        verdict: report.veracityVerdict,
      });
    } catch {}

    // 9. Traceability Audit (Phase 8)
    tracker.trackSync("audit", () => {
      const audit = auditReport(report, claims, evaluatedEvidence);
      if (!audit.isValid) {
        console.warn("[auditReport] Traceability audit warnings:", audit.errors);
      }
      return audit;
    });

    // 10. Print Development Latency & Diagnostics Reports
    tracker.printReport();
    diagnostics.printSummary();

    return NextResponse.json(report, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          code: "VERIFICATION_ERROR",
          message: sanitizeErrorMessage(
            err,
            "An unexpected error occurred during verification. Please try again later."
          ),
        },
      },
      { status: 500 }
    );
  }
}

