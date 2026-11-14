"use client";

import React from "react";
import {
  ShieldAlert,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Scale,
  Sparkles,
} from "lucide-react";
import { Omission, OmissionSeverity, OmissionType } from "@/schemas/omission";
import { Evidence, ClaimInput } from "@/schemas/evidence";

interface OmissionsSectionProps {
  omissions: Omission[];
  evidence: Evidence[];
  claims: ClaimInput[];
  isLoading?: boolean;
}

const TYPE_CONFIG: Record<
  OmissionType,
  { label: string; badgeStyle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  missing_context: {
    label: "Missing Context",
    badgeStyle: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    icon: AlertTriangle,
  },
  missing_qualification: {
    label: "Missing Qualification",
    badgeStyle: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    icon: Scale,
  },
  missing_counter_evidence: {
    label: "Missing Counter-Evidence",
    badgeStyle: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    icon: ShieldAlert,
  },
  missing_source_context: {
    label: "Missing Source Context",
    badgeStyle: "bg-sky-500/15 border-sky-500/30 text-sky-300",
    icon: FileText,
  },
  misleading_framing: {
    label: "Misleading Framing",
    badgeStyle: "bg-purple-500/15 border-purple-500/30 text-purple-300",
    icon: HelpCircle,
  },
};

const SEVERITY_CONFIG: Record<OmissionSeverity, { label: string; badgeStyle: string }> = {
  high: {
    label: "High Severity",
    badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
  medium: {
    label: "Medium Severity",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  low: {
    label: "Low Severity",
    badgeStyle: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
};

export function OmissionsSection({
  omissions,
  evidence,
  claims,
  isLoading = false,
}: OmissionsSectionProps) {
  // Map evidence for fast lookup
  const evidenceMap = new Map<string, Evidence>();
  evidence.forEach((ev) => evidenceMap.set(ev.id, ev));

  // Map claims for fast lookup
  const claimMap = new Map<string, ClaimInput>();
  claims.forEach((c) => claimMap.set(c.id, c));

  return (
    <section className="space-y-4 pt-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
              Contextual Analysis
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-editorial font-bold text-white tracking-tight mt-1">
            What may be missing
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Material conditions, statistical baselines, and counter-evidence omitted from the article presentation.
          </p>
        </div>

        <div className="self-start sm:self-auto">
          {isLoading ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono animate-pulse">
              Analyzing context...
            </span>
          ) : omissions.length > 0 ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              {omissions.length} Material Omission{omissions.length > 1 ? "s" : ""} Detected
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No Material Omissions Detected
            </span>
          )}
        </div>
      </div>

      {/* Omissions List */}
      {omissions.length > 0 ? (
        <div className="space-y-4">
          {omissions.map((omission, idx) => {
            const typeConfig = TYPE_CONFIG[omission.type] || TYPE_CONFIG.missing_context;
            const severityConfig = SEVERITY_CONFIG[omission.severity] || SEVERITY_CONFIG.medium;
            const TypeIcon = typeConfig.icon;
            const relatedClaim = omission.claimId ? claimMap.get(omission.claimId) : null;

            // Grounding evidence items
            const groundedEvidence = omission.evidenceIds
              .map((id) => evidenceMap.get(id))
              .filter((e): e is Evidence => Boolean(e));

            return (
              <div
                key={omission.id || idx}
                className="rounded-2xl border border-amber-500/25 surface-card p-5 sm:p-6 space-y-4 shadow-lg hover:border-amber-500/40 transition-all"
              >
                {/* Omission Badges & Title Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold ${typeConfig.badgeStyle}`}
                    >
                      <TypeIcon className="w-3.5 h-3.5" />
                      <span>{typeConfig.label}</span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono uppercase font-bold ${severityConfig.badgeStyle}`}
                    >
                      {severityConfig.label}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
                      {omission.confidence} Confidence
                    </span>
                  </div>

                  {relatedClaim && (
                    <span className="text-[11px] font-mono text-slate-400 bg-black/40 px-2.5 py-1 rounded-md border border-white/5 truncate max-w-xs">
                      Claim: {relatedClaim.text}
                    </span>
                  )}
                </div>

                {/* Description & Impact Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                      Omitted Information / Presentation Gap
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed font-sans">
                      {omission.description}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-300 block tracking-wider">
                      Why It Matters to Reader Interpretation
                    </span>
                    <p className="text-sm text-amber-100/90 leading-relaxed font-sans font-medium">
                      {omission.whyItMatters}
                    </p>
                  </div>
                </div>

                {/* Grounding Evidence List */}
                {groundedEvidence.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold tracking-wider block">
                      Evidence Demonstrating Omission ({groundedEvidence.length} source{groundedEvidence.length > 1 ? "s" : ""})
                    </span>

                    <div className="grid grid-cols-1 gap-2">
                      {groundedEvidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 rounded-lg bg-black/30 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                {ev.sourceType.replace(/_/g, " ")}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px] truncate">
                                {ev.domain}
                              </span>
                            </div>
                            <h5 className="text-white font-medium truncate">
                              {ev.title}
                            </h5>
                          </div>

                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300 flex-shrink-0"
                          >
                            <span>Verify Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !isLoading ? (
        <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 text-center space-y-2">
          <div className="inline-flex p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-white">
            No Material Omissions Detected
          </h4>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Based on the retrieved public records, wire reports, and verified documents, the article presentation contains sufficient context for its primary claims without critical omission distortions.
          </p>
        </div>
      ) : null}
    </section>
  );
}
