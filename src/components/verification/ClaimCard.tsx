"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Quote, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { AtomicClaim } from "@/types/verification";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { EvidenceCard } from "@/components/verification/EvidenceCard";
import { cn } from "@/lib/utils";

interface ClaimCardProps {
  claim: AtomicClaim;
  index: number;
  initiallyExpanded?: boolean;
}

export function ClaimCard({
  claim,
  index,
  initiallyExpanded = true,
}: ClaimCardProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const borderAccent = {
    VERIFIED: "hover:border-emerald-500/40",
    CONTRADICTED: "hover:border-rose-500/40",
    CONTEXT_MISSING: "hover:border-amber-500/40",
    UNVERIFIED: "hover:border-slate-500/40",
  }[claim.status];

  return (
    <div
      className={cn(
        "glass-panel rounded-2xl transition-all duration-300 border overflow-hidden",
        borderAccent,
        isExpanded ? "border-white/15 bg-slate-900/80 shadow-xl" : "border-white/8 bg-slate-900/50"
      )}
    >
      {/* Header bar / clickable trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 text-left flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-start gap-3.5 flex-1">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-slate-300 flex items-center justify-center mt-0.5">
            C{index + 1}
          </span>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-base font-medium text-slate-100 leading-snug">
              {claim.claimText}
            </h3>
            {claim.originalQuote && !isExpanded && (
              <p className="text-xs text-slate-400 italic line-clamp-1">
                &ldquo;{claim.originalQuote}&rdquo;
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
          <VerdictBadge
            status={claim.status}
            confidence={claim.confidence}
            showConfidence
            size="sm"
          />
          <div className="p-1 rounded-md text-slate-400 hover:text-white bg-white/5">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable Content Area */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-4 animate-in fade-in duration-200">
          {/* Original Article Quote */}
          {claim.originalQuote && (
            <div className="rounded-xl p-3.5 bg-black/30 border border-white/5 flex items-start gap-3">
              <Quote className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                  Original Text in Submitted Article
                </span>
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  &ldquo;{claim.originalQuote}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Evidence Analysis / Reasoning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-mono uppercase font-bold text-slate-200 tracking-wider">
                  Live Web Evidence Findings
                </h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {claim.evidenceSummary}
              </p>
            </div>

            {claim.counterEvidence && (
              <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-mono uppercase font-bold text-rose-300 tracking-wider">
                    Counter-Evidence & Primary Record Contradiction
                  </h4>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {claim.counterEvidence}
                </p>
              </div>
            )}
          </div>

          {/* Corroborating / Refuting Sources List */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Independent Sources & Primary Citations ({claim.sources.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {claim.sources.map((source) => (
                <EvidenceCard key={source.id} evidence={source} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
