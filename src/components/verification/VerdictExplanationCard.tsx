"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Info,
  Check,
  X,
  FileText,
} from "lucide-react";
import { VeracityVerdict, VerificationConfidence } from "@/schemas/verification";
import { cn } from "@/lib/utils";

interface VerdictExplanationCardProps {
  verdict: VeracityVerdict;
  trustScore: number;
  confidence: VerificationConfidence;
  claimSummary: {
    total: number;
    supporting: number;
    contradicting: number;
    qualifying: number;
    insufficient: number;
  };
  summary?: string;
  omissionsCount?: number;
  hasSyndication?: boolean;
  isStatementConfirmed?: boolean;
  className?: string;
}

export interface VerdictConfig {
  label: string;
  baselineExplanation: string;
  icon: React.ElementType;
  badgeStyle: string;
  cardBorder: string;
  accentText: string;
  bgGlow: string;
}

export const VERDICT_EXPLANATION_CONFIG: Record<VeracityVerdict, VerdictConfig> = {
  verified_true: {
    label: "Highly Trustworthy",
    baselineExplanation:
      "Strong evidence from credible sources supports the main factual claims in this report.",
    icon: CheckCircle2,
    badgeStyle: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    cardBorder: "border-emerald-500/30",
    accentText: "text-emerald-400",
    bgGlow: "bg-emerald-500/[0.03]",
  },
  mostly_true: {
    label: "Mostly Trustworthy",
    baselineExplanation:
      "Most important claims are supported by credible evidence, although some details may need additional context.",
    icon: CheckCircle2,
    badgeStyle: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    cardBorder: "border-emerald-500/25",
    accentText: "text-emerald-300",
    bgGlow: "bg-emerald-500/[0.02]",
  },
  mixed: {
    label: "Mixed Evidence",
    baselineExplanation:
      "The available evidence supports some claims but contradicts or leaves others unresolved.",
    icon: AlertTriangle,
    badgeStyle: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    cardBorder: "border-amber-500/30",
    accentText: "text-amber-300",
    bgGlow: "bg-amber-500/[0.02]",
  },
  misleading: {
    label: "Potentially Misleading",
    baselineExplanation:
      "Some information may be presented without important context, or the evidence suggests that the overall impression could be misleading.",
    icon: AlertTriangle,
    badgeStyle: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    cardBorder: "border-amber-500/30",
    accentText: "text-amber-400",
    bgGlow: "bg-amber-500/[0.03]",
  },
  mostly_false: {
    label: "Mostly False",
    baselineExplanation:
      "Strong evidence contradicts most of the important factual claims, although some details may still be accurate.",
    icon: XCircle,
    badgeStyle: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    cardBorder: "border-rose-500/30",
    accentText: "text-rose-300",
    bgGlow: "bg-rose-500/[0.03]",
  },
  false: {
    label: "False",
    baselineExplanation:
      "Reliable evidence strongly contradicts the central factual claims in this report.",
    icon: XCircle,
    badgeStyle: "bg-rose-500/15 border-rose-500/30 text-rose-400",
    cardBorder: "border-rose-500/30",
    accentText: "text-rose-400",
    bgGlow: "bg-rose-500/[0.03]",
  },
  unverified: {
    label: "Unable to Verify",
    baselineExplanation:
      "There is not enough reliable evidence to reach a confident conclusion. This does not mean the story is false.",
    icon: HelpCircle,
    badgeStyle: "bg-slate-500/15 border-slate-500/30 text-slate-300",
    cardBorder: "border-white/[0.08]",
    accentText: "text-slate-300",
    bgGlow: "bg-slate-500/[0.02]",
  },
  could_not_read: {
    label: "Couldn't read this article",
    baselineExplanation:
      "We couldn't read the original article, and no independent reporting could be identified from the URL.",
    icon: HelpCircle,
    badgeStyle: "bg-slate-500/15 border-slate-500/30 text-slate-300",
    cardBorder: "border-white/[0.08]",
    accentText: "text-slate-300",
    bgGlow: "bg-slate-500/[0.02]",
  },
};

/**
 * Generates an accurate, strictly factual contextual explanation using real report data.
 * Never fabricates numbers or contradicts underlying claim evaluations.
 */
export function generateContextualExplanation(
  verdict: VeracityVerdict,
  claimSummary: {
    total: number;
    supporting: number;
    contradicting: number;
    qualifying: number;
    insufficient: number;
  },
  omissionsCount: number = 0,
  hasSyndication: boolean = false
): string {
  const { total, supporting, contradicting, qualifying, insufficient } = claimSummary;

  if (total === 0) {
    return "No individual testable factual assertions were isolated from this submission.";
  }

  const syndicationNote = hasSyndication
    ? " Several reporting outlets rely on the same original news wire, limiting independent multi-source confirmation."
    : "";

  switch (verdict) {
    case "verified_true":
      if (supporting === total) {
        return `All ${total} of ${total} important factual claims are confirmed by independent and credible sources.${syndicationNote}`;
      }
      return `${supporting} of ${total} important claims are corroborated by independent reporting, with no contradictory evidence found.${syndicationNote}`;

    case "mostly_true":
      if (qualifying > 0 || omissionsCount > 0) {
        const detailsCount = qualifying + (omissionsCount > 0 ? 1 : 0);
        return `${supporting} of ${total} important claims are supported by credible reporting, although ${detailsCount} detail${detailsCount > 1 ? "s" : ""} or context condition${detailsCount > 1 ? "s" : ""} require clarification.${syndicationNote}`;
      }
      return `${supporting} of ${total} claims are verified, while ${insufficient} detail${insufficient > 1 ? "s remain" : " remains"} unverified without contradicting the core report.${syndicationNote}`;

    case "mixed": {
      const parts: string[] = [];
      if (supporting > 0) parts.push(`${supporting} claim${supporting > 1 ? "s are" : " is"} supported`);
      if (contradicting > 0) parts.push(`${contradicting} conflict${contradicting > 1 ? "" : "s"} with reliable evidence`);
      if (insufficient > 0) parts.push(`${insufficient} remain${insufficient > 1 ? "" : "s"} unresolved`);
      return `The evidence is divided: ${parts.join(", and ")}.${syndicationNote}`;
    }

    case "misleading":
      if (omissionsCount > 0 && supporting > 0) {
        return `${supporting} of ${total} claims contain factual elements, but ${omissionsCount} material contextual omission${omissionsCount > 1 ? "s alter" : " alters"} how the report should be interpreted.${syndicationNote}`;
      }
      if (qualifying > 0) {
        return `${qualifying} of ${total} key claims require significant qualification that contradicts the primary impression given by the headline.${syndicationNote}`;
      }
      return `Key factual elements are presented without critical qualifying context, leading to an inaccurate overall impression.${syndicationNote}`;

    case "mostly_false":
      if (supporting > 0) {
        return `${contradicting} of ${total} claims conflict with reliable evidence or records, although ${supporting} detail${supporting > 1 ? "s" : ""} may be accurate.${syndicationNote}`;
      }
      return `${contradicting} of ${total} important claims are directly contradicted by authoritative sources.${syndicationNote}`;

    case "false":
      if (contradicting > 0) {
        return `${contradicting} of ${total} central claims conflict with verifiable evidence and official records.${syndicationNote}`;
      }
      return `The primary factual claims conflict with reliable evidence or have been refuted by authoritative records.${syndicationNote}`;

    case "unverified":
    default:
      if (insufficient > 0) {
        return `${insufficient} of ${total} claims lack sufficient independent documentation to confirm or refute. Available public records remain inconclusive.${syndicationNote}`;
      }
      return `There is not enough verifiable independent evidence to determine whether the claims are accurate or inaccurate.${syndicationNote}`;
  }
}

export function VerdictExplanationCard({
  verdict,
  trustScore,
  confidence,
  claimSummary,
  summary,
  omissionsCount = 0,
  hasSyndication = false,
  isStatementConfirmed = false,
  className,
}: VerdictExplanationCardProps) {
  const config = VERDICT_EXPLANATION_CONFIG[verdict] || VERDICT_EXPLANATION_CONFIG.unverified;
  const Icon = config.icon;

  const contextualExplanation = generateContextualExplanation(
    verdict,
    claimSummary,
    omissionsCount,
    hasSyndication
  );

  return (
    <div
      className={cn(
        "rounded-2xl surface-card p-5 sm:p-6 border space-y-4 shadow-xl transition-all",
        config.cardBorder,
        config.bgGlow,
        className
      )}
    >
      {/* Top Status & Badge Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider",
              config.badgeStyle
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </div>

          <span className="text-xs font-mono text-[#717B89]">
            Trust Score: <strong className="text-[#F5F5F5]">{trustScore}/100</strong>
          </span>
        </div>

        <div className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-[#A1A1AA]">
          Evidence Confidence:{" "}
          <strong className="text-[#F5F5F5] uppercase font-bold">{confidence}</strong>
        </div>
      </div>

      {/* Statement Authenticity Confirmation (if applicable) */}
      {isStatementConfirmed && (
        <div className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/30 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase tracking-wider">
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Statement confirmed</span>
          </div>
          <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed font-sans">
            The available reporting corroborates that this statement was made. Its factual meaning and implications are evaluated separately below.
          </p>
        </div>
      )}

      {/* 1. Plain-English Baseline Verdict Explanation */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#717B89] font-bold block">
          Verdict Assessment
        </span>
        <p className="text-base sm:text-lg font-editorial font-medium text-[#F5F5F5] leading-snug">
          &ldquo;{config.baselineExplanation}&rdquo;
        </p>
      </div>

      {/* 2. Contextual Evidence Summary */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#717B89]" />
          <span className="text-xs font-mono uppercase font-bold text-[#A1A1AA] tracking-wider">
            Evidence Context
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed font-sans">
          {contextualExplanation}
        </p>
      </div>

      {/* 3. Distinction: Confirmed vs. Uncertain Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-sans">
        {/* Confirmed Details */}
        <div className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-[11px] uppercase tracking-wider">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Confirmed Details</span>
          </div>
          <p className="text-[#A1A1AA] text-xs leading-relaxed">
            {claimSummary.supporting > 0
              ? `${claimSummary.supporting} claim${claimSummary.supporting !== 1 ? "s are" : " is"} directly verified by independent or primary sources.`
              : "No claims in this report are independently verified by primary evidence."}
          </p>
        </div>

        {/* Uncertain or Disputed Details */}
        <div
          className={cn(
            "p-3 rounded-xl border space-y-1",
            claimSummary.contradicting > 0
              ? "bg-rose-500/[0.04] border-rose-500/15"
              : claimSummary.qualifying > 0 || omissionsCount > 0
              ? "bg-amber-500/[0.04] border-amber-500/15"
              : "bg-slate-500/[0.04] border-slate-500/15"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 font-mono font-bold text-[11px] uppercase tracking-wider",
              claimSummary.contradicting > 0
                ? "text-rose-400"
                : claimSummary.qualifying > 0 || omissionsCount > 0
                ? "text-amber-400"
                : "text-slate-400"
            )}
          >
            {claimSummary.contradicting > 0 ? (
              <>
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Disputed / Refuted</span>
              </>
            ) : claimSummary.qualifying > 0 || omissionsCount > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Context Missing</span>
              </>
            ) : (
              <>
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Unresolved / Unverified</span>
              </>
            )}
          </div>
          <p className="text-[#A1A1AA] text-xs leading-relaxed">
            {claimSummary.contradicting > 0
              ? `${claimSummary.contradicting} claim${claimSummary.contradicting !== 1 ? "s contradict" : " contradicts"} reliable evidence.`
              : claimSummary.qualifying > 0 || omissionsCount > 0
              ? `${claimSummary.qualifying} claim${claimSummary.qualifying !== 1 ? "s require" : " requires"} material qualification.`
              : claimSummary.insufficient > 0
              ? `${claimSummary.insufficient} claim${claimSummary.insufficient !== 1 ? "s lack" : " lacks"} verifiable evidence.`
              : "No contradictions or missing context detected."}
          </p>
        </div>
      </div>

      {/* 4. Executive Summary from Report */}
      {summary && (
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono uppercase font-bold text-[#A1A1AA] tracking-wider">
              Verification Overview
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#F5F5F5] leading-relaxed font-sans">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
}

