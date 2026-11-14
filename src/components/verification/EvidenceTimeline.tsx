import React from "react";
import { Clock, CheckCircle2, AlertCircle, ExternalLink, Calendar } from "lucide-react";
import { TimelineEvent } from "@/types/verification";
import { cn } from "@/lib/utils";

interface EvidenceTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function EvidenceTimeline({ events, className }: EvidenceTimelineProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className={cn("glass-panel rounded-2xl p-6 border", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Chronological Evidence Chain
            </h3>
            <p className="text-xs text-slate-400">
              Traceability from primary event origins to viral distribution and subsequent verification
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          {events.length} Key Events
        </span>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-sky-500 before:to-slate-700">
        {events.map((event, idx) => (
          <div key={event.id || idx} className="relative group">
            {/* Timeline node marker */}
            <div
              className={cn(
                "absolute -left-6 sm:-left-8 top-1 w-4 sm:w-5 h-4 sm:h-5 rounded-full border-2 bg-slate-900 flex items-center justify-center transition-all duration-300",
                event.isMilestone
                  ? "border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "border-slate-500 group-hover:border-sky-400"
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  event.isMilestone ? "bg-emerald-400" : "bg-slate-400"
                )}
              />
            </div>

            {/* Event Content */}
            <div className="p-4 rounded-xl bg-white/[0.025] border border-white/5 group-hover:border-white/15 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {event.timestamp}
                </span>

                <span className="text-[11px] font-mono text-slate-400">
                  Logged via {event.sourceName}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-slate-100 mt-1 mb-1 group-hover:text-emerald-300 transition-colors">
                {event.eventTitle}
              </h4>

              <p className="text-xs text-slate-300 leading-relaxed">
                {event.description}
              </p>

              {event.sourceUrl && (
                <div className="mt-2.5 pt-2 border-t border-white/5">
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Inspect logged filing</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
