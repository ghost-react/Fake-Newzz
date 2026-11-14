"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Conclusion, VerificationReport } from "@/schemas/verification";
import { explainScore } from "@/lib/ui/explainScore";
import { cn } from "@/lib/utils";

export interface SummarySectionProps {
  summary: string;
  conclusion?: Conclusion;
  report?: VerificationReport;
  className?: string;
}

export function SummarySection({
  summary,
  conclusion,
  report,
  className,
}: SummarySectionProps) {
  if (!summary) return null;

  const effectiveConclusion = conclusion || report?.conclusion;
  const label = effectiveConclusion?.label || "Unconfirmed";
  const explanation = effectiveConclusion?.explanation || "";

  // Independent report count from comparison or crossSourceComparison
  const independentCount =
    report?.comparison?.totalIndependentClusters ??
    report?.crossSourceComparison?.independentSourcesCount;

  // Contributing score factors for interactive Why this score? disclosure
  const breakdownToExplain =
    report?.scoreV2Shadow?.scoreBreakdown?.factors?.length
      ? report.scoreV2Shadow.scoreBreakdown
      : report?.scoreBreakdown;

  const factors = report
    ? explainScore(
        breakdownToExplain,
        report.comparison || report.crossSourceComparison,
        report.evaluations,
        null,
        report.scoreExplanation
      )
    : [];

  // Icon mapping based on conclusion label (color and border dynamically follow tone variables)
  const getBadgeIcon = () => {
    switch (label) {
      case "True":
      case "Mostly true":
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      case "Partly true":
        return <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
      case "Unconfirmed":
        return <HelpCircle className="w-3.5 h-3.5 shrink-0" />;
      case "Misleading":
        return <AlertCircle className="w-3.5 h-3.5 shrink-0" />;
      case "False":
        return <XCircle className="w-3.5 h-3.5 shrink-0" />;
      case "Can't verify":
      default:
        return <HelpCircle className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const badgeIcon = getBadgeIcon();

  return (
    <section
      data-testid="summary-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg",
        className
      )}
    >
      {/* 0. Conclusion Chip, Explanation & Independent Reports Badge */}
      <div className="flex flex-col gap-2.5 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            data-testid="conclusion-chip"
            style={{
              borderColor: "var(--tone-border, rgba(16, 185, 129, 0.35))",
              backgroundColor: "var(--tone-soft, rgba(16, 185, 129, 0.12))",
              color: "var(--tone-text, #34D399)",
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border transition-colors duration-300"
          >
            {badgeIcon}
            <span>Conclusion: {label}</span>
          </span>

          {independentCount !== undefined && independentCount > 0 && (
            <span
              data-testid="independent-reports-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-[#A1A1AA]"
            >
              Based on {independentCount} independent report{independentCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {explanation && (
          <p
            data-testid="conclusion-explanation"
            className="text-xs sm:text-sm text-[#A1A1AA] font-sans"
          >
            {explanation}
          </p>
        )}
      </div>

      {/* 1. Header */}
      <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5] mb-3">
        Story Summary
      </h2>

      {/* 2. Render safely as plain text to guarantee no unescaped HTML or injection */}
      <p className="text-base sm:text-lg leading-relaxed text-[#F5F5F5]/90 font-serif whitespace-pre-line">
        {summary}
      </p>

      {/* 3. Link / Disclosure for Why this score? */}
      <div className="mt-5 pt-3 border-t border-white/[0.08]">
        <details className="group" data-testid="why-this-score-disclosure">
          <summary
            data-testid="why-this-score-link"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono text-[var(--tone-text,#34D399)] hover:opacity-80 transition-colors duration-300 cursor-pointer list-none select-none"
          >
            <span>Why this score?</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-open:rotate-90" />
          </summary>

          <div className="mt-3.5 p-4 sm:p-5 rounded-2xl bg-[#0B0F17]/90 border border-[var(--tone-border,rgba(255,255,255,0.08))] space-y-3 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--tone-text,#34D399)] font-semibold transition-colors duration-300">
                Score Contributing Factors
              </span>
              <a
                href="#why-this-score"
                onClick={(e) => {
                  const target = document.getElementById("why-this-score");
                  if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="text-[11px] font-mono text-[#A1A1AA] hover:text-white underline transition-colors"
              >
                View full section ↓
              </a>
            </div>

            {factors.length > 0 ? (
              <div className="grid gap-2">
                {factors.slice(0, 5).map((factor) => {
                  const isPositive = factor.direction === "positive";
                  const isNegative = factor.direction === "negative";
                  return (
                    <div
                      key={factor.id}
                      className="p-2.5 rounded-xl bg-[#171E29]/70 border border-white/[0.06] flex items-center gap-2.5 text-xs"
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold shrink-0 text-[10px]",
                          isPositive
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : isNegative
                            ? "bg-[#EF4444]/20 text-[#EF4444]"
                            : "bg-[#64748B]/20 text-[#A1A1AA]"
                        )}
                      >
                        {isPositive ? "+" : isNegative ? "-" : "•"}
                      </span>
                      <span className="text-[#F5F5F5] font-medium leading-snug">
                        {factor.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#A1A1AA]">
                Deterministic scoring calculated based on claim corroboration, cross-source consensus, and transparent penalty gates.
              </p>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
