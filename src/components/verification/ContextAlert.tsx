import React from "react";
import { AlertTriangle, ExternalLink, ShieldAlert, FileText } from "lucide-react";
import { OmittedContext } from "@/types/verification";
import { cn } from "@/lib/utils";

interface ContextAlertProps {
  items: OmittedContext[];
  className?: string;
}

export function ContextAlert({ items, className }: ContextAlertProps) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-xl p-5 sm:p-7 glow-amber relative overflow-hidden",
        className
      )}
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Top Banner Notice */}
      <div className="flex items-start sm:items-center gap-3.5 mb-5 pb-4 border-b border-amber-500/20">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-amber-200 tracking-tight font-mono uppercase">
              Material Context Suppressed in Submitted Story
            </h3>
          </div>
          <p className="text-xs text-amber-300/80 mt-0.5">
            The claims are materially altered by the omission of the following statutory thresholds and factual exemptions:
          </p>
        </div>
      </div>

      {/* Bulleted Cards List matching ASCII format:
          • Article omitted...
          • Official document states...
      */}
      <div className="space-y-3.5">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="p-4 sm:p-5 rounded-xl bg-black/50 border border-amber-500/25 hover:border-amber-500/40 transition-colors space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-bold text-amber-100 flex items-start gap-2.5">
                <span className="text-amber-400 font-mono text-base">•</span>
                <span>{item.title}</span>
              </h4>

              <span
                className={cn(
                  "text-[10px] font-mono uppercase font-bold px-2.5 py-0.5 rounded border self-start sm:self-auto",
                  item.impact === "CRITICAL"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : item.impact === "MODERATE"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                )}
              >
                {item.impact} Distortion
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pl-4 border-l-2 border-amber-500/30">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                  • Article Omission / Framing
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-300 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  • Official Document / Primary Record
                </span>
                <p className="text-amber-200/90 leading-relaxed font-medium">
                  {item.substantiatedBy}
                </p>
              </div>
            </div>

            {item.sourceUrl && (
              <div className="pt-2 flex justify-end">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-white underline underline-offset-4"
                >
                  <span>Examine Substantiating Gazette Filing</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
