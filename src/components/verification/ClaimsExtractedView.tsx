"use client";

import React from "react";
import {
  Layers,
  Search,
  Sparkles,
  ArrowLeft,
  FileText,
  Shield,
  Clock,
} from "lucide-react";
import { ClaimInput } from "@/schemas/evidence";
import { Article } from "@/schemas/article";

interface ClaimsExtractedViewProps {
  claims: ClaimInput[];
  article?: Article | null;
  onFindEvidence: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function ClaimsExtractedView({
  claims,
  article,
  onFindEvidence,
  onReset,
  isLoading = false,
}: ClaimsExtractedViewProps) {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in-50 duration-500 pb-16">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ingest Another
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5" />
          Key Claims Identified ({claims.length})
        </div>
      </div>

      {/* Hero Banner with Find Evidence CTA */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-slate-200 font-mono text-xs font-medium flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-sky-400" />
              {claims.length} Testable Claims Decomposed
            </span>
            {article && (
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 font-mono text-xs flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-emerald-400" />
                {article.sourceDomain}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-editorial font-bold text-white tracking-tight">
            Atomic Claims Ready for Evidence Search
          </h1>

          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            The article has been decomposed into individual, testable core statements. Click{" "}
            <strong className="text-white">&ldquo;Find Evidence&rdquo;</strong> to trigger multi-source
            web retrieval via Serper across government portals, wire services, news archives, and
            independent records.
          </p>
        </div>

        {/* Big Find Evidence CTA Button */}
        <div className="relative z-10 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button
            type="button"
            onClick={onFindEvidence}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-bold font-mono text-sm uppercase tracking-wider shadow-lg shadow-sky-500/20 hover:shadow-sky-500/35 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>Find Evidence</span>
          </button>

          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Executes targeted web search queries across institutional registries
          </span>
        </div>
      </div>

      {/* Extracted Claims Matrix */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            Extracted Assertions Matrix
          </h2>
        </div>

        <div className="space-y-3">
          {claims.map((claim, idx) => (
            <div
              key={claim.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-3.5 flex-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-slate-300 flex items-center justify-center mt-0.5">
                  C{idx + 1}
                </span>
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-medium text-slate-100 leading-snug">
                    &ldquo;{claim.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      Type: {claim.claimType}
                    </span>
                    <span>•</span>
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      Importance: {claim.importance}
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center">
                <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded bg-black/40 border border-white/5">
                  Awaiting Search
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
