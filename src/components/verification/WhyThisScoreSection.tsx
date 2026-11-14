"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus, Sparkles } from "lucide-react";
import { ScoreBreakdown, ScoreBreakdownV2 } from "@/schemas/verification";
import { ComparisonReport, CrossSourceComparison, TransparentScoreExplanation } from "@/schemas/comparison";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { ClaimInput } from "@/schemas/evidence";
import { explainScore, ScoreExplanationItem } from "@/lib/ui/explainScore";
import { cn } from "@/lib/utils";

interface WhyThisScoreSectionProps {
  scoreBreakdown?: ScoreBreakdown | ScoreBreakdownV2 | any;
  comparison?: ComparisonReport | CrossSourceComparison | null;
  evaluations?: ClaimEvaluation[] | null;
  claims?: ClaimInput[] | null;
  scoreExplanation?: TransparentScoreExplanation | null;
  className?: string;
  defaultExpandedMobile?: boolean;
}

export function WhyThisScoreSection({
  scoreBreakdown,
  comparison,
  evaluations,
  claims,
  scoreExplanation,
  className,
  defaultExpandedMobile = false,
}: WhyThisScoreSectionProps) {
  const [mobileExpanded, setMobileExpanded] = useState(defaultExpandedMobile);

  const factors: ScoreExplanationItem[] = explainScore(
    scoreBreakdown,
    comparison,
    evaluations,
    claims,
    scoreExplanation
  );

  return (
    <section
      id="why-this-score"
      data-testid="why-this-score-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg space-y-5 scroll-mt-24",
        className
      )}
    >
      {/* Header with Mobile Accordion Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-[var(--tone-text,#10B981)] transition-colors duration-300">
            <Sparkles className="w-4 h-4" />
            <span>Deterministic Scoring Transparency</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5]">
            Why This Score?
          </h2>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-0.5">
            Every positive and negative adjustment contributing to the final trust calculation is fully auditable.
          </p>
        </div>

        {/* Mobile Accordion Toggle */}
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="md:hidden p-2 rounded-xl bg-[#171E29] border border-white/5 text-[#A1A1AA] hover:text-[#F5F5F5]"
          aria-label={mobileExpanded ? "Collapse why this score" : "Expand why this score"}
        >
          {mobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Factors list: visible on desktop, collapsible on mobile */}
      <div className={cn("grid gap-2.5 pt-2", mobileExpanded ? "block" : "hidden md:grid")}>
        {factors.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#A1A1AA] py-2">
            Deterministic scoring transparently aligns evidence corroborated across primary reports.
          </p>
        ) : (
          factors.map((factor) => {
          const isPositive = factor.direction === "positive";
          const isNegative = factor.direction === "negative";

          return (
            <div
              key={factor.id}
              className="p-3.5 rounded-2xl bg-[#171E29]/70 border border-white/[0.06] flex items-start gap-3 transition-colors"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                  isPositive
                    ? "bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]"
                    : isNegative
                    ? "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]"
                    : "bg-[#64748B]/15 border-[#64748B]/30 text-[#A1A1AA]"
                )}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                ) : isNegative ? (
                  <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-[#F5F5F5] leading-snug">
                  {factor.text}
                </p>

                {factor.claimText && (
                  <p className="text-xs text-[#A1A1AA] italic line-clamp-1">
                    Related claim: &ldquo;{factor.claimText}&rdquo;
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>
    </section>
  );
}

