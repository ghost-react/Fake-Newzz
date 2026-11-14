"use client";

import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { Omission } from "@/schemas/omission";
import { cn } from "@/lib/utils";

interface MissingContextSectionProps {
  omissions?: Omission[] | null;
  className?: string;
  defaultExpandedMobile?: boolean;
}

export function MissingContextSection({
  omissions,
  className,
  defaultExpandedMobile = false,
}: MissingContextSectionProps) {
  // Gracefully hide section if no omissions exist
  if (!omissions || omissions.length === 0) {
    return null;
  }

  return (
    <MissingContextInner
      omissions={omissions}
      className={className}
      defaultExpandedMobile={defaultExpandedMobile}
    />
  );
}

function MissingContextInner({
  omissions,
  className,
  defaultExpandedMobile,
}: {
  omissions: Omission[];
  className?: string;
  defaultExpandedMobile: boolean;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(defaultExpandedMobile);

  return (
    <section
      data-testid="missing-context-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg space-y-5",
        className
      )}
    >
      {/* Header with Mobile Accordion Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-[#F59E0B]">
            <ShieldAlert className="w-4 h-4" />
            <span>Omission Analysis</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5]">
            Missing Context & Important Omissions
          </h2>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-0.5">
            Key details, baselines, or qualifications omitted from the reported story that materially alter its interpretation.
          </p>
        </div>

        {/* Mobile Accordion Toggle */}
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="md:hidden p-2 rounded-xl bg-[#171E29] border border-white/5 text-[#A1A1AA] hover:text-[#F5F5F5]"
          aria-label={mobileExpanded ? "Collapse missing context" : "Expand missing context"}
        >
          {mobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Content wrapper: always visible on desktop, collapsible on mobile */}
      <div className={cn("grid gap-3 pt-2", mobileExpanded ? "block" : "hidden md:grid")}>
        {omissions.map((om, idx) => {
          const isHigh = om.severity === "high";

          return (
            <div
              key={om.id || idx}
              className={cn(
                "p-4 rounded-2xl border space-y-2.5",
                isHigh
                  ? "bg-[#EF4444]/10 border-[#EF4444]/25"
                  : "bg-[#171E29]/70 border-white/[0.06]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-semibold",
                    isHigh
                      ? "bg-[#EF4444]/20 text-[#EF4444]"
                      : "bg-[#F59E0B]/20 text-[#F59E0B]"
                  )}
                >
                  {om.severity} Impact Omission
                </span>

                {om.confidence && (
                  <span className="text-[11px] text-[#A1A1AA] font-mono">
                    {om.confidence} confidence
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-[#F5F5F5] leading-snug">
                {om.description}
              </p>

              {om.whyItMatters && (
                <div className="pt-1 text-xs text-[#A1A1AA] border-t border-white/5">
                  <strong className="text-[#F5F5F5] font-medium">Why it matters: </strong>
                  <span>{om.whyItMatters}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
