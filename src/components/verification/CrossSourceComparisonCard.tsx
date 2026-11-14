"use client";

import React, { useState } from "react";
import {
  GitCompare,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Radio,
  FileText,
  ChevronDown,
  ChevronUp,
  Building,
} from "lucide-react";
import { CrossSourceComparison, ClaimComparison } from "@/schemas/comparison";
import { SourceLink } from "@/components/ui/SourceLink";
import { cn } from "@/lib/utils";

interface CrossSourceComparisonCardProps {
  comparison?: CrossSourceComparison | null;
  className?: string;
}

const FINDING_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  agreement: {
    label: "Full Agreement",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  partial_agreement: {
    label: "Partial Agreement",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    icon: CheckCircle2,
  },
  additional_context: {
    label: "Additional Context",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: AlertTriangle,
  },
  contradiction: {
    label: "Conflicting Details",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
  unsupported_detail: {
    label: "Unsupported Detail",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    icon: AlertTriangle,
  },
  unresolved_information: {
    label: "Unresolved",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    icon: HelpCircle,
  },
};

export function CrossSourceComparisonCard({
  comparison,
  className,
}: CrossSourceComparisonCardProps) {
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});

  if (!comparison || comparison.totalPublicationsExamined === 0) {
    return (
      <div className={cn("rounded-2xl surface-card p-6 border border-white/[0.08] space-y-3", className)}>
        <div className="flex items-center gap-2.5 text-[#F5F5F5]">
          <GitCompare className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-editorial font-bold">Cross-Source Comparison</h2>
        </div>
        <p className="text-xs text-[#717B89] font-mono">
          Single-source record examined. No independent external news outlets have published verifiable corroboration for this specific event yet.
        </p>
      </div>
    );
  }

  const toggleClaim = (id: string) => {
    setExpandedClaims((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className={cn("rounded-2xl surface-card p-6 sm:p-8 border border-white/[0.08] space-y-6 shadow-xl", className)}>
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <GitCompare className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5] tracking-tight">
              Cross-Source Comparison
            </h2>
          </div>
          <p className="text-xs text-[#717B89] font-mono">
            Comparing claims across {comparison.totalPublicationsExamined} distinct publications • Original:{" "}
            <span className="text-[#F5F5F5] font-semibold">{comparison.originalPublisher}</span>
          </p>
        </div>

        {/* Publication Stats Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
            <strong>{comparison.independentSourcesCount}</strong> Independent
          </div>
          <div className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-mono">
            <strong>{comparison.syndicatedSourcesCount}</strong> Wire / Syndicated
          </div>
          {comparison.wireAgenciesDetected.length > 0 && (
            <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
              Wire: {comparison.wireAgenciesDetected.join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* 2. Key Synthesis Banner */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <p className="text-xs sm:text-sm text-[#E2E8F0] font-sans leading-relaxed">
          {comparison.summary}
        </p>

        <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
          <span className="text-emerald-400">
            ✓ {comparison.claimsAgreedCount} Agreed
          </span>
          {comparison.claimsConflictingCount > 0 && (
            <span className="text-rose-400">
              ✕ {comparison.claimsConflictingCount} Conflicting
            </span>
          )}
          {comparison.claimsUnresolvedCount > 0 && (
            <span className="text-slate-400">
              ○ {comparison.claimsUnresolvedCount} Unresolved
            </span>
          )}
        </div>
      </div>

      {/* 3. Publications Examined Drawer / Row */}
      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#717B89] font-bold block">
          Examined Publications & Wire Affiliation
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {comparison.publications.map((pub, idx) => (
            <SourceLink
              key={`${pub.domain}-${idx}`}
              url={pub.url}
              domain={pub.domain}
              headline={pub.title}
              originType={pub.isWireSyndicated ? "syndicated" : pub.isIndependent ? "original" : "unknown"}
              isWireSyndicated={pub.isWireSyndicated}
              isIndependent={pub.isIndependent}
              variant="comparison-row"
            />
          ))}
        </div>
      </div>

      {/* 4. Detailed Claim Comparison Cards */}
      <div className="space-y-3 pt-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#717B89] font-bold block">
          Claim-by-Claim Multi-Source Analysis
        </span>

        {comparison.claimsCompared.map((claimComp) => {
          const cfg = FINDING_CONFIG[claimComp.findingType] || FINDING_CONFIG.unresolved_information;
          const Icon = cfg.icon;
          const isExpanded = expandedClaims[claimComp.claimId] ?? false;

          return (
            <div
              key={claimComp.claimId}
              className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggleClaim(claimComp.claimId)}
                className="w-full p-4 sm:p-5 text-left flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase",
                        cfg.badgeClass
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{cfg.label}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase text-[#717B89]">
                      Dimension: {claimComp.dimension.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-medium text-[#F5F5F5] leading-snug">
                    {claimComp.claimText}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] font-sans">
                    {claimComp.summary}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
                  <span className="text-xs font-mono text-[#717B89]">
                    {claimComp.sources.length} source{claimComp.sources.length !== 1 ? "s" : ""}
                  </span>
                  <div className="p-1 rounded bg-white/[0.04] text-[#717B89]">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="p-4 sm:p-5 border-t border-white/[0.06] bg-black/20 space-y-4 text-xs font-sans">
                  {/* Agreement Points */}
                  {claimComp.agreedPoints.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
                        Points of Agreement
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-[#A1A1AA]">
                        {claimComp.agreedPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Conflicting Points */}
                  {claimComp.conflictingPoints.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase font-bold text-rose-400 tracking-wider">
                        Conflicting Details
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-rose-200">
                        {claimComp.conflictingPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cited Sources List with Clickable Links */}
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase font-bold text-[#717B89] tracking-wider block">
                      Sources Examined for this Claim ({claimComp.sources.length})
                    </span>
                    <div className="space-y-1.5">
                      {claimComp.sources.map((s, idx) => (
                        <SourceLink
                          key={`${s.domain}-${idx}`}
                          url={s.url}
                          domain={s.domain}
                          title={s.title}
                          originType={s.relationship}
                          variant="comparison-row"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

