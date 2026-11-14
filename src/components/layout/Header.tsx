"use client";

import React, { useState } from "react";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onOpenMethodology: () => void;
  onOpenAbout?: () => void;
  activeReportId?: string;
  onSelectSample?: (id: string) => void;
  onScrollToSearch?: () => void;
}

export function Header({
  onOpenMethodology,
  onOpenAbout,
  activeReportId,
  onSelectSample,
  onScrollToSearch,
}: HeaderProps) {
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const samples = [
    {
      id: "tax-reform-exemption",
      label: "Tax Reform Surcharge",
      outlet: "Daily Chronicle",
      verdict: "MISLEADING",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    {
      id: "grid-shutdown-hoax",
      label: "Grid Blackout Hoax",
      outlet: "Viral Social Audio",
      verdict: "FALSE",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    },
    {
      id: "space-telescope-exoplanet",
      label: "Exoplanet Atmosphere",
      outlet: "Astronomy Herald",
      verdict: "VERIFIED",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    {
      id: "maritime-canal-blockage",
      label: "Canal Closure Incident",
      outlet: "Maritime Dispatch",
      verdict: "UNVERIFIED",
      badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    },
  ];

  const handleAboutClick = () => {
    if (onOpenAbout) {
      onOpenAbout();
    } else {
      setIsAboutOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0B0F17]/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: FakeNewzz Wordmark */}
        <div
          onClick={onScrollToSearch}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:border-emerald-500/50 transition-colors">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5] leading-none">
              FakeNewzz
            </span>
            <span className="text-[10px] font-mono text-[#717B89] tracking-wider uppercase mt-1 leading-none">
              Verify what you read.
            </span>
          </div>
        </div>

        {/* Right Compact Nav: Home | How it works | About (+ Sample case studies) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Home */}
          <button
            type="button"
            onClick={onScrollToSearch}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Home
          </button>

          {/* How it works */}
          <button
            type="button"
            onClick={onOpenMethodology}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            How it works
          </button>

          {/* About */}
          <button
            type="button"
            onClick={handleAboutClick}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            About
          </button>

          {/* Case Studies Dropdown */}
          {onSelectSample && (
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setIsReportsOpen(!isReportsOpen)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors border cursor-pointer",
                  isReportsOpen
                    ? "bg-white/10 text-white border-white/20"
                    : "text-[#A1A1AA] hover:text-white bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]"
                )}
              >
                <span>Examples</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isReportsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsReportsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl surface-card border border-white/10 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#717B89] border-b border-white/[0.06]">
                      Preset Case Studies
                    </div>
                    <div className="space-y-1 mt-1">
                      {samples.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => {
                            onSelectSample(sample.id);
                            setIsReportsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer",
                            activeReportId === sample.id
                              ? "bg-white/10 border border-white/15"
                              : "hover:bg-white/[0.04]"
                          )}
                        >
                          <div>
                            <div className="text-xs font-medium text-[#F5F5F5]">
                              {sample.label}
                            </div>
                            <div className="text-[10px] text-[#717B89] font-mono">
                              {sample.outlet}
                            </div>
                          </div>

                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border",
                              sample.badgeClass
                            )}
                          >
                            {sample.verdict}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Lightweight About Modal (if no custom handler provided) */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsAboutOpen(false)}
          />
          <div className="relative w-full max-w-lg surface-card rounded-2xl p-6 sm:p-8 space-y-5 border border-white/10 shadow-2xl z-10">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-editorial text-xl font-bold text-[#F5F5F5]">
                    About FakeNewzz
                  </h3>
                  <span className="text-xs font-mono text-[#717B89]">
                    Editorial Fact-Checking & Evidence Verification
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="text-xs font-mono text-[#717B89] hover:text-white px-2 py-1 rounded bg-white/[0.04]"
              >
                ESC
              </button>
            </div>

            <p className="text-sm text-[#A1A1AA] leading-relaxed font-sans">
              FakeNewzz is an independent digital verification system designed to evaluate factual claims against primary documents, official records, wire reports, and verified research.
            </p>

            <div className="space-y-3 border-t border-white/[0.08] pt-4 text-xs font-mono text-[#A1A1AA]">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">01.</span>
                <span>Atomic claim decomposition isolates testable assertions from opinion and rhetoric.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">02.</span>
                <span>Multi-source independent evidence retrieval prioritizes primary records and official archives.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">03.</span>
                <span>Deterministic mathematical scoring ensures auditable, explainable trust index scores without political bias.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
