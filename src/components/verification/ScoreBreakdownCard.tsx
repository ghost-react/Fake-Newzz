"use client";

import React from "react";
import { Calculator, Info } from "lucide-react";
import { ScoreBreakdown, VerificationConfidence } from "@/schemas/verification";

interface ScoreBreakdownCardProps {
  scoreBreakdown: ScoreBreakdown;
  confidence: VerificationConfidence;
}

export function ScoreBreakdownCard({
  scoreBreakdown,
  confidence,
}: ScoreBreakdownCardProps) {
  const { claimScore, contextPenalty, confidenceAdjustment, finalScore } = scoreBreakdown;

  return (
    <div className="rounded-2xl surface-card p-5 sm:p-6 space-y-4 shadow-xl border border-white/[0.08]">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono uppercase text-[#F5F5F5] tracking-wider">
              Explainable Score Calculation
            </h3>
            <p className="text-[11px] text-[#717B89] font-mono">
              Deterministic mathematical scoring • Evidence-weighted calculation
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-[#A1A1AA]">
          Confidence: <span className="font-bold text-[#F5F5F5] uppercase">{confidence}</span>
        </div>
      </div>

      {/* Transparent Formula Rows */}
      <div className="space-y-2.5 font-mono text-xs sm:text-sm">
        <div className="flex items-center justify-between py-1 text-[#A1A1AA]">
          <span className="flex items-center gap-2">
            <span>Claim evidence score</span>
            <span className="text-[10px] text-[#717B89] hidden sm:inline">(weighted by priority & confidence)</span>
          </span>
          <span className="font-bold text-[#F5F5F5]">{claimScore}</span>
        </div>

        <div className="flex items-center justify-between py-1 text-[#A1A1AA]">
          <span className="flex items-center gap-2">
            <span>Context penalty</span>
            <span className="text-[10px] text-[#717B89] hidden sm:inline">(capped at max 25 pts)</span>
          </span>
          <span className={`font-bold ${contextPenalty > 0 ? "text-amber-400" : "text-[#717B89]"}`}>
            {contextPenalty > 0 ? `-${contextPenalty}` : "0"}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 text-[#A1A1AA]">
          <span className="flex items-center gap-2">
            <span>Confidence adjustment</span>
            <span className="text-[10px] text-[#717B89] hidden sm:inline">(uncertainty dampening)</span>
          </span>
          <span className={`font-bold ${confidenceAdjustment < 0 ? "text-sky-400" : "text-[#717B89]"}`}>
            {confidenceAdjustment !== 0 ? `${confidenceAdjustment}` : "0"}
          </span>
        </div>

        <div className="border-t border-white/[0.08] pt-3 flex items-center justify-between text-base sm:text-lg font-bold">
          <span className="text-[#F5F5F5] uppercase tracking-wider text-xs sm:text-sm">
            Deterministic Trust Score
          </span>
          <span className="text-emerald-400 font-mono text-xl sm:text-2xl">
            {finalScore} <span className="text-xs text-[#717B89] font-normal">/ 100</span>
          </span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2.5 text-[11px] text-[#717B89] font-sans leading-relaxed">
        <Info className="w-4 h-4 text-[#717B89] flex-shrink-0 mt-0.5" />
        <span>
          Ground truth resides in primary evidence and verified records. Scores reflect claim importance weights, empirical entailment, and material contextual omissions without political bias or subjective opinion.
        </span>
      </div>
    </div>
  );
}
