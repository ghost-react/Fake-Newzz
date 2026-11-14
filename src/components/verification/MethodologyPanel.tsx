"use client";

import React from "react";
import { X, ShieldCheck, Scale, Search, CheckCircle2, AlertTriangle, FileText, Database } from "lucide-react";

interface MethodologyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MethodologyPanel({ isOpen, onClose }: MethodologyPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-3xl my-8 rounded-3xl glass-panel border border-white/15 bg-slate-900/95 p-6 sm:p-8 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                FakeNewzz Evidence Methodology
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Core Principles, Tiered Retrieval & Deterministic Veracity Matrix
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {/* Principle 1 */}
          <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Scale className="w-4 h-4" />
              <span>1. Independent Evidence Is the Sole Source of Truth</span>
            </div>
            <p className="text-slate-300">
              Automated tools can misinterpret unverified assertions. In FakeNewzz, algorithmic processing is restricted strictly to <strong>isolating testable assertions and evaluating textual entailment</strong>. The verification layer is exclusively powered by verified public records, primary documents, and independent reporting.
            </p>
          </div>

          {/* Principle 2 */}
          <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
              <Scale className="w-4 h-4" />
              <span>2. No Predetermined Political or Outlet Bias</span>
            </div>
            <p className="text-slate-300">
              FakeNewzz does not assume that mainstream media, independent publishers, government gazettes, opposition factions, or social commentators are inherently trustworthy or deceitful. Every claim is cross-examined against verifiable physical, legal, or observational evidence.
            </p>
          </div>

          {/* Principle 3 */}
          <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Database className="w-4 h-4" />
              <span>3. Multi-Tier Retrieval Architecture</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="font-bold text-emerald-300 block mb-0.5">Tier 1: Primary Records</span>
                Official government gazettes, court filings, open scientific datasets, and corporate statutory disclosures.
              </div>
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="font-bold text-sky-300 block mb-0.5">Tier 2: Global Wire Services</span>
                Reuters, Associated Press (AP), AFP, and international syndicated wire bureaus.
              </div>
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="font-bold text-indigo-300 block mb-0.5">Tier 3: Independent Press</span>
                Investigative journalists, regional outlets, and domestic investigative desks.
              </div>
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="font-bold text-amber-300 block mb-0.5">Tier 4: Fact-Check Registries</span>
                Verified signatories of the International Fact-Checking Network (IFCN).
              </div>
            </div>
          </div>

          {/* Principle 4 */}
          <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>4. Four-State Veracity Classification</span>
            </div>
            <p className="text-slate-300">
              Instead of binary true/false badges, FakeNewzz enforces nuanced categorization:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs pl-1">
              <li><strong className="text-emerald-400">VERIFIED TRUE:</strong> Corroborated by 2+ independent Tier 1/2 sources or official primary filings.</li>
              <li><strong className="text-amber-400">MISLEADING / CONTEXT MISSING:</strong> Factual statement that suppresses critical qualifying thresholds, dates, or exceptions.</li>
              <li><strong className="text-rose-400">FALSE / CONTRADICTED:</strong> Directly disproven by primary records or undisputed empirical evidence.</li>
              <li><strong className="text-slate-400">UNVERIFIED:</strong> Insufficient live evidence. The system makes uncertainty explicit instead of speculating.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer"
          >
            I Understand the Standards
          </button>
        </div>
      </div>
    </div>
  );
}
