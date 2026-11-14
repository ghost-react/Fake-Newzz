"use client";

import React, { useState } from "react";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { ComparisonReport, CrossSourceComparison, ClaimComparisonResult } from "@/schemas/comparison";
import { Evidence } from "@/schemas/evidence";
import { SourceLink, SyndicatedOutlet } from "@/components/ui/SourceLink";
import { cn } from "@/lib/utils";

interface CrossSourceSectionProps {
  comparison?: ComparisonReport | null;
  legacyComparison?: CrossSourceComparison | null;
  evidence?: Evidence[];
  claimsMap?: Map<string, string>;
  className?: string;
}

export function CrossSourceSection(props: CrossSourceSectionProps) {
  // Gracefully hide section if neither comparison nor legacyComparison is present
  if (!props.comparison && !props.legacyComparison) {
    return null;
  }

  return <CrossSourceInner {...props} />;
}

function CrossSourceInner({
  comparison,
  legacyComparison,
  evidence = [],
  claimsMap = new Map(),
  className,
}: CrossSourceSectionProps) {
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});

  const toggleClaim = (id: string) => {
    setExpandedClaims((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build evidence lookup
  const evidenceMap = new Map<string, Evidence>();
  evidence.forEach((e) => evidenceMap.set(e.id, e));

  // Determine totals
  const totalClusters =
    comparison?.totalIndependentClusters ??
    legacyComparison?.independentSourcesCount ??
    0;

  const totalExamined =
    legacyComparison?.totalPublicationsExamined ??
    (comparison ? Math.max(totalClusters, evidence.length) : 0);

  const totalConflicts =
    comparison?.totalConflicts ??
    legacyComparison?.claimsConflictingCount ??
    0;

  const claimsList = comparison?.claims || [];

  return (
    <section
      data-testid="cross-source-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg space-y-6",
        className
      )}
    >
      {/* Header & Summary Row */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-widest text-[var(--tone-text,#10B981)] transition-colors duration-300">
          <Layers className="w-4 h-4" />
          <span>Cross-Source Comparison Engine</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5]">
              Cross-Source Evidence Corroboration
            </h2>
            {/* Summary Row Specification */}
            <p className="text-sm text-[#A1A1AA] mt-1 font-mono">
              <span className="text-[#10B981] font-semibold">{totalClusters} independent source cluster{totalClusters === 1 ? "" : "s"}</span> consulted across{" "}
              <span className="text-[#F5F5F5] font-semibold">{Math.max(totalClusters, totalExamined)} distinct outlet{Math.max(totalClusters, totalExamined) === 1 ? "" : "s"}</span>
            </p>
          </div>

          {totalConflicts > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-medium shrink-0">
              <AlertTriangle className="w-4 h-4" />
              <span>{totalConflicts} conflict{totalConflicts === 1 ? "" : "s"} detected across reports</span>
            </div>
          )}
        </div>
      </div>

      {/* Syndicated Wire Grouping Banner */}
      {legacyComparison?.wireAgenciesDetected && legacyComparison.wireAgenciesDetected.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#171E29] border border-white/5 flex items-center gap-3 text-xs text-[#A1A1AA]">
          <GitBranch className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>
            Wire syndication detected ({legacyComparison.wireAgenciesDetected.join(", ")}): Syndicated republishings are grouped under the originating wire and counted as <strong className="text-[#F5F5F5]">one</strong> independent source.
          </span>
        </div>
      )}

      {/* Claim Comparisons List */}
      <div className="space-y-3 pt-2">
        {claimsList.map((c) => {
          const isExpanded = !!expandedClaims[c.claimId];
          const claimText = claimsMap.get(c.claimId) || `Claim: ${c.claimId}`;

          const agreementColor =
            c.agreementSummary === "strong"
              ? "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30"
              : c.agreementSummary === "moderate"
              ? "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30"
              : c.agreementSummary === "weak"
              ? "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30"
              : "text-[#64748B] bg-[#64748B]/10 border-[#64748B]/30";

          return (
            <div
              key={c.claimId}
              className="rounded-2xl bg-[#171E29]/70 border border-white/[0.06] overflow-hidden transition-all duration-200"
            >
              {/* Claim Header Bar */}
              <button
                type="button"
                onClick={() => toggleClaim(c.claimId)}
                className="w-full p-4 text-left flex items-start sm:items-center justify-between gap-4 hover:bg-[#171E29] transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border font-semibold", agreementColor)}>
                      {c.agreementSummary} Agreement
                    </span>
                    <span className="text-xs text-[#A1A1AA] font-mono">
                      {c.independentClusterCount} cluster{c.independentClusterCount === 1 ? "" : "s"}
                    </span>
                    {c.conflicts.length > 0 && (
                      <span className="text-[11px] font-medium text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 px-2 py-0.5 rounded-md">
                        {c.conflicts.length} Conflict{c.conflicts.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#F5F5F5] line-clamp-2">
                    {claimText}
                  </p>
                </div>

                <div className="text-[#A1A1AA] p-1 shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Expanded Comparison Details */}
              {isExpanded && (
                <div className="p-4 pt-1 border-t border-white/[0.06] space-y-4 text-xs sm:text-sm">
                  {/* Dimensions Tested */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
                      Dimension Comparison
                    </h3>

                    <div className="grid gap-2.5">
                      {c.dimensions.map((dim, dIdx) => {
                        const isUpdate = dim.note?.toLowerCase().includes("possible_update") || dim.note?.toLowerCase().includes("changed between");

                        return (
                          <div
                            key={dIdx}
                            className="p-3 rounded-xl bg-[#111923] border border-white/5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-semibold uppercase text-xs text-[#F5F5F5]">
                                {dim.dimension.replace(/_/g, " ")}
                              </span>

                              <div className="flex items-center gap-2">
                                {isUpdate && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 font-medium">
                                    <Clock className="w-3 h-3" />
                                    <span>Details changed between reports</span>
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[10px] uppercase font-mono px-2 py-0.5 rounded",
                                  dim.outcome === "agreement"
                                    ? "bg-[#10B981]/15 text-[#10B981]"
                                    : dim.outcome === "contradiction"
                                    ? "bg-[#EF4444]/15 text-[#EF4444]"
                                    : "bg-[#64748B]/15 text-[#A1A1AA]"
                                )}>
                                  {dim.outcome}
                                </span>
                              </div>
                            </div>

                            {/* Side-by-side values & short quotes (< 15 words) */}
                            <div className="grid sm:grid-cols-2 gap-2 pt-1">
                              <div className="p-2.5 rounded-xl bg-[#171E29] border border-white/5 space-y-1">
                                <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block mb-0.5">
                                  Article Stated
                                </span>
                                <p className="text-xs text-[#F5F5F5]">{dim.articleValue}</p>
                              </div>

                              {dim.sourceValues.map((sv, svIdx) => {
                                const ev = evidenceMap.get(sv.evidenceId);
                                const isSyndicated = ev?.sourceRelationship === "syndicated";
                                const domain = ev?.domain || sv.clusterId;

                                // Collect syndicated outlets in same cluster if wire or syndicated
                                const syndicatedOutlets: SyndicatedOutlet[] | undefined = isSyndicated
                                  ? evidence
                                      .filter(
                                        (e) =>
                                          e.id !== sv.evidenceId &&
                                          e.domain !== domain &&
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
                                    key={svIdx}
                                    variant="comparison-row"
                                    url={ev?.url}
                                    domain={domain}
                                    headline={ev?.title}
                                    originType={ev?.sourceRelationship || (isSyndicated ? "syndicated" : "unknown")}
                                    isWireSyndicated={isSyndicated}
                                    isIndependent={ev?.sourceRelationship === "independent" || ev?.sourceRelationship === "original"}
                                    quote={sv.quote}
                                    syndicatedOutlets={syndicatedOutlets && syndicatedOutlets.length > 0 ? syndicatedOutlets : undefined}
                                  >
                                    <p className="text-xs text-[#F5F5F5] font-sans">{sv.value}</p>
                                  </SourceLink>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specific Conflicts */}
                  {c.conflicts.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/25 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444]">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Direct Conflicts Identified</span>
                      </div>
                      <div className="space-y-2">
                        {c.conflicts.map((conf, cfIdx) => {
                          const conflictSources = conf.evidenceIds
                            .map((eid) => evidenceMap.get(eid))
                            .filter(Boolean) as Evidence[];
                          return (
                            <div
                              key={cfIdx}
                              className="text-xs text-[#F5F5F5] space-y-1.5 pt-1.5 border-t border-[#EF4444]/15 first:border-t-0 first:pt-0"
                            >
                              <div>
                                <strong className="capitalize text-[#EF4444] font-mono">{conf.dimension}: </strong>
                                <span>{conf.description}</span>
                              </div>
                              {conflictSources.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <span className="text-[10px] font-mono uppercase text-[#EF4444]/80">Sources:</span>
                                  {conflictSources.map((cev) => (
                                    <SourceLink
                                      key={cev.id}
                                      variant="citation-pill"
                                      url={cev.url}
                                      domain={cev.domain}
                                      title={cev.title}
                                      originType={cev.sourceRelationship}
                                      className="border-[#EF4444]/30 hover:border-[#EF4444]/60"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
