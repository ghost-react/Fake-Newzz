"use client";

import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { SearchBar } from "@/components/verification/SearchBar";
import { LoadingVerification } from "@/components/verification/LoadingVerification";
import { ErrorState, ErrorType } from "@/components/verification/ErrorState";
import { MethodologyPanel } from "@/components/verification/MethodologyPanel";
import { getMockReport, MOCK_REPORTS } from "@/data/mockReports";
import { Article } from "@/schemas/article";
import { ClaimInput, ClaimSearchResult } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import { VerificationReport as LegacyReport, OmittedContext } from "@/types/verification";
import { VerificationReport as RealVerificationReport } from "@/schemas/verification";
import { FinalVerificationDashboard } from "@/components/verification/FinalVerificationDashboard";
import { deriveTone } from "@/lib/ui/tone";
import { decomposeStatementClaims } from "@/lib/verification/statementIntent";
import { inferClaimCertainty } from "@/lib/verification/claimExtractor";
import {
  detectInputType,
  parseAndAnalyzeInput,
  validateInput,
  isNonArticleUrl,
  DetectedInputType,
} from "@/lib/input/detectInputType";
import { isTextInputEnabled } from "@/lib/config/flags";
import { ShieldCheck } from "lucide-react";

/**
 * Consumer-facing verification stages
 */
export type VerificationStage = "idle" | "verifying" | "complete" | "error";

/**
 * Validates that an input string is a valid HTTP or HTTPS URL.
 */
function isValidHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Helper to adapt legacy mock reports into the strict VerificationReport structure
 */
function adaptLegacyReport(legacy: LegacyReport): RealVerificationReport {
  const veracityMap: Record<string, RealVerificationReport["veracityVerdict"]> = {
    VERIFIED: "verified_true",
    MOSTLY_TRUE: "mostly_true",
    CONTEXT_MISSING: "misleading",
    MISLEADING: "misleading",
    CONTRADICTED: "false",
    FALSE: "false",
    UNVERIFIED: "unverified",
  };

  const confidenceMap: Record<string, RealVerificationReport["confidence"]> = {
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
  };

  const supportingCount = legacy.atomicClaims.filter((c) => c.status === "VERIFIED").length;
  const contradictingCount = legacy.atomicClaims.filter((c) => c.status === "CONTRADICTED").length;
  const qualifyingCount = legacy.atomicClaims.filter((c) => c.status === "CONTEXT_MISSING").length;
  const insufficientCount = legacy.atomicClaims.filter((c) => c.status === "UNVERIFIED").length;

  return {
    articleTitle: legacy.articleTitle,
    sourceDomain: legacy.sourceDomain,
    overallTrustScore: legacy.overallTrustScore,
    veracityVerdict: veracityMap[legacy.verdict] || "unverified",
    confidence: confidenceMap[legacy.confidence] || "medium",
    summary: legacy.executiveSummary,
    claimSummary: {
      total: legacy.atomicClaims.length,
      supporting: supportingCount,
      contradicting: contradictingCount,
      qualifying: qualifyingCount,
      insufficient: insufficientCount,
    },
    evaluations: legacy.atomicClaims.map((claim) => ({
      claimId: claim.id,
      verdict:
        claim.status === "VERIFIED"
          ? "supporting"
          : claim.status === "CONTRADICTED"
          ? "contradicting"
          : claim.status === "CONTEXT_MISSING"
          ? "qualifying"
          : "insufficient",
      confidence: confidenceMap[claim.confidence] || "medium",
      explanation: claim.evidenceSummary,
      evidenceIds: claim.sources.map((s) => s.id),
      importantNotes: [],
    })),
    omittedContext: (legacy.omittedContext || []).map((alert: OmittedContext, i: number) => ({
      id: alert.id || `omission-${i + 1}`,
      claimId: null,
      type: "missing_context",
      severity: alert.impact === "CRITICAL" ? ("high" as const) : ("medium" as const),
      description: alert.title ? `${alert.title}: ${alert.description}` : alert.description,
      whyItMatters: alert.description || "Alters how the claim should be interpreted.",
      evidenceIds: [],
      confidence: "medium" as const,
    })),
    scoreBreakdown: {
      claimScore: legacy.overallTrustScore,
      contextPenalty: legacy.omittedContext && legacy.omittedContext.length > 0 ? 10 : 0,
      confidenceAdjustment: 0,
      finalScore: legacy.overallTrustScore,
    },
    featuredImage: legacy.featuredImageUrl || null,
    author: legacy.articleAuthor || null,
    publishedAt: legacy.publicationDate || null,
    articleUrl: legacy.inputQuery || null,
  };
}

export default function HomePage() {
  const [stage, setStage] = useState<VerificationStage>("idle");
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [loadingHeadline, setLoadingHeadline] = useState<string | null>(null);
  const [loadingClaimsCount, setLoadingClaimsCount] = useState<number | null>(null);
  const [loadingEvidenceCount, setLoadingEvidenceCount] = useState<number | null>(null);

  const [extractedArticle, setExtractedArticle] = useState<Article | null>(null);
  const [extractedClaims, setExtractedClaims] = useState<ClaimInput[]>([]);
  const [searchResults, setSearchResults] = useState<ClaimSearchResult[]>([]);

  const [realReport, setRealReport] = useState<RealVerificationReport | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string>("");
  const [error, setError] = useState<{ type: ErrorType; message: string } | null>(null);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(false);

  /**
   * Main Consumer Verification Journey:
   * Paste URL/Claim -> Brief Human Progress -> Trust Score + Full Report
   */
  /**
   * Main Consumer Verification Journey:
   * Paste URL/Claim/Headline/Text -> Brief Human Progress -> Trust Score + Full Report
   */
  const handleSearch = async (query: string, type?: any) => {
    // 1. Always clear previous results and errors when a new submission starts
    setError(null);
    setRealReport(null);
    setExtractedArticle(null);
    setExtractedClaims([]);
    setSearchResults([]);
    setPendingQuery(query);

    // 2. Validate input format and length
    const val = validateInput(query);
    if (!val.valid) {
      setError({
        type: "INVALID_URL",
        message:
          val.error ||
          (!isTextInputEnabled()
            ? "FakeNewzz currently checks news article links. Paste a link to the article."
            : "Please enter a valid news URL, headline, or claim to verify."),
      });
      setStage("error");
      return;
    }

    // 3. Detect and analyze input type (url, headline, claim, text)
    const analyzed = parseAndAnalyzeInput(val.sanitized, type);

    if (!isTextInputEnabled()) {
      if (analyzed.type !== "url" || !analyzed.url) {
        setError({
          type: "INVALID_URL",
          message: "FakeNewzz currently checks news article links. Paste a link to the article.",
        });
        setStage("error");
        return;
      }

      if (isNonArticleUrl(analyzed.url)) {
        setError({
          type: "INVALID_URL",
          message: "Paste the link to a specific article.",
        });
        setStage("error");
        return;
      }
    }

    // 4. Check for mock preset by exact key match
    if (MOCK_REPORTS[analyzed.text]) {
      setStage("verifying");
      setLoadingStep(0);
      setLoadingHeadline(analyzed.text);

      setTimeout(() => {
        const raw = MOCK_REPORTS[analyzed.text];
        const adapted = adaptLegacyReport(raw);
        setRealReport(adapted);
        setExtractedArticle(null);
        setExtractedClaims(
          raw.atomicClaims.map((c) => ({
            id: c.id,
            text: c.claimText,
            importance: "high",
            claimType: "factual",
          }))
        );
        setSearchResults([]);
        setStage("complete");

        const resultsEl = document.getElementById("verification-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 700);
      return;
    }

    // 5. Non-URL Verification Flow (headline, claim, text) - only if TEXT_INPUT_ENABLED
    if (isTextInputEnabled() && analyzed.type !== "url") {
      setStage("verifying");
      setLoadingStep(1);
      const headlineSnippet = analyzed.text.split("\n")[0].slice(0, 100);
      setLoadingHeadline(headlineSnippet);

      const claimsToVerify = decomposeStatementClaims(analyzed.text, analyzed.type);
      setLoadingClaimsCount(claimsToVerify.length);
      setExtractedClaims(claimsToVerify);

      try {
        // Step 2: Finding independent sources
        setLoadingStep(2);
        const searchRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claims: claimsToVerify }),
        });

        const searchData = await searchRes.json().catch(() => null);
        const results: ClaimSearchResult[] = searchData?.results || [];
        setSearchResults(results);
        const allEvidence = results.flatMap((sr) => sr.evidence);
        setLoadingEvidenceCount(allEvidence.length);

        // Step 3: Comparing the evidence
        setLoadingStep(3);
        const evalRes = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claims: claimsToVerify, evidence: allEvidence }),
        });

        const evalData = await evalRes.json().catch(() => null);
        const evals: ClaimEvaluation[] = evalData?.evaluations || [];

        // Step 4: Checking context
        setLoadingStep(4);
        const contextRes = await fetch("/api/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claims: claimsToVerify, evidence: allEvidence }),
        });
        const contextData = await contextRes.json().catch(() => null);
        const omits: Omission[] = contextData?.omissions || [];

        // Step 5: Preparing result
        setLoadingStep(5);
        const verifyRes = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleTitle: headlineSnippet,
            sourceDomain: "Independent Claim",
            claims: claimsToVerify,
            evaluations: evals,
            omissions: omits,
            evidence: allEvidence,
            input: analyzed.text,
            inputType: analyzed.type,
          }),
        });

        const reportData = await verifyRes.json().catch(() => null);
        if (verifyRes.ok && reportData?.overallTrustScore !== undefined) {
          setRealReport(reportData);
          setStage("complete");
          const resultsEl = document.getElementById("verification-results");
          if (resultsEl) {
            resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } else {
          throw new Error("Verification failed to generate final report.");
        }
      } catch {
        setStage("error");
        setError({
          type: "SERVER_ERROR",
          message: "We couldn't complete this verification. Please try again.",
        });
      }
      return;
    }

    // 6. Full URL Automated Verification Flow
    const targetUrl = analyzed.targetUrl || analyzed.text;
    setStage("verifying");
    setLoadingStep(0);
    setLoadingHeadline(null);
    setLoadingClaimsCount(null);
    setLoadingEvidenceCount(null);

    try {
      // Step 0: Reading the story
      const articleRes = await fetch("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const articleData = await articleRes.json().catch(() => null);

      if (!articleRes.ok || !articleData?.success || !articleData?.article) {
        const status = articleRes.status;
        setStage("error");
        if (status === 400) {
          setError({
            type: "INVALID_URL",
            message: "The provided link is invalid. Please check the address and try again.",
          });
        } else {
          setError({
            type: "EXTRACTION_FAILED",
            message:
              articleData?.error?.message ||
              "The publisher may block automated access or require a subscription. Try another link to the same story.",
          });
        }
        return;
      }

      const article: Article = articleData.article;
      setExtractedArticle(article);
      setLoadingHeadline(article.title);

      // Step 1: Identifying key claims
      setLoadingStep(1);
      const claimsRes = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article }),
      });

      const claimsData = await claimsRes.json().catch(() => null);
      if (!claimsRes.ok || !claimsData?.success || !Array.isArray(claimsData?.claims)) {
        setStage("error");
        setError({
          type: "SERVER_ERROR",
          message: "We couldn't identify verifiable claims in this article. Please try again.",
        });
        return;
      }

      const claims: ClaimInput[] = claimsData.claims;
      setExtractedClaims(claims);
      setLoadingClaimsCount(claims.length);

      // Step 2: Finding independent sources
      setLoadingStep(2);
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claims }),
      });

      const searchData = await searchRes.json().catch(() => null);
      if (!searchRes.ok || !searchData?.success) {
        setStage("error");
        setError({
          type: "NETWORK_ERROR",
          message: "We couldn't reach some sources right now. Try again in a moment.",
        });
        return;
      }

      const results: ClaimSearchResult[] = searchData.results || [];
      setSearchResults(results);
      const allEvidence = results.flatMap((sr) => sr.evidence);
      setLoadingEvidenceCount(allEvidence.length);

      // If original article was unreadable and no independent evidence could be found
      if (article.sourceReadStatus === "unreadable" && allEvidence.length === 0) {
        setStage("error");
        setError({
          type: "EXTRACTION_FAILED",
          message:
            "The publisher may block automated access or require a subscription. Try another link to the same story.",
        });
        return;
      }

      // Step 3: Comparing the evidence
      setLoadingStep(3);
      const evalRes = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claims, evidence: allEvidence }),
      });

      const evalData = await evalRes.json().catch(() => null);
      if (!evalRes.ok || !evalData?.success) {
        setStage("error");
        setError({
          type: "SERVER_ERROR",
          message: "We couldn't complete the evidence comparison. Please try again.",
        });
        return;
      }

      const evals: ClaimEvaluation[] = evalData.evaluations || [];

      // Step 4: Checking important context
      setLoadingStep(4);
      let omits: Omission[] = [];
      try {
        const contextRes = await fetch("/api/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article,
            claims,
            evidence: allEvidence,
            evaluations: evals,
          }),
        });
        const contextData = await contextRes.json().catch(() => null);
        if (contextRes.ok && contextData?.success) {
          omits = contextData.omissions || [];
        }
      } catch {
        // Soft fallback for context
      }

      // Step 5: Preparing your result
      setLoadingStep(5);
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          articleTitle: article.title,
          sourceDomain: article.sourceDomain,
          featuredImage: article.featuredImage,
          url: article.url,
          author: article.author,
          publishedAt: article.publishedAt,
          claims,
          evaluations: evals,
          omissions: omits,
          evidence: allEvidence,
          sourceReadStatus: article.sourceReadStatus,
          headlineSource: article.headlineSource,
        }),
      });

      const reportData = await verifyRes.json().catch(() => null);
      if (verifyRes.ok && reportData?.overallTrustScore !== undefined) {
        if (reportData.veracityVerdict === "could_not_read" || reportData.sourceReadStatus === "could_not_read") {
          setStage("error");
          setError({
            type: "EXTRACTION_FAILED",
            message:
              reportData.summary ||
              "The publisher may block automated access or require a subscription. Try another link to the same story.",
          });
          return;
        }

        setRealReport(reportData);
        setStage("complete");

        const resultsEl = document.getElementById("verification-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        throw new Error("Unable to construct final report.");
      }
    } catch {
      setStage("error");
      setError({
        type: "SERVER_ERROR",
        message: "We couldn't complete this verification. Please try again.",
      });
    }
  };

  /**
   * Sample selection from header or examples
   */
  const handleSelectSample = (id: string) => {
    if (MOCK_REPORTS[id]) {
      setError(null);
      setStage("verifying");
      setLoadingStep(0);
      setLoadingHeadline(MOCK_REPORTS[id].articleTitle);

      setTimeout(() => {
        const raw = MOCK_REPORTS[id];
        const adapted = adaptLegacyReport(raw);
        setRealReport(adapted);
        setExtractedArticle(null);
        setExtractedClaims(
          raw.atomicClaims.map((c) => ({
            id: c.id,
            text: c.claimText,
            importance: "high",
            claimType: "factual",
          }))
        );
        setSearchResults([]);
        setStage("complete");

        const resultsEl = document.getElementById("verification-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 700);
    }
  };

  const handleReset = () => {
    setError(null);
    setExtractedArticle(null);
    setExtractedClaims([]);
    setSearchResults([]);
    setRealReport(null);
    setPendingQuery("");
    setStage("idle");
  };

  const handleScrollToSearch = () => {
    const el = document.getElementById("search-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Header: Shown during search and loading stages; Results hero has its own integrated full-bleed top bar */}
      {stage !== "complete" && (
        <Header
          onOpenMethodology={() => setIsMethodologyOpen(true)}
          activeReportId={realReport?.articleTitle}
          onSelectSample={handleSelectSample}
          onScrollToSearch={handleScrollToSearch}
        />
      )}

      {stage === "complete" && realReport ? (
        <div
          id="verification-results"
          data-tone={deriveTone(realReport)}
          className="flex-1 w-full flex flex-col space-y-12 transition-colors duration-300 motion-reduce:transition-none"
        >
          <FinalVerificationDashboard
            report={realReport}
            article={extractedArticle}
            claims={extractedClaims}
            evidence={searchResults.flatMap((sr) => sr.evidence)}
            onReset={handleReset}
            onOpenMethodology={() => setIsMethodologyOpen(true)}
            onSearch={handleSearch}
          />
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
          {/* 2. Hero Section */}
          <section id="search-section" className="text-center space-y-6 pt-4 pb-2">
            <div className="space-y-3 max-w-3xl mx-auto">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-editorial font-bold text-white tracking-tight leading-[1.15]">
                Is this news trustworthy?
              </h1>

              <p className="text-sm sm:text-base text-[#A1A1AA] max-w-xl mx-auto leading-relaxed font-sans">
                Check the evidence before you believe or share it.
              </p>
            </div>

            {/* Unified Verification Input */}
            <div className="pt-2">
              <SearchBar
                onSearch={handleSearch}
                isLoading={stage === "verifying"}
                initialQuery=""
              />
            </div>

            {/* 3 feature statements below hero */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-3 text-xs font-mono text-[#717B89]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Evidence-based verification</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>Independent source comparison</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Missing context detection</span>
              </div>
            </div>
          </section>

          {/* 3. Dynamic Results / Progress Container */}
          <div id="verification-results" className="pt-2">
            {stage === "verifying" ? (
              /* Human-friendly loading screen */
              <LoadingVerification
                currentStage={loadingStep}
                articleTitle={loadingHeadline || pendingQuery}
                claimsCount={loadingClaimsCount}
                evidenceCount={loadingEvidenceCount}
              />
            ) : stage === "error" && error ? (
              /* User-friendly error state */
              <ErrorState
                type={error.type}
                message={error.message}
                onRetry={() => handleSearch(pendingQuery)}
                onReset={handleReset}
                onSearch={handleSearch}
              />
            ) : (
              /* Clean Empty State on Homepage */
              <div className="text-center py-16 px-4 space-y-4 max-w-lg mx-auto border-t border-white/[0.04]">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-editorial text-2xl font-bold text-[#F5F5F5]">
                  Paste a news article link above to check its trustworthiness.
                </h3>
                <p className="text-xs sm:text-sm text-[#A1A1AA] font-sans leading-relaxed">
                  FakeNewzz analyzes the article, cross-references independent primary records, and identifies missing context so you get a transparent, evidence-backed trust score.
                </p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Methodology Modal */}
      <MethodologyPanel
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />

      {/* Editorial Footer */}
      <footer className="border-t border-white/[0.08] bg-black/60 backdrop-blur-xl py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#717B89]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-editorial text-sm font-bold text-[#F5F5F5] block">
                FakeNewzz
              </span>
              <p className="text-[11px] text-[#717B89] font-mono">
                Verify what you read with independent evidence.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <button
              type="button"
              onClick={() => setIsMethodologyOpen(true)}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Methodology & Standards
            </button>
            <span className="text-slate-800">•</span>
            <span>Independent Sources</span>
            <span className="text-slate-800">•</span>
            <span className="text-emerald-400">Deterministic Scoring</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
