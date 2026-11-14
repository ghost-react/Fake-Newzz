"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Search, Globe, Shield, Database } from "lucide-react";
import { motion } from "framer-motion";
import { ClaimInput } from "@/schemas/evidence";

interface SearchingEvidenceProps {
  claims: ClaimInput[];
}

const SEARCH_SUBSTEPS = [
  {
    title: "Generating search queries...",
    detail: "Preserving factual entities, names, numbers, and official terminology.",
    icon: Search,
  },
  {
    title: "Searching sources...",
    detail: "Querying public records, news archives, government portals & wire services.",
    icon: Globe,
  },
  {
    title: "Normalizing evidence...",
    detail: "Deduplicating sources and organizing citations for cross-comparison.",
    icon: Database,
  },
];

export function SearchingEvidence({ claims }: SearchingEvidenceProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < SEARCH_SUBSTEPS.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 rounded-3xl glass-panel border border-white/15 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-8 relative z-10 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-semibold uppercase tracking-wider">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Finding Independent Sources
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
          Searching sources...
        </h3>

        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Querying broad public records, official gazettes, wires, and institutional portals for{" "}
          <span className="text-emerald-400 font-semibold font-mono">
            {claims.length} atomic claim{claims.length > 1 ? "s" : ""}
          </span>
          .
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8 relative z-10">
        <div className="w-full h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400"
            initial={{ width: "15%" }}
            animate={{ width: `${((activeStep + 1) / SEARCH_SUBSTEPS.length) * 100}%` }}
            transition={{ ease: "easeInOut", duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3.5 relative z-10">
        {SEARCH_SUBSTEPS.map((step, idx) => {
          const isActive = idx === activeStep;
          const isDone = idx < activeStep;
          const Icon = step.icon;

          return (
            <div
              key={step.title}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all duration-300 ${
                isActive
                  ? "bg-white/[0.06] border-sky-500/40 shadow-lg"
                  : isDone
                  ? "bg-white/[0.02] border-white/5 opacity-80"
                  : "border-transparent opacity-35"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold mt-0.5 ${
                  isActive
                    ? "bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                    : isDone
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 text-slate-500"
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-semibold ${
                    isActive ? "text-slate-100" : isDone ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {step.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Claims Preview */}
      <div className="mt-6 pt-5 border-t border-white/10 space-y-2 relative z-10">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
          Target Claims Under Active Retrieval:
        </span>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {claims.map((claim, i) => (
            <div
              key={claim.id}
              className="text-xs text-slate-300 bg-black/30 rounded-lg p-2.5 border border-white/5 font-mono line-clamp-2"
            >
              <span className="text-emerald-400 font-bold mr-2">C{i + 1}:</span>
              &ldquo;{claim.text}&rdquo;
            </div>
          ))}
        </div>
      </div>

      {/* Status Notice */}
      <div className="mt-5 pt-4 border-t border-white/10 text-center relative z-10">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <Shield className="w-3 h-3 text-sky-400" />
          <span>Searching independent sources • Checking corroborating records</span>
        </div>
      </div>
    </div>
  );
}
