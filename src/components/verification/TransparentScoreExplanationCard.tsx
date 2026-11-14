"use client";

import React from "react";
import {
  HelpCircle,
  CheckCircle2,
  GitCompare,
  XCircle,
  ShieldCheck,
  FileWarning,
  Sparkles,
} from "lucide-react";
import { TransparentScoreExplanation } from "@/schemas/comparison";
import { cn } from "@/lib/utils";

interface TransparentScoreExplanationCardProps {
  scoreExplanation?: TransparentScoreExplanation;
  finalScore: number;
  className?: string;
}

export function TransparentScoreExplanationCard({
  scoreExplanation,
  finalScore,
  className,
}: TransparentScoreExplanationCardProps) {
  if (!scoreExplanation) return null;

  return (
    <div className={cn("rounded-2xl surface-card p-6 sm:p-8 border border-white/[0.08] space-y-6 shadow-xl", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5] tracking-tight">
            How this score was calculated
          </h2>
          <p className="text-xs text-[#717B89] font-mono mt-0.5">
            Transparent breakdown grounded in empirical claim-to-evidence matching
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#717B89]">Trust Score:</span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm">
            {finalScore} / 100
          </span>
        </div>
      </div>

      {/* 6 Dimension Explanation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
        {/* 1. Claim Support */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>1. Claim Support</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.claimSupportExplanation}
          </p>
        </div>

        {/* 2. Cross-Source Agreement */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-sky-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <GitCompare className="w-3.5 h-3.5" />
            <span>2. Cross-Source Agreement</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.crossSourceAgreementExplanation}
          </p>
        </div>

        {/* 3. Contradicting Evidence */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <XCircle className="w-3.5 h-3.5" />
            <span>3. Contradicting Evidence</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.contradictingEvidenceExplanation}
          </p>
        </div>

        {/* 4. Source Independence */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-purple-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4. Source Independence</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.sourceIndependenceExplanation}
          </p>
        </div>

        {/* 5. Missing Context */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <FileWarning className="w-3.5 h-3.5" />
            <span>5. Missing Context</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.missingContextExplanation}
          </p>
        </div>

        {/* 6. Unresolved Information */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-mono font-bold text-[11px] uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>6. Unresolved Information</span>
          </div>
          <p className="text-[#A1A1AA] leading-relaxed">
            {scoreExplanation.unresolvedInformationExplanation}
          </p>
        </div>
      </div>

      {/* 100/100 Justification or Evidence Limit Notice */}
      {scoreExplanation.hundredScoreJustification && (
        <div
          className={cn(
            "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
            finalScore === 100
              ? "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-200"
              : "bg-white/[0.02] border-white/[0.06] text-[#A1A1AA]"
          )}
        >
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#F5F5F5] block font-mono uppercase text-[11px] mb-0.5">
              {finalScore === 100 ? "100/100 Verification Standard Met" : "Scoring Calibration Note"}
            </strong>
            <span>{scoreExplanation.hundredScoreJustification}</span>
          </div>
        </div>
      )}
    </div>
  );
}

