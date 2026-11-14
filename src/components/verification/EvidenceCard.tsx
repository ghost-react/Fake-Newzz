import React from "react";
import { ExternalLink, Landmark, Globe, Newspaper, Shield, FileCheck2, Quote } from "lucide-react";
import { EvidenceSource } from "@/types/verification";
import { cn } from "@/lib/utils";

interface EvidenceCardProps {
  evidence: EvidenceSource;
  className?: string;
}

export function EvidenceCard({ evidence, className }: EvidenceCardProps) {
  const tierIcon = {
    PRIMARY_RECORD: Landmark,
    TIER_1_WIRE: Globe,
    INDEPENDENT_PRESS: Newspaper,
    FACT_CHECK_ARCHIVE: Shield,
    COMMERCIAL_MEDIA: FileCheck2,
  }[evidence.tier];

  const Icon = tierIcon;

  const stanceStyle = {
    SUPPORTS: {
      label: "Corroborates Claim",
      pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    CONTRADICTS: {
      label: "Directly Refutes",
      pill: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
    NEUTRAL: {
      label: "Neutral Reference",
      pill: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    },
    MENTIONS: {
      label: "Qualifying Context",
      pill: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
  }[evidence.stance];

  return (
    <div
      className={cn(
        "glass-card rounded-xl p-4 transition-all duration-200 border hover:border-white/20 hover:bg-white/[0.04] relative overflow-hidden group",
        evidence.isPrimaryDocument && "border-emerald-500/30 bg-emerald-950/10",
        className
      )}
    >
      {evidence.isPrimaryDocument && (
        <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 border-b border-l border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-bl-lg font-semibold flex items-center gap-1">
          <Landmark className="w-3 h-3" />
          Primary Official Record
        </div>
      )}

      <div className="flex items-center gap-2 mb-2.5">
        <div className="p-1.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
            {evidence.name}
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>{evidence.domain}</span>
            {evidence.publishDate && (
              <>
                <span>•</span>
                <span>{evidence.publishDate}</span>
              </>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border",
              stanceStyle.pill
            )}
          >
            {stanceStyle.label}
          </span>
        </div>
      </div>

      {/* Snippet */}
      <div className="mt-3 relative pl-4 border-l-2 border-emerald-500/40 text-xs text-slate-300 italic leading-relaxed bg-white/[0.015] py-1.5 pr-2 rounded-r">
        <Quote className="w-3 h-3 text-emerald-400/60 inline mr-1 -mt-1" />
        {evidence.extractedSnippet}
      </div>

      {/* Source Link */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-[11px] font-mono text-slate-400">
          Source Tier: <span className="text-slate-200">{evidence.tierLabel}</span>
        </span>

        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-300 hover:text-emerald-400 transition-colors text-xs font-medium"
        >
          <span>Examine Citation</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
