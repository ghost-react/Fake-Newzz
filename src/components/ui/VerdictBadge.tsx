import React from "react";
import { Check, X, AlertTriangle, HelpCircle } from "lucide-react";
import { VeracityStatus, ConfidenceLevel } from "@/types/verification";
import { VeracityVerdict, VerificationConfidence } from "@/schemas/verification";
import { cn } from "@/lib/utils";

interface VerdictBadgeProps {
  status: VeracityStatus | VeracityVerdict | string;
  confidence?: ConfidenceLevel | VerificationConfidence | string;
  size?: "sm" | "md" | "lg";
  showConfidence?: boolean;
  className?: string;
}

export function VerdictBadge({
  status,
  confidence,
  size = "md",
  showConfidence = false,
  className,
}: VerdictBadgeProps) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "unverified";

  const config = (() => {
    switch (normalized) {
      case "verified_true":
      case "verified":
        return {
          label: "Highly Trustworthy",
          icon: Check,
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
          glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)]",
        };
      case "mostly_true":
        return {
          label: "Mostly Trustworthy",
          icon: Check,
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
          glow: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
        };
      case "mixed":
        return {
          label: "Mixed Evidence",
          icon: AlertTriangle,
          bg: "bg-sky-500/15 border-sky-500/30 text-sky-300",
          glow: "shadow-[0_0_12px_rgba(56,189,248,0.25)]",
        };
      case "misleading":
      case "context_missing":
        return {
          label: "Potentially Misleading",
          icon: AlertTriangle,
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
          glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
        };
      case "mostly_false":
        return {
          label: "Mostly False",
          icon: X,
          bg: "bg-orange-500/15 border-orange-500/30 text-orange-400",
          glow: "shadow-[0_0_12px_rgba(251,146,60,0.3)]",
        };
      case "false":
      case "contradicted":
        return {
          label: "False",
          icon: X,
          bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
          glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]",
        };
      case "unverified":
      default:
        return {
          label: "Unable to Verify",
          icon: HelpCircle,
          bg: "bg-slate-500/15 border-slate-500/30 text-slate-300",
          glow: "shadow-[0_0_12px_rgba(100,116,139,0.2)]",
        };
    }
  })();

  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-xs gap-1.5",
    md: "px-3.5 py-1 text-xs gap-2",
    lg: "px-4 py-1.5 text-sm gap-2.5",
  }[size];

  const Icon = config.icon;
  const displayConfidence = confidence ? String(confidence).toUpperCase() : "";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-mono font-bold uppercase tracking-wider border backdrop-blur-md transition-all select-none",
        config.bg,
        config.glow,
        sizeClasses,
        className
      )}
    >
      <Icon className={cn(size === "lg" ? "w-4 h-4 stroke-[3]" : "w-3.5 h-3.5 stroke-[2.5]")} />
      <span>{config.label}</span>

      {showConfidence && displayConfidence && (
        <span className="ml-1 pl-2 border-l border-white/20 text-[10px] tracking-normal font-sans font-medium text-slate-300">
          {displayConfidence} CONFIDENCE
        </span>
      )}
    </div>
  );
}
