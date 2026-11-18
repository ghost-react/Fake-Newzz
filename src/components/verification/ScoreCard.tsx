"use client";

import React from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, XCircle, Info } from "lucide-react";
import { VerificationReport } from "@/schemas/verification";
import { getVerdictContent, UNABLE_TO_VERIFY_AMBER_COPY } from "@/lib/ui/verdictContent";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  report: VerificationReport;
  className?: string;
}

export function ScoreCard({ report, className }: ScoreCardProps) {
  const verdictInfo = getVerdictContent(report.veracityVerdict);
  const scoreCardLabel = report.conclusion?.label || verdictInfo.label;
  const scoreCardMeaning = report.conclusion?.explanation || verdictInfo.oneLineMeaning;
  const isUnableToVerify =
    report.veracityVerdict === "unverified" ||
    verdictInfo.id === "unable_to_verify";

  const coverageLimited =
    report.comparison?.coverageLimited ||
    report.scoreV2Shadow?.coverageLimited;

  // Icon mapping
  const renderIcon = () => {
    const props = { className: "w-7 h-7 sm:w-8 sm:h-8 shrink-0" };
    switch (verdictInfo.iconName) {
      case "ShieldCheck":
        return <ShieldCheck {...props} />;
      case "CheckCircle2":
        return <CheckCircle2 {...props} />;
      case "AlertTriangle":
        return <AlertTriangle {...props} />;
      case "AlertCircle":
        return <AlertCircle {...props} />;
      case "HelpCircle":
        return <HelpCircle {...props} />;
      case "XCircle":
        return <XCircle {...props} />;
      default:
        return <ShieldCheck {...props} />;
    }
  };

  const confidenceLabel =
    report.confidence === "high"
      ? "High Confidence"
      : report.confidence === "medium"
      ? "Medium Confidence"
      : "Low Confidence";

  return (
    <div
      data-testid="score-card"
      className={cn(
        // Glass effect only on the score card as specified, with toned border and glow
        "relative rounded-3xl p-6 sm:p-8 backdrop-blur-xl bg-[#111923]/80 border border-[var(--tone-border,rgba(255,255,255,0.12))] shadow-2xl overflow-hidden transition-colors duration-300",
        className
      )}
    >
      {/* Background radial glow */}
      <div
        className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors duration-300"
        style={{ backgroundColor: "var(--tone, " + verdictInfo.colorToken + ")" }}
      />

      <div className="relative z-10 flex flex-col gap-5">
        {/* Notice for legacy text-type reports */}
        {(!report.articleUrl || report.sourceDomain === "Independent Claim") && (
          <div
            data-testid="legacy-text-input-notice"
            className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs sm:text-sm text-amber-300 shadow-sm"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-400" />
            <span>This check used an input type that is no longer available.</span>
          </div>
        )}

        {/* Neutral grey info note above score when original article could not be read */}
        {(report.sourceReadStatus === "unreadable" ||
          report.sourceReadStatus === "failed" ||
          report.sourceReadStatus === "insufficient") && (
          <div
            data-testid="unreadable-source-note"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3 text-xs sm:text-sm text-slate-300 shadow-sm"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-400" />
            <span>
              {report.sourceReadNote ||
                "The publisher may block automated access or require a subscription. Try another link to the same story."}
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Score & Numerical Metric */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex flex-col items-center justify-center border shadow-inner transition-colors duration-300"
              style={{
                borderColor: "var(--tone-border, " + verdictInfo.colorToken + "40)",
                backgroundColor: "var(--tone-soft, " + verdictInfo.colorToken + "10)",
              }}
            >
              {report.conclusion?.label === "Can't verify" || report.hasGatedEvidence === false ? (
                <span className="text-lg sm:text-xl font-mono font-bold tracking-tight text-center px-1 text-[#94A3B8]">
                  No score
                </span>
              ) : (
                <>
                  <span
                    className="text-4xl sm:text-5xl font-mono font-bold tracking-tight transition-colors duration-300"
                    style={{ color: "var(--tone-text, " + verdictInfo.colorToken + ")" }}
                  >
                    {report.overallTrustScore}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#A1A1AA]">
                    / 100
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors duration-300"
                style={{
                  borderColor: "var(--tone-border, " + verdictInfo.colorToken + "40)",
                  backgroundColor: "var(--tone-soft, " + verdictInfo.colorToken + "15)",
                  color: "var(--tone-text, " + verdictInfo.colorToken + ")",
                }}
              >
                {renderIcon()}
                <span>{scoreCardLabel}</span>
              </span>

              {/* Confidence Pill */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#171E29] border border-white/[0.08] text-[11px] font-medium text-[#A1A1AA]">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      report.confidence === "high"
                        ? "#10B981"
                        : report.confidence === "medium"
                        ? "#F59E0B"
                        : "#64748B",
                  }}
                />
                <span>{confidenceLabel}</span>
              </span>

              {/* Verified True Badge */}
              {(report.verifiedTrue || report.scoreV2Shadow?.verifiedTrue) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[11px] font-semibold text-[#10B981] font-mono uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Verified</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-editorial font-bold text-[#F5F5F5] tracking-tight">
              {scoreCardLabel}
            </h1>

            <p className="text-sm sm:text-base text-[#A1A1AA] max-w-xl">
              {scoreCardMeaning}
            </p>

            {coverageLimited && (
              <p className="text-xs text-[#F59E0B] flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Limited independent coverage available</span>
              </p>
            )}
          </div>
        </div>

        {/* Right: Quick Claim Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-white/[0.08] md:pl-6 text-center">
          <div className="bg-[#171E29]/60 rounded-xl p-2.5 border border-white/5">
            <div className="text-base sm:text-lg font-mono font-bold text-[#10B981]">
              {report.claimSummary.supporting}
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA]">
              Supported
            </div>
          </div>
          <div className="bg-[#171E29]/60 rounded-xl p-2.5 border border-white/5">
            <div className="text-base sm:text-lg font-mono font-bold text-[#EF4444]">
              {report.claimSummary.contradicting}
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA]">
              Contradicted
            </div>
          </div>
          <div className="bg-[#171E29]/60 rounded-xl p-2.5 border border-white/5">
            <div className="text-base sm:text-lg font-mono font-bold text-[#F59E0B]">
              {report.claimSummary.qualifying}
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA]">
              Qualified
            </div>
          </div>
          <div className="bg-[#171E29]/60 rounded-xl p-2.5 border border-white/5">
            <div className="text-base sm:text-lg font-mono font-bold text-[#64748B]">
              {report.claimSummary.insufficient}
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA]">
              Unverified
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Special Amber Explanatory Panel for "Unable to Verify" / "Unverified" */}
      {isUnableToVerify && (
        <div
          data-testid="unable-to-verify-panel"
          className="mt-6 p-4 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 flex items-start gap-3 text-sm text-[#F59E0B]"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#F59E0B] mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-[#F5F5F5]">Verification Note</p>
            <p className="text-[#F5F5F5]/90">{UNABLE_TO_VERIFY_AMBER_COPY}</p>
          </div>
        </div>
      )}
    </div>
  );
}

