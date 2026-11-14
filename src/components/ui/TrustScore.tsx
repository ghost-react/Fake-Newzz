"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { VeracityStatus } from "@/types/verification";
import { VeracityVerdict } from "@/schemas/verification";

interface TrustScoreProps {
  score: number;
  verdict?: VeracityStatus | VeracityVerdict | string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function TrustScore({
  score,
  verdict = "mostly_true",
  size = 190,
  strokeWidth = 14,
  className,
}: TrustScoreProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const normalizedVerdict = typeof verdict === "string" ? verdict.toLowerCase() : "";

  const colorConfig = (() => {
    if (normalizedVerdict === "unverified") {
      return {
        stroke: "#94A3B8", // slate-400
        text: "text-slate-300",
        label: "UNVERIFIED",
        glow: "rgba(148, 163, 184, 0.2)",
        sublabel: "INSUFFICIENT DATA",
      };
    }
    if (normalizedVerdict === "misleading") {
      return {
        stroke: "#F59E0B", // amber-500
        text: "text-amber-400",
        label: "MISLEADING",
        glow: "rgba(245, 158, 11, 0.35)",
        sublabel: "CONTEXT DISTORTED",
      };
    }
    if (score >= 75) {
      return {
        stroke: "#10B981", // emerald-500
        text: "text-emerald-400",
        label: "HIGH TRUST",
        glow: "rgba(16, 185, 129, 0.35)",
        sublabel: "VERIFIED BY MULTI-SOURCE",
      };
    }
    if (score >= 50) {
      return {
        stroke: "#38BDF8", // sky-400
        text: "text-sky-300",
        label: "MODERATE TRUST",
        glow: "rgba(56, 189, 248, 0.35)",
        sublabel: "MIXED EVIDENCE",
      };
    }
    if (score >= 25) {
      return {
        stroke: "#FB923C", // orange-400
        text: "text-orange-400",
        label: "LOW TRUST",
        glow: "rgba(251, 146, 60, 0.35)",
        sublabel: "PREDOMINANTLY CONTRADICTED",
      };
    }
    return {
      stroke: "#EF4444", // red-500
      text: "text-rose-400",
      label: "VERY LOW TRUST",
      glow: "rgba(239, 68, 68, 0.35)",
      sublabel: "CONTRADICTED BY EVIDENCE",
    };
  })();

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center select-none",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Outer ambient glow ring */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-40 transition-colors duration-700 pointer-events-none"
        style={{ backgroundColor: colorConfig.glow }}
      />

      <svg
        width={size}
        height={size}
        className="transform -rotate-90 drop-shadow-[0_0_12px_rgba(0,0,0,0.5)]"
      >
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorConfig.stroke} stopOpacity="1" />
            <stop offset="100%" stopColor={colorConfig.stroke} stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress Circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      {/* Center Label & Number Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        <div className="flex items-baseline justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={cn("text-4xl lg:text-5xl font-extrabold tracking-tight font-mono", colorConfig.text)}
          >
            {score}
          </motion.span>
          <span className="text-sm font-semibold text-slate-400 font-mono ml-0.5">
            /100
          </span>
        </div>

        <span
          className={cn(
            "text-[10px] font-mono font-bold tracking-widest uppercase mt-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10",
            colorConfig.text
          )}
        >
          {colorConfig.label}
        </span>

        <span className="text-[9px] text-slate-400 font-medium tracking-tight mt-1 max-w-[120px] leading-tight opacity-80">
          {colorConfig.sublabel}
        </span>
      </div>
    </div>
  );
}
