import React from "react";
import { ExternalLink, Landmark, Globe, Newspaper, Shield, FileCheck2 } from "lucide-react";
import { EvidenceSource } from "@/types/verification";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: EvidenceSource;
  className?: string;
  showSnippet?: boolean;
}

export function SourceBadge({
  source,
  className,
  showSnippet = false,
}: SourceBadgeProps) {
  const tierConfig = {
    PRIMARY_RECORD: {
      icon: Landmark,
      color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      tierTag: "Primary Record",
    },
    TIER_1_WIRE: {
      icon: Globe,
      color: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      tierTag: "Wire Service",
    },
    INDEPENDENT_PRESS: {
      icon: Newspaper,
      color: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
      tierTag: "Independent Press",
    },
    FACT_CHECK_ARCHIVE: {
      icon: Shield,
      color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      tierTag: "Fact Check Archive",
    },
    COMMERCIAL_MEDIA: {
      icon: FileCheck2,
      color: "border-slate-500/30 bg-slate-500/10 text-slate-300",
      tierTag: "Commercial Media",
    },
  }[source.tier];

  const stanceConfig = {
    SUPPORTS: {
      label: "Corroborates",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    CONTRADICTS: {
      label: "Refutes",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    NEUTRAL: {
      label: "Neutral",
      color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    },
    MENTIONS: {
      label: "Context",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  }[source.stance];

  const Icon = tierConfig.icon;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[1.02]",
        tierConfig.color,
        "hover:border-white/20 hover:bg-white/10 hover:shadow-lg",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-semibold text-slate-200 group-hover:text-white truncate max-w-[150px]">
        {source.name}
      </span>

      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border text-slate-400 border-white/10 bg-black/20">
        {tierConfig.tierTag}
      </span>

      <span
        className={cn(
          "text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold",
          stanceConfig.color
        )}
      >
        {stanceConfig.label}
      </span>

      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-white opacity-70 group-hover:opacity-100 transition-opacity ml-auto" />
    </a>
  );
}
