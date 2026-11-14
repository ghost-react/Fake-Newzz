"use client";

import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Scale, FileSearch } from "lucide-react";
import { motion } from "framer-motion";
import { ClaimInput } from "@/schemas/evidence";

interface EvaluatingClaimsProps {
  claims: ClaimInput[];
}

const EVALUATION_STEPS = [
  {
    title: "Filtering & ranking evidence...",
    detail: "Selecting high-value primary documents, official records, and independent wires.",
    icon: FileSearch,
  },
  {
    title: "Evaluating claims against evidence...",
    detail: "Assessing factual entailment, contradiction, qualification, and conflict resolution.",
    icon: Scale,
  },
  {
    title: "Validating traceability...",
    detail: "Strictly enforcing zero-hallucination guardrails and verifying all cited evidence IDs.",
    icon: ShieldCheck,
  },
];

export function EvaluatingClaims({ claims }: EvaluatingClaimsProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) =>
        prev < EVALUATION_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 rounded-3xl glass-panel border border-white/15 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-8 relative z-10 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold uppercase tracking-wider">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Comparing the Evidence
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
          Evaluating claims against evidence...
        </h3>

        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Reasoning strictly over retrieved evidence for{" "}
          <span className="text-emerald-400 font-semibold font-mono">
            {claims.length} atomic claim{claims.length > 1 ? "s" : ""}
          </span>
          . The model does not browse or use outside knowledge.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8 relative z-10">
        <div className="w-full h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400"
            initial={{ width: "20%" }}
            animate={{
              width: `${((activeStep + 1) / EVALUATION_STEPS.length) * 100}%`,
            }}
            transition={{ ease: "easeInOut", duration: 0.6 }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3.5 relative z-10">
        {EVALUATION_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = idx === activeStep;
          const isDone = idx < activeStep;

          return (
            <div
              key={step.title}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                isCurrent
                  ? "bg-white/[0.06] border-emerald-500/40 shadow-lg"
                  : isDone
                  ? "bg-white/[0.02] border-emerald-500/20 text-slate-400"
                  : "bg-transparent border-white/5 text-slate-500"
              }`}
            >
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  isCurrent
                    ? "bg-emerald-500/20 text-emerald-300"
                    : isDone
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-white/5 text-slate-500"
                }`}
              >
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? "text-white"
                      : isDone
                      ? "text-slate-300"
                      : "text-slate-500"
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
    </div>
  );
}
