"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  ShieldCheck,
} from "lucide-react";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation, Verdict, Confidence } from "@/schemas/evaluation";
import { Article } from "@/schemas/article";
import { Omission } from "@/schemas/omission";
import { OmissionsSection } from "./OmissionsSection";

interface ClaimsEvaluatedViewProps {
  claims: ClaimInput[];
  evaluations: ClaimEvaluation[];
  evidence: Evidence[];
  article?: Article | null;
  omissions?: Omission[];
  isAnalyzingContext?: boolean;
  onReset: () => void;
  onViewFinalReport?: () => void;
  hasFinalReport?: boolean;
}

const VERDICT_CONFIG: Record<
  Verdict,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeStyle: string;
    cardBorder: string;
    accentText: string;
    summary: string;
  }
> = {
  supporting: {
    label: "Supporting",
    icon: CheckCircle2,
    badgeStyle:
      "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    cardBorder: "border-emerald-500/30 hover:border-emerald-500/50",
    accentText: "text-emerald-400",
    summary: "Evidence directly supports the claim",
  },
  contradicting: {
    label: "Contradicting",
    icon: XCircle,
    badgeStyle:
      "bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
    cardBorder: "border-rose-500/30 hover:border-rose-500/50",
    accentText: "text-rose-400",
    summary: "Evidence directly conflicts with the claim",
  },
  qualifying: {
    label: "Qualifying",
    icon: AlertTriangle,
    badgeStyle:
      "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
    cardBorder: "border-amber-500/30 hover:border-amber-500/50",
    accentText: "text-amber-400",
    summary: "Evidence adds critical limits, conditions, or missing context",
  },
  insufficient: {
    label: "Insufficient",
    icon: HelpCircle,
    badgeStyle:
      "bg-slate-500/15 border-slate-500/30 text-slate-300 shadow-[0_0_10px_rgba(148,163,184,0.15)]",
    cardBorder: "border-white/10 hover:border-white/20",
    accentText: "text-slate-400",
    summary: "Available evidence cannot reliably determine the claim",
  },
};

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  high: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  medium: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  low: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export function ClaimsEvaluatedView({
  claims,
  evaluations,
  evidence,
  article,
  omissions = [],
  isAnalyzingContext = false,
  onReset,
  onViewFinalReport,
  hasFinalReport = false,
}: ClaimsEvaluatedViewProps) {
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>(
    () => {
      // Default: all expanded
      const initial: Record<string, boolean> = {};
      claims.forEach((c) => {
        initial[c.id] = true;
      });
      return initial;
    }
  );

  const toggleExpanded = (claimId: string) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  // Map evaluations by claim ID
  const evaluationMap = new Map<string, ClaimEvaluation>();
  evaluations.forEach((e) => evaluationMap.set(e.claimId, e));

  // Map evidence by ID for fast lookup
  const evidenceMap = new Map<string, Evidence>();
  evidence.forEach((ev) => evidenceMap.set(ev.id, ev));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in-50 duration-500 pb-16">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            New Analysis
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Evidence-Grounded Evaluations
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-slate-400">
            Evaluated {claims.length} claim{claims.length > 1 ? "s" : ""}
          </div>

          {onViewFinalReport && (
            <button
              type="button"
              onClick={onViewFinalReport}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>View Verification Report</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold uppercase tracking-wider">
            Phase 5 Complete
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Deterministic Traceability
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-editorial font-bold text-white tracking-tight">
          Claims evaluated
        </h1>

        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          Each atomic claim below has been rigorously evaluated against retrieved public records,
          wire reports, and official documents. Verdicts reflect evidence entailment only, without
          outside knowledge or hallucination.
        </p>

        {article && (
          <div className="pt-2 flex items-center gap-2 text-xs text-slate-400 font-mono">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-md">Source: {article.title}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{article.sourceDomain}</span>
          </div>
        )}
      </div>

      {/* 3. Evaluated Claims List */}
      <div className="space-y-6">
        {claims.map((claim, index) => {
          const evalResult = evaluationMap.get(claim.id);
          const verdict: Verdict = evalResult?.verdict || "insufficient";
          const confidence: Confidence = evalResult?.confidence || "low";
          const config = VERDICT_CONFIG[verdict];
          const VerdictIcon = config.icon;
          const isExpanded = expandedClaims[claim.id] ?? true;

          // Find linked evidence objects
          const linkedEvidence = (evalResult?.evidenceIds || [])
            .map((id) => evidenceMap.get(id))
            .filter((e): e is Evidence => Boolean(e));

          return (
            <div
              key={claim.id}
              className={`rounded-2xl border bg-slate-900/60 backdrop-blur-xl transition-all duration-300 shadow-xl overflow-hidden ${config.cardBorder}`}
            >
              {/* Card Header / Summary Trigger */}
              <button
                type="button"
                onClick={() => toggleExpanded(claim.id)}
                className="w-full p-5 sm:p-6 text-left flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-slate-300 flex items-center justify-center mt-0.5">
                    #{index + 1}
                  </span>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Importance Badge */}
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                        {claim.importance} Priority
                      </span>
                      {/* Claim Type */}
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 uppercase">
                        {claim.claimType}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-medium text-white leading-snug">
                      {claim.text}
                    </h3>
                  </div>
                </div>

                {/* Verdict & Confidence Pill */}
                <div className="flex items-center gap-3 self-end md:self-start flex-shrink-0">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${config.badgeStyle}`}
                  >
                    <VerdictIcon className="w-4 h-4" />
                    <span>{config.label}</span>
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-mono uppercase font-semibold ${CONFIDENCE_BADGE[confidence]}`}
                  >
                    {confidence}
                  </div>

                  <div className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Card Expanded Content */}
              {isExpanded && (
                <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-white/5 space-y-6">
                  {/* Explanation Section */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-mono uppercase font-bold text-slate-300 tracking-wider">
                        Evaluation Reasoning
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-sans">
                      {evalResult?.explanation ||
                        "No explanation was provided for this claim evaluation."}
                    </p>
                  </div>

                  {/* Important Notes */}
                  {evalResult?.importantNotes &&
                    evalResult.importantNotes.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-mono uppercase font-semibold text-slate-400 tracking-wider block">
                          Important Notes & Context
                        </span>
                        <div className="space-y-1.5">
                          {evalResult.importantNotes.map((note, noteIdx) => (
                            <div
                              key={noteIdx}
                              className="text-xs text-slate-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-start gap-2"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span>{note}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Linked Evidence Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase font-semibold text-slate-400 tracking-wider">
                        Grounded In ({linkedEvidence.length} Evidence Source
                        {linkedEvidence.length !== 1 ? "s" : ""})
                      </span>
                      {evalResult?.evidenceIds && evalResult.evidenceIds.length > 0 && (
                        <span className="text-[11px] font-mono text-slate-500">
                          IDs: {evalResult.evidenceIds.join(", ")}
                        </span>
                      )}
                    </div>

                    {linkedEvidence.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {linkedEvidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-4 rounded-xl border border-white/10 bg-black/30 hover:border-white/20 transition-all space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 uppercase">
                                  {ev.sourceType.replace(/_/g, " ")}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400">
                                  {ev.domain}
                                </span>
                                {ev.sourceRelationship !== "unknown" && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase">
                                    {ev.sourceRelationship}
                                  </span>
                                )}
                              </div>

                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-mono"
                              >
                                <span>Visit Source</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <h4 className="text-sm font-semibold text-white">
                              {ev.title}
                            </h4>

                            <p className="text-xs text-slate-300 leading-relaxed font-sans">
                              {ev.snippet}
                            </p>

                            {ev.sourceContentExcerpt && (
                              <div className="mt-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-1">
                                  Retrieved Primary Excerpt
                                </span>
                                <p className="text-xs text-slate-300 italic font-mono leading-relaxed line-clamp-3">
                                  &ldquo;{ev.sourceContentExcerpt}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-white/5 bg-black/20 text-xs text-slate-400 italic">
                        No specific evidence items were cited for this verdict (available evidence was insufficient or no matching records were retrieved).
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Phase 6 Context & Material Omissions Section */}
      <OmissionsSection
        omissions={omissions}
        evidence={evidence}
        claims={claims}
        isLoading={isAnalyzingContext}
      />

      {/* 5. Phase 7 Final Report CTA Banner */}
      {onViewFinalReport && (
        <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                Phase 7 Ready
              </span>
              <h3 className="text-base font-bold text-white">
                Deterministic Overall Score & Report
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              Combine atomic claim evaluations, contextual omissions, and importance weights into an explainable overall trust score and grounded verdict.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewFinalReport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>View Final Verification Report</span>
          </button>
        </div>
      )}
    </div>
  );
}
