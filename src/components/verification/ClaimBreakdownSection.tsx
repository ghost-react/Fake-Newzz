"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Layers, Link as LinkIcon, ExternalLink } from "lucide-react";
import { ClaimEvaluation, Verdict, Confidence } from "@/schemas/evaluation";
import { ClaimInput, ClaimLayer, Evidence } from "@/schemas/evidence";
import { SourceLink } from "@/components/ui/SourceLink";
import { cn } from "@/lib/utils";

export const LAYER_TITLES: Record<ClaimLayer, { heading: string; description?: string }> = {
  event_occurred: {
    heading: "What happened",
    description: "Core events and actions reported to have occurred.",
  },
  statement_made: {
    heading: "Who said it",
    description: "Whether a named official or entity made or alleged the statement.",
  },
  quote_wording: {
    heading: "Exact words",
    description: "Whether the quoted words were accurately recorded.",
  },
  underlying_fact: {
    heading: "Whether it is true",
    description: "Verification of the underlying factual proposition asserted.",
  },
  interpretation: {
    heading: "Interpretation",
    description: "Not scored — opinions and framing are not verified as facts.",
  },
};

interface ClaimBreakdownSectionProps {
  evaluations: ClaimEvaluation[];
  claims?: ClaimInput[];
  evidence?: Evidence[];
  className?: string;
  onSelectEvidence?: (evidenceId: string) => void;
}

export function ClaimBreakdownSection({
  evaluations,
  claims = [],
  evidence = [],
  className,
  onSelectEvidence,
}: ClaimBreakdownSectionProps) {
  const claimMap = new Map<string, ClaimInput>();
  claims.forEach((c) => claimMap.set(c.id, c));

  const evidenceMap = new Map<string, Evidence>();
  (evidence || []).forEach((e) => evidenceMap.set(e.id, e));

  // Group evaluations by layer
  const layerGroups: Record<ClaimLayer, ClaimEvaluation[]> = {
    event_occurred: [],
    statement_made: [],
    quote_wording: [],
    underlying_fact: [],
    interpretation: [],
  };

  evaluations.forEach((ev) => {
    const claim = claimMap.get(ev.claimId);
    const layer = (claim?.layer || ev.layer || "underlying_fact") as ClaimLayer;
    if (layerGroups[layer]) {
      layerGroups[layer].push(ev);
    } else {
      layerGroups.underlying_fact.push(ev);
    }
  });

  const getVerdictChip = (verdict: Verdict) => {
    switch (verdict) {
      case "supporting":
        return {
          label: "Supported",
          icon: CheckCircle2,
          className: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
        };
      case "contradicting":
        return {
          label: "Contradicted",
          icon: XCircle,
          className: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
        };
      case "qualifying":
        return {
          label: "Needs Context",
          icon: AlertTriangle,
          className: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
        };
      case "insufficient":
        // Neutral grey (#64748B), NEVER red as strictly mandated!
        return {
          label: "Not enough evidence",
          icon: HelpCircle,
          className: "bg-[#64748B]/15 text-[#64748B] border-[#64748B]/30",
        };
    }
  };

  const layersOrdered: ClaimLayer[] = [
    "event_occurred",
    "statement_made",
    "quote_wording",
    "underlying_fact",
    "interpretation",
  ];

  return (
    <section
      data-testid="claim-breakdown-section"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg space-y-6",
        className
      )}
    >
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-widest text-[var(--tone-text,#10B981)] transition-colors duration-300">
          <Layers className="w-4 h-4" />
          <span>Layered Claim Verification</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5]">
          Claim Breakdown by Assertion Layer
        </h2>
        <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1">
          Complex reports are decomposed into separate assertion layers to distinguish what happened from what was said or interpreted.
        </p>
      </div>

      <div className="space-y-6">
        {layersOrdered.map((layerKey) => {
          const evals = layerGroups[layerKey];
          if (!evals || evals.length === 0) return null;

          const layerMeta = LAYER_TITLES[layerKey];
          const isInterpretation = layerKey === "interpretation";

          return (
            <div key={layerKey} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                <div>
                  <h3 className="text-base sm:text-lg font-editorial font-bold text-[#F5F5F5]">
                    {layerMeta.heading}
                  </h3>
                  {layerMeta.description && (
                    <p className="text-xs text-[#A1A1AA]">{layerMeta.description}</p>
                  )}
                </div>

                {isInterpretation && (
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#64748B]/15 text-[#A1A1AA] border border-white/10 font-semibold">
                    Not scored — opinions and framing are not verified as facts
                  </span>
                )}
              </div>

              <div className="grid gap-3">
                {evals.map((ev) => {
                  const claim = claimMap.get(ev.claimId);
                  const claimText = claim?.text || ev.claimId;
                  const chip = getVerdictChip(ev.verdict);
                  const ChipIcon = chip.icon;

                  return (
                    <div
                      key={ev.claimId}
                      className="p-4 rounded-2xl bg-[#171E29]/70 border border-white/[0.06] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Verdict Chip */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                              chip.className
                            )}
                          >
                            <ChipIcon className="w-3.5 h-3.5" />
                            <span>{chip.label}</span>
                          </span>

                          {/* Confidence Indicator */}
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA] font-mono px-2 py-0.5 rounded bg-[#111923] border border-white/5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  ev.confidence === "high"
                                    ? "#10B981"
                                    : ev.confidence === "medium"
                                    ? "#F59E0B"
                                    : "#64748B",
                              }}
                            />
                            <span className="capitalize">{ev.confidence} Confidence</span>
                          </span>

                          {claim?.importance && (
                            <span className="text-[10px] font-mono uppercase text-[#A1A1AA] px-1.5 py-0.5 rounded bg-white/5">
                              {claim.importance} importance
                            </span>
                          )}
                        </div>

                        {/* Evidence Citation Count */}
                        {ev.evidenceIds && ev.evidenceIds.length > 0 && (
                          <span className="text-xs text-[#A1A1AA] font-mono">
                            {ev.evidenceIds.length} source citation{ev.evidenceIds.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      {/* Claim Text */}
                      <p className="text-sm sm:text-base font-medium text-[#F5F5F5] leading-snug">
                        {claimText}
                      </p>

                      {/* Evaluator Plain-English Explanation */}
                      {ev.explanation && (
                        <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed border-l-2 border-white/10 pl-3">
                          {ev.explanation}
                        </p>
                      )}

                      {/* Evidence Link List */}
                      {ev.evidenceIds && ev.evidenceIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="text-[#64748B] flex items-center gap-1 font-mono text-[11px]">
                            <LinkIcon className="w-3 h-3" />
                            <span>Sources:</span>
                          </span>
                          {ev.evidenceIds.map((eid) => {
                            const matched = evidenceMap.get(eid);
                            return (
                              <SourceLink
                                key={eid}
                                variant="citation-pill"
                                url={matched?.url}
                                domain={matched?.domain || eid}
                                title={matched?.title}
                                originType={matched?.sourceRelationship}
                                isWireSyndicated={matched?.sourceRelationship === "syndicated"}
                                isIndependent={
                                  matched?.sourceRelationship === "independent" ||
                                  matched?.sourceRelationship === "original"
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

