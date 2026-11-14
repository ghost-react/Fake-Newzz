import React from "react";
import { ExternalLink, Newspaper, TrendingUp, TrendingDown, MinusCircle, EyeOff } from "lucide-react";
import { MediaCoverageItem } from "@/types/verification";
import { cn } from "@/lib/utils";

interface CoverageCardProps {
  item: MediaCoverageItem;
  className?: string;
}

export function CoverageCard({ item, className }: CoverageCardProps) {
  const stanceConfig = {
    SUPPORTIVE: {
      label: "Supportive Framing",
      icon: TrendingUp,
      badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
      accent: "border-t-emerald-500",
    },
    CRITICAL: {
      label: "Critical / Sceptical",
      icon: TrendingDown,
      badge: "bg-rose-500/15 border-rose-500/30 text-rose-300",
      accent: "border-t-rose-500",
    },
    NEUTRAL: {
      label: "Neutral / Descriptive",
      icon: MinusCircle,
      badge: "bg-sky-500/15 border-sky-500/30 text-sky-300",
      accent: "border-t-sky-500",
    },
    OMITTED_COVERAGE: {
      label: "Omitted Angle",
      icon: EyeOff,
      badge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
      accent: "border-t-amber-500",
    },
  }[item.stance];

  const StanceIcon = stanceConfig.icon;

  return (
    <div
      className={cn(
        "glass-panel rounded-2xl p-5 border flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-slate-900/90 hover:-translate-y-1 group relative overflow-hidden",
        "border-t-4",
        stanceConfig.accent,
        className
      )}
    >
      <div>
        {/* Header: Outlet name, category & stance */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5 text-slate-400" />
              <h4 className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors">
                {item.outletName}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              {item.outletCategory}
            </span>
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase border tracking-wider",
              stanceConfig.badge
            )}
          >
            <StanceIcon className="w-3 h-3" />
            <span>{stanceConfig.label}</span>
          </div>
        </div>

        {/* How this outlet headlined the story */}
        <div className="mt-2 mb-3.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Reported Headline
          </span>
          <blockquote className="text-sm font-editorial italic text-slate-200 border-l-2 border-white/20 pl-3 leading-snug">
            &ldquo;{item.headline}&rdquo;
          </blockquote>
        </div>

        {/* Framing & Editorial Focus Analysis */}
        <div className="rounded-xl p-3 bg-white/[0.025] border border-white/5 space-y-1 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90 font-semibold block">
            Framing & Bias Analysis
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {item.framingAnalysis}
          </p>
        </div>
      </div>

      {/* Footer: Key emphasis & Link */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
          {item.publishDate}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs font-medium group-hover:text-emerald-400"
        >
          <span>Read Story</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
