"use client";

import React, { useState } from "react";
import { Database, ExternalLink, Globe, FileText, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Evidence } from "@/schemas/evidence";
import { SourceLink, SyndicatedOutlet } from "@/components/ui/SourceLink";
import { cn } from "@/lib/utils";

interface EvidenceSectionProps {
  evidence: Evidence[];
  className?: string;
  defaultExpandedMobile?: boolean;
}

export function EvidenceSection({
  evidence,
  className,
  defaultExpandedMobile = false,
}: EvidenceSectionProps) {
  const [filter, setFilter] = useState<"all" | "supporting" | "contradicting" | "qualifying">("all");
  const [mobileExpanded, setMobileExpanded] = useState(defaultExpandedMobile);

  if (!evidence || evidence.length === 0) return null;

  const filtered = evidence.filter((e) => {
    if (filter === "all") return true;
    return e.relationship === filter;
  });

  const supportingCount = evidence.filter((e) => e.relationship === "supporting").length;
  const contradictingCount = evidence.filter((e) => e.relationship === "contradicting").length;
  const qualifyingCount = evidence.filter((e) => e.relationship === "qualifying").length;

  return (
    <section
      data-testid="evidence-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg space-y-5",
        className
      )}
    >
      {/* Mobile Accordion Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-[var(--tone-text,#10B981)] transition-colors duration-300">
            <Database className="w-4 h-4" />
            <span>Retrieved Sources</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5]">
            Supporting & Contradicting Evidence
          </h2>
        </div>

        {/* Mobile Accordion Toggle */}
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="md:hidden p-2 rounded-xl bg-[#171E29] border border-white/5 text-[#A1A1AA] hover:text-[#F5F5F5]"
          aria-label={mobileExpanded ? "Collapse evidence" : "Expand evidence"}
        >
          {mobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Content wrapper: always visible on desktop (md:block), collapsible on mobile */}
      <div className={cn("space-y-4", mobileExpanded ? "block" : "hidden md:block")}>
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-1 border-b border-white/[0.06] pb-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all",
              filter === "all"
                ? "bg-[#F5F5F5] text-[#0B0F17] font-semibold"
                : "bg-[#171E29] text-[#A1A1AA] hover:text-[#F5F5F5]"
            )}
          >
            All Sources ({evidence.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("supporting")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all",
              filter === "supporting"
                ? "bg-[#10B981] text-[#0B0F17] font-semibold"
                : "bg-[#171E29] text-[#A1A1AA] hover:text-[#10B981]"
            )}
          >
            Supporting ({supportingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("contradicting")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all",
              filter === "contradicting"
                ? "bg-[#EF4444] text-[#F5F5F5] font-semibold"
                : "bg-[#171E29] text-[#A1A1AA] hover:text-[#EF4444]"
            )}
          >
            Contradicting ({contradictingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("qualifying")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all",
              filter === "qualifying"
                ? "bg-[#F59E0B] text-[#0B0F17] font-semibold"
                : "bg-[#171E29] text-[#A1A1AA] hover:text-[#F59E0B]"
            )}
          >
            Qualifying ({qualifyingCount})
          </button>
        </div>

        {/* Evidence Items */}
        <div className="grid gap-3 pt-2">
          {filtered.map((item) => {
            const relBadge =
              item.relationship === "supporting"
                ? { label: "Supporting", color: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30", icon: CheckCircle2 }
                : item.relationship === "contradicting"
                ? { label: "Contradicting", color: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30", icon: XCircle }
                : item.relationship === "qualifying"
                ? { label: "Qualifying", color: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30", icon: AlertTriangle }
                : { label: "Neutral / Background", color: "bg-[#64748B]/15 text-[#A1A1AA] border-[#64748B]/30", icon: FileText };

            const RelIcon = relBadge.icon;
            const isSyndicated = item.sourceRelationship === "syndicated";

            const syndicatedOutlets: SyndicatedOutlet[] | undefined = isSyndicated
              ? evidence
                  .filter(
                    (e) =>
                      e.id !== item.id &&
                      e.domain !== item.domain &&
                      e.sourceRelationship === "syndicated" &&
                      e.url
                  )
                  .map((e) => ({
                    domain: e.domain,
                    url: e.url,
                    title: e.title,
                  }))
              : undefined;

            return (
              <SourceLink
                key={item.id}
                id={`evidence-${item.id}`}
                variant="evidence-card"
                url={item.url}
                domain={item.domain}
                title={item.title}
                originType={item.sourceRelationship}
                isWireSyndicated={isSyndicated}
                isIndependent={item.sourceRelationship === "independent" || item.sourceRelationship === "original"}
                syndicatedOutlets={syndicatedOutlets && syndicatedOutlets.length > 0 ? syndicatedOutlets : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border", relBadge.color)}>
                      <RelIcon className="w-3.5 h-3.5" />
                      <span>{relBadge.label}</span>
                    </span>

                    {item.sourceType && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-[#A1A1AA]">
                        {item.sourceType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-[#64748B]">
                    {item.id}
                  </span>
                </div>

                {item.snippet && (
                  <p className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-3">
                    {item.snippet}
                  </p>
                )}
              </SourceLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}

