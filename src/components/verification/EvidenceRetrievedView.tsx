"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  Globe,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  FileText,
} from "lucide-react";
import { ClaimSearchResult, ClaimInput } from "@/schemas/evidence";
import { Article } from "@/schemas/article";

interface EvidenceRetrievedViewProps {
  claims: ClaimInput[];
  results: ClaimSearchResult[];
  article?: Article | null;
  onReset: () => void;
  onRetrySearch?: () => void;
  onEvaluateClaims?: () => void;
  isEvaluating?: boolean;
}

export function EvidenceRetrievedView({
  claims,
  results,
  article,
  onReset,
  onRetrySearch,
  onEvaluateClaims,
  isEvaluating = false,
}: EvidenceRetrievedViewProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string>("ALL");

  const totalSourcesFound = results.reduce(
    (acc, cur) => acc + cur.evidence.length,
    0
  );

  const displayResults =
    selectedClaimId === "ALL"
      ? results
      : results.filter((r) => r.claimId === selectedClaimId);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in-50 duration-500 pb-16">
      {/* 1. Top Action & Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            New Search
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            Independent Sources Retrieved
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRetrySearch && (
            <button
              type="button"
              onClick={onRetrySearch}
              disabled={isEvaluating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3 text-sky-400" />
              Re-run Search
            </button>
          )}

          {onEvaluateClaims && (
            <button
              type="button"
              onClick={onEvaluateClaims}
              disabled={isEvaluating}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Evaluate Claims</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Phase 3 Scope & Neutral Evidence Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-950/20 backdrop-blur-xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                Evidence Discovery Stage
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {claims.length} claim{claims.length > 1 ? "s" : ""} analyzed
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-editorial font-bold text-white tracking-tight">
              Multi-Source Evidence Retrieved
            </h1>
          </div>

          <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/10 self-start sm:self-auto">
            <div className="text-right">
              <span className="block text-xl font-bold font-mono text-sky-400">
                {totalSourcesFound}
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                Total Sources
              </span>
            </div>
          </div>
        </div>

        {/* Explicit Zero-Verdict Notice */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          FakeNewzz has retrieved broad public web sources (government notices, official portals,
          reputable news wires, and archives) for each atomic assertion.{" "}
          <strong className="text-white">
            At this stage, results represent raw evidence only: veracity verdicts (True / False),
            trust scores, and stance classifications are intentionally deferred to subsequent analysis.
          </strong>
        </p>

        {article && (
          <div className="pt-2 text-xs text-slate-400 flex items-center gap-2 font-mono">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ingested Article:</span>
            <span className="text-slate-200 truncate max-w-md">{article.title}</span>
          </div>
        )}
      </div>

      {/* 3. Filter Claims Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            Claims & Corroborating Sources
          </h2>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedClaimId("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              selectedClaimId === "ALL"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold"
                : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
            }`}
          >
            ALL CLAIMS ({claims.length})
          </button>
          {claims.map((claim, idx) => (
            <button
              key={claim.id}
              type="button"
              onClick={() => setSelectedClaimId(claim.id)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                selectedClaimId === claim.id
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              C{idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Claim and Evidence Cards List */}
      <div className="space-y-8">
        {displayResults.map((result, claimIdx) => {
          const matchingClaim = claims.find((c) => c.id === result.claimId);
          const hasEvidence = result.evidence.length > 0;

          return (
            <section
              key={result.claimId}
              className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl shadow-lg"
              aria-label={`Claim ${claimIdx + 1} Evidence`}
            >
              {/* Claim Header */}
              <div className="space-y-2 border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs font-mono font-bold text-sky-400 flex items-center justify-center">
                      C{claimIdx + 1}
                    </span>
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Atomic Assertion
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase">
                      Importance: {matchingClaim?.importance || "high"}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border bg-white/5 border-white/10 text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {hasEvidence
                        ? `Evidence found: ${result.evidence.length} sources`
                        : "No relevant evidence found"}
                    </span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-medium text-slate-100 leading-snug pt-1">
                  &ldquo;{matchingClaim?.text || result.claimId}&rdquo;
                </h3>

                {/* Search Queries Executed */}
                <div className="pt-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-400">
                    <Search className="w-3 h-3 text-slate-400 mr-1" />
                    <span className="text-slate-400">Search queries:</span>
                    {result.queries.map((q, qIdx) => (
                      <span
                        key={qIdx}
                        className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 text-[11px]"
                      >
                        &ldquo;{q}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Evidence Items Container */}
              {hasEvidence ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {result.evidence.map((ev, evIdx) => {
                    const formattedDate = ev.publishedAt
                      ? (() => {
                          try {
                            const d = new Date(ev.publishedAt);
                            return !isNaN(d.getTime())
                              ? d.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : ev.publishedAt;
                          } catch {
                            return ev.publishedAt;
                          }
                        })()
                      : null;

                    return (
                      <article
                        key={ev.id || evIdx}
                        className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3 hover:border-sky-500/40 hover:bg-white/[0.03] transition-all flex flex-col justify-between group"
                      >
                        <div className="space-y-2">
                          {/* Domain and Date Row */}
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                            <span className="text-sky-300 font-semibold group-hover:text-sky-200 transition-colors flex items-center gap-1">
                              <Globe className="w-3 h-3 text-sky-400" />
                              {ev.domain}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formattedDate || "Date not specified"}
                            </span>
                          </div>

                          {/* Title */}
                          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                            {ev.title}
                          </h4>

                          {/* Snippet */}
                          {ev.snippet && (
                            <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-3 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 italic">
                              &ldquo;{ev.snippet}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Card Footer: Source Type & Clickable External Link */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 uppercase">
                              {ev.sourceType ? ev.sourceType.replace(/_/g, " ") : "OTHER"}
                            </span>
                          </div>

                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono text-xs hover:underline transition-colors cursor-pointer"
                            title={`Open source at ${ev.domain}`}
                          >
                            <span>Open Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-white/10 bg-black/20 text-center space-y-2">
                  <div className="inline-flex p-2 rounded-full bg-slate-800 text-slate-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    No relevant evidence found
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    The search engine did not return matching organic public documents for the
                    generated queries.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 5. Phase 5 Call to Action Card */}
      <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-white font-bold text-sm block">
              Multi-Source Evidence Ready for Verification
            </span>
            <span className="text-slate-300 text-xs font-sans">
              {totalSourcesFound} source documents retrieved & ranked. Ready to evaluate individual claims.
            </span>
          </div>
        </div>

        {onEvaluateClaims && (
          <button
            type="button"
            onClick={onEvaluateClaims}
            disabled={isEvaluating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Evaluate Claims Against Evidence</span>
          </button>
        )}
      </div>
    </div>
  );
}
