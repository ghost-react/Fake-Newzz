"use client";

import React from "react";
import { Check, Loader2, Globe, FileText, Database, ShieldCheck, Scale, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingVerificationProps {
  currentStage?: string | number; // "Reading article" | 0..5
  articleTitle?: string | null;
  claimsCount?: number | null;
  evidenceCount?: number | null;
}

export const VERIFICATION_STAGES = [
  {
    id: 0,
    title: "Reading article",
    description: "Extracting article content, author, and published source metadata",
    icon: Globe,
  },
  {
    id: 1,
    title: "Identifying key claims",
    description: "Isolating testable factual assertions across assertion layers",
    icon: FileText,
  },
  {
    id: 2,
    title: "Finding independent sources",
    description: "Searching primary records, national press, and wire services",
    icon: Database,
  },
  {
    id: 3,
    title: "Comparing evidence",
    description: "Cross-checking claims, detecting wire syndication, and comparing details",
    icon: Scale,
  },
  {
    id: 4,
    title: "Checking context",
    description: "Checking for omitted qualifications, baselines, and counter-evidence",
    icon: ShieldCheck,
  },
  {
    id: 5,
    title: "Preparing report",
    description: "Calculating deterministic trust score and compiling transparent breakdown",
    icon: Sparkles,
  },
];

export function LoadingVerification({
  currentStage = 0,
  articleTitle,
  claimsCount,
  evidenceCount,
}: LoadingVerificationProps) {
  // Convert stage name to index if string provided
  let activeIndex = 0;
  if (typeof currentStage === "number") {
    activeIndex = Math.max(0, Math.min(5, currentStage));
  } else if (typeof currentStage === "string") {
    const foundIdx = VERIFICATION_STAGES.findIndex(
      (s) => s.title.toLowerCase() === currentStage.toLowerCase()
    );
    if (foundIdx !== -1) {
      activeIndex = foundIdx;
    }
  }

  const progressPercent = Math.min(100, Math.round(((activeIndex + 1) / VERIFICATION_STAGES.length) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      data-tone="grey"
      data-testid="loading-verification"
      className="w-full max-w-2xl mx-auto my-10 p-6 sm:p-8 rounded-3xl bg-[#111923] border border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-xl"
    >
      {/* Background ambient lighting (neutral grey) */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-slate-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-slate-800/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 relative z-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/40 border border-slate-700/50 text-[#94A3B8] text-xs font-mono uppercase tracking-wider font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
          <span>Live Verification in Progress</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-editorial font-bold text-[#F5F5F5] tracking-tight">
          Verifying Article Claims
        </h2>

        {articleTitle && (
          <p className="text-xs sm:text-sm text-[#A1A1AA] line-clamp-1 italic max-w-lg mx-auto">
            &ldquo;{articleTitle}&rdquo;
          </p>
        )}
      </div>

      {/* Progress Bar (neutral grey) */}
      <div className="w-full bg-[#171E29] rounded-full h-1.5 mb-8 overflow-hidden relative z-10 border border-white/5">
        <div
          className="bg-[#94A3B8] h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Verification Stages */}
      <div className="space-y-3 relative z-10">
        {VERIFICATION_STAGES.map((stage) => {
          const isDone = stage.id < activeIndex;
          const isCurrent = stage.id === activeIndex;
          const isPending = stage.id > activeIndex;
          const Icon = stage.icon;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-start gap-4 p-3.5 rounded-2xl border transition-all duration-300",
                isCurrent
                  ? "bg-[#171E29] border-slate-500/40 shadow-lg shadow-slate-950/20 text-[#F5F5F5]"
                  : isDone
                  ? "bg-[#111923]/60 border-slate-700/30 text-[#A1A1AA]"
                  : "bg-transparent border-transparent opacity-40"
              )}
            >
              {/* Stage Status Icon */}
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                  isDone
                    ? "bg-slate-800/80 border-slate-700 text-[#CBD5E1]"
                    : isCurrent
                    ? "bg-slate-800 border-slate-500 text-white"
                    : "bg-[#171E29] border-white/10 text-[#64748B]"
                )}
              >
                {isDone ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              {/* Stage Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      isCurrent ? "text-[#F5F5F5]" : isDone ? "text-[#F5F5F5]/90" : "text-[#64748B]"
                    )}
                  >
                    {stage.title}
                  </h3>
                  {isCurrent && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-medium shrink-0">
                      Active
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] font-medium shrink-0">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#A1A1AA] mt-0.5 line-clamp-1">{stage.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Status Counters */}
      {(claimsCount || evidenceCount) && (
        <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#A1A1AA]">
          {claimsCount ? <span>Claims identified: {claimsCount}</span> : <span />}
          {evidenceCount ? <span>Sources found: {evidenceCount}</span> : <span />}
        </div>
      )}
    </div>
  );
}
