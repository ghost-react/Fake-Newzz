"use client";

import React, { useState } from "react";
import { Search, ArrowRight, X, Link2, FileText, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectInputType, DetectedInputType } from "@/lib/input/detectInputType";

export type { DetectedInputType };

interface SearchBarProps {
  onSearch: (query: string, type: DetectedInputType) => void;
  isLoading?: boolean;
  initialQuery?: string;
  placeholder?: string;
  className?: string;
}

export { detectInputType };

export function SearchBar({
  onSearch,
  isLoading = false,
  initialQuery = "",
  placeholder = "Paste a news article link",
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const detectedType = detectInputType(query);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim(), detectedType);
  };

  const getBadgeInfo = (type: DetectedInputType) => {
    if (type === "url") {
      return { label: "News Article Link", icon: Link2 };
    }
    return null;
  };

  const badge = query.trim() ? getBadgeInfo(detectedType) : null;
  const BadgeIcon = badge?.icon;

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center bg-[#111923] border border-white/[0.1] rounded-2xl shadow-xl transition-all duration-300 focus-within:border-[#10B981]/50 focus-within:ring-2 focus-within:ring-[#10B981]/20">
          {/* Leading Search Icon */}
          <div className="pl-4 sm:pl-5 text-[#64748B] flex items-center pointer-events-none">
            <Search className="w-5 h-5 group-focus-within:text-[#10B981] transition-colors" />
          </div>

          {/* Single Universal Input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder={placeholder}
            className="w-full bg-transparent px-3.5 py-4 sm:py-5 text-sm sm:text-base text-[#F5F5F5] placeholder:text-[#64748B] focus:outline-none disabled:opacity-50"
            aria-label="Paste a news article link"
          />

          {/* Automatic Type Indicator Badge */}
          {badge && BadgeIcon && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#171E29] border border-white/[0.08] text-[#A1A1AA] text-xs font-medium mr-2 shrink-0 select-none">
              <BadgeIcon className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{badge.label}</span>
            </div>
          )}

          {/* Clear Button */}
          {query.trim() && !isLoading && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-2 text-[#64748B] hover:text-[#F5F5F5] transition-colors mr-1"
              aria-label="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Submit Action Button */}
          <div className="pr-2 sm:pr-2.5">
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#10B981] text-[#0B0F17] font-semibold text-xs sm:text-sm tracking-wide transition-all duration-200 hover:bg-[#10B981]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              <span>{isLoading ? "Verifying..." : "Verify"}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
