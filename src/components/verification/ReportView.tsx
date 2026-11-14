"use client";

import React, { useState } from "react";
import { VerificationReport, AtomicClaim } from "@/types/verification";
import { Article } from "@/schemas/article";
import { VerificationHero } from "@/components/verification/VerificationHero";
import { ContextAlert } from "@/components/verification/ContextAlert";
import { ClaimCard } from "@/components/verification/ClaimCard";
import { CoverageCard } from "@/components/verification/CoverageCard";
import { EvidenceTimeline } from "@/components/verification/EvidenceTimeline";
import {
  Layers,
  Newspaper,
  ShieldAlert,
  FileSearch,
  FileText,
  Copy,
  Check,
  Info,
} from "lucide-react";

interface ReportViewProps {
  report?: VerificationReport | null;
  article?: Article | null;
  onOpenMethodology: () => void;
}

// Sample placeholder claims for article retrieved stage (explicitly marked as pending verification)
const PLACEHOLDER_CLAIMS: AtomicClaim[] = [
  {
    id: "placeholder-claim-1",
    claimText: "Atomic assertion awaiting extraction from ingested article text",
    originalQuote: "Clean content retrieved. Extraction pipeline pending.",
    status: "UNVERIFIED",
    confidence: "LOW",
    evidenceSummary:
      "Real verification has not happened yet. The upcoming extraction pipeline will isolate testable claims from the article body.",
    sources: [],
  },
  {
    id: "placeholder-claim-2",
    claimText: "Secondary factual claim awaiting multi-source corroboration",
    originalQuote: "Content ingestion complete. Ready for live web search.",
    status: "UNVERIFIED",
    confidence: "LOW",
    evidenceSummary:
      "Real verification has not happened yet. Independent wire and primary gazette searches will corroborate this claim once verification runs.",
    sources: [],
  },
];

export function ReportView({
  report,
  article,
  onOpenMethodology,
}: ReportViewProps) {
  const [claimFilter, setClaimFilter] = useState<string>("ALL");
  const [copiedContent, setCopiedContent] = useState<boolean>(false);

  const isArticleMode = Boolean(article);

  // If in article retrieved mode, use placeholder claims clearly stating real verification has not happened yet
  const claimsToDisplay: AtomicClaim[] = isArticleMode
    ? (report?.atomicClaims && report.atomicClaims.length > 0
        ? report.atomicClaims
        : PLACEHOLDER_CLAIMS)
    : report?.atomicClaims || [];

  const filteredClaims = claimsToDisplay.filter((claim) => {
    if (claimFilter === "ALL") return true;
    return claim.status === claimFilter;
  });

  const handleCopyContent = () => {
    if (article?.content && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(article.content);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  return (
    <div className="w-full space-y-12 animate-in fade-in duration-500 pb-16">
      {/* 1. Verdict & Score Banner / Article Retrieved Hero */}
      <VerificationHero
        report={report}
        article={article}
        onOpenMethodology={onOpenMethodology}
      />

      {/* 2. EXTRACTED ARTICLE CONTENT SECTION (Rendered on successful article ingestion) */}
      {article && (
        <section className="space-y-4" aria-label="Extracted Article Text">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-mono uppercase text-slate-100 tracking-wider">
                  EXTRACTED ARTICLE CONTENT
                </h2>
                <p className="text-xs text-slate-400">
                  Clean ingested text from {article.sourceDomain} • Ready for verification
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 text-slate-400 border border-white/10">
                {article.wordCount.toLocaleString()} words
              </span>
              <button
                type="button"
                onClick={handleCopyContent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                {copiedContent ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Clean Scrollable Article Content */}
          <div className="rounded-2xl p-6 bg-slate-900/60 border border-white/10 backdrop-blur-xl max-h-[480px] overflow-y-auto space-y-4 font-mono text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
            {article.content}
          </div>
        </section>
      )}

      {/* 3. CLAIM ANALYSIS (Existing claim cards remain placeholder/mock, clearly indicating real verification has not occurred yet) */}
      <section className="space-y-4" aria-label="Claim Analysis">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-mono uppercase text-slate-100 tracking-wider">
                CLAIM ANALYSIS ({claimsToDisplay.length})
              </h2>
              <p className="text-xs text-slate-400">
                {isArticleMode
                  ? "Placeholder claim matrix — real verification has not occurred yet"
                  : "Atomic factual assertions cross-examined against live web ground truth"}
              </p>
            </div>
          </div>

          {/* Quick claim filter pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "VERIFIED", "CONTEXT_MISSING", "CONTRADICTED", "UNVERIFIED"].map(
              (filterKey) => {
                const count =
                  filterKey === "ALL"
                    ? claimsToDisplay.length
                    : claimsToDisplay.filter((c) => c.status === filterKey).length;

                if (count === 0 && filterKey !== "ALL") return null;

                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setClaimFilter(filterKey)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase transition-all cursor-pointer ${
                      claimFilter === filterKey
                        ? "bg-white/15 text-white border border-white/20 font-bold"
                        : "text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {filterKey.replace("_", " ")} ({count})
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Informative Banner when in Article Retrieved Stage */}
        {isArticleMode && (
          <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-950/20 backdrop-blur-md flex items-start sm:items-center gap-3.5">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-300">
                  Article Retrieved • Real Verification Pending
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                  Placeholder Content
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Real verification has not happened yet. The claim cards below are placeholder mock demonstrations of the atomic claim breakdown. Claim extraction, web cross-search, and stance scoring will occur in the verification phase.
              </p>
            </div>
          </div>
        )}

        {/* Claim Cards Stack */}
        <div className="space-y-4">
          {filteredClaims.map((claim, index) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              index={index}
              initiallyExpanded={index === 0}
            />
          ))}
        </div>
      </section>

      {/* 4. MISSING CONTEXT (Follows Claim Analysis per spec) */}
      {report?.omittedContext && report.omittedContext.length > 0 && (
        <section className="space-y-4" aria-label="Missing Context">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-mono uppercase text-amber-300 tracking-wider">
                MISSING CONTEXT ({report.omittedContext.length})
              </h2>
              <p className="text-xs text-slate-400">
                Critical qualifiers, thresholds, or official exemptions suppressed in the story
              </p>
            </div>
          </div>

          <ContextAlert items={report.omittedContext} />
        </section>
      )}

      {/* 5. COVERAGE COMPARISON (Multi-Outlet Grid per spec) */}
      {report?.coverageComparison && report.coverageComparison.length > 0 && (
        <section className="space-y-4" aria-label="Coverage Comparison">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-white/10 text-sky-400">
              <Newspaper className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-mono uppercase text-slate-100 tracking-wider">
                COVERAGE COMPARISON ({report.coverageComparison.length})
              </h2>
              <p className="text-xs text-slate-400">
                Side-by-side headline & framing analysis across international, independent, and official sources
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {report.coverageComparison.map((item) => (
              <CoverageCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* 6. Chronological Evidence Timeline */}
      {report?.timeline && report.timeline.length > 0 && (
        <section aria-label="Evidence Timeline">
          <EvidenceTimeline events={report.timeline} />
        </section>
      )}

      {/* 7. Methodology Audit Transparency Summary / Pipeline Roadmap */}
      {report?.methodologyAudit ? (
        <section
          aria-label="Audit & Evidence Statistics"
          className="glass-card rounded-2xl p-6 border border-white/10 bg-slate-900/40"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <FileSearch className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Evidence Transparency & Audit Summary
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Verification completed at {report.methodologyAudit.checkedAt} • Traceable Citations
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="block text-xl font-bold font-mono text-emerald-400">
                  {report.methodologyAudit.primarySourcesCount}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Primary Records
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="block text-xl font-bold font-mono text-sky-400">
                  {report.methodologyAudit.wireServicesCount}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Wire Services
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="block text-xl font-bold font-mono text-indigo-400">
                  {report.methodologyAudit.independentSourcesCount}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Independent Press
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="block text-xl font-bold font-mono text-slate-200">
                  {report.methodologyAudit.totalEvidenceCitations}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Total Citations
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : isArticleMode ? (
        <section
          aria-label="Pipeline Roadmap"
          className="glass-card rounded-2xl p-6 border border-emerald-500/20 bg-emerald-950/10 text-center sm:text-left"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Article Ingestion Pipeline Complete
                </h4>
                <p className="text-xs text-slate-400">
                  Article content and metadata retrieved and validated. Ready for claim verification.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-xs">
              <span>Status:</span>
              <span className="font-bold">Article Ready</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
