"use client";

import React from "react";
import { VerificationReport } from "@/schemas/verification";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ScoreCard } from "./ScoreCard";
import { SummarySection } from "./SummarySection";
import { ArticleBlock } from "./ArticleBlock";
import { CrossSourceSection } from "./CrossSourceSection";
import { ClaimBreakdownSection } from "./ClaimBreakdownSection";
import { EvidenceSection } from "./EvidenceSection";
import { MissingContextSection } from "./MissingContextSection";
import { WhyThisScoreSection } from "./WhyThisScoreSection";
import { ArrowLeft, RefreshCw, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResultsDashboardProps {
  report: VerificationReport;
  claims?: ClaimInput[];
  evidence?: Evidence[];
  onReset?: () => void;
  className?: string;
}

/**
 * ResultsDashboard renders the FakeNewzz verification report in the exact mandated order:
 * a. Score card
 * b. Summary
 * c. Article block with featured image
 * d. Cross-source comparison
 * e. Claim breakdown
 * f. Supporting & contradicting evidence (collapsed on mobile by default)
 * g. Missing context (collapsed on mobile by default)
 * h. Why this score? (collapsed on mobile by default)
 */
export function ResultsDashboard({
  report,
  claims = [],
  evidence = [],
  onReset,
  className,
}: ResultsDashboardProps) {
  const claimsMap = new Map<string, string>();
  claims.forEach((c) => claimsMap.set(c.id, c.text));

  const handleSelectEvidence = (evidenceId: string) => {
    const el = document.getElementById(`evidence-${evidenceId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#10B981]");
      setTimeout(() => el.classList.remove("ring-2", "ring-[#10B981]"), 2000);
    }
  };

  return (
    <div
      data-testid="results-dashboard"
      className={cn("w-full max-w-5xl mx-auto space-y-8 pb-16 px-4 sm:px-6", className)}
    >
      {/* Top Navigation & Actions Bar */}
      <div className="flex items-center justify-between pt-4">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#171E29] hover:bg-[#1A2530] border border-white/10 text-xs sm:text-sm text-[#A1A1AA] hover:text-[#F5F5F5] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Verify Another Story</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#64748B]">
            FakeNewzz Verification Engine
          </span>
        </div>
      </div>

      {/* (a) Score Card */}
      <ScoreCard report={report} />

      {/* (b) Summary */}
      <SummarySection
        summary={report.summary}
        conclusion={report.conclusion}
        report={report}
      />

      {/* (c) Article block with featured image */}
      <ArticleBlock
        title={report.articleTitle}
        sourceDomain={report.sourceDomain}
        featuredImage={report.featuredImage}
        articleUrl={report.articleUrl}
        author={report.author}
        publishedAt={report.publishedAt}
      />

      {/* (d) Cross-source comparison */}
      <CrossSourceSection
        comparison={report.comparison}
        legacyComparison={report.crossSourceComparison}
        evidence={evidence}
        claimsMap={claimsMap}
      />

      {/* (e) Claim breakdown */}
      <ClaimBreakdownSection
        evaluations={report.evaluations}
        claims={claims}
        evidence={evidence}
        onSelectEvidence={handleSelectEvidence}
      />

      {/* (f) Supporting & contradicting evidence (mobile collapsed by default) */}
      <EvidenceSection
        evidence={evidence}
        defaultExpandedMobile={false}
      />

      {/* (g) Missing context (mobile collapsed by default, hidden if empty) */}
      <MissingContextSection
        omissions={report.omittedContext}
        defaultExpandedMobile={false}
      />

      {/* (h) Why this score? (mobile collapsed by default) */}
      <WhyThisScoreSection
        scoreBreakdown={
          report.scoreV2Shadow?.scoreBreakdown?.factors?.length
            ? report.scoreV2Shadow.scoreBreakdown
            : report.scoreBreakdown
        }
        comparison={report.comparison || report.crossSourceComparison}
        evaluations={report.evaluations}
        claims={claims}
        scoreExplanation={report.scoreExplanation}
        defaultExpandedMobile={false}
      />
    </div>
  );
}

