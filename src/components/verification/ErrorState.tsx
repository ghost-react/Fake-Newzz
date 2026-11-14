"use client";

import React from "react";
import {
  RefreshCw,
  ArrowLeft,
  Link2Off,
  FileX,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBar } from "./SearchBar";

export type ErrorType =
  | "INVALID_URL"
  | "EXTRACTION_FAILED"
  | "UNSUPPORTED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "RATE_LIMITED"
  | "CONFIG_ERROR";

interface ErrorStateProps {
  type?: ErrorType;
  message?: string;
  onRetry?: () => void;
  onReset?: () => void;
  onSearch?: (query: string, type: any) => void;
  className?: string;
}

const ERROR_CONFIGS: Record<
  ErrorType,
  {
    badge: string;
    title: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    border: string;
    defaultMessage: string;
    tip: string;
  }
> = {
  INVALID_URL: {
    badge: "Input Check",
    title: "Please check your link",
    icon: Link2Off,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
    border: "border-amber-500/30",
    defaultMessage: "Please enter a valid news URL, headline, or claim to verify.",
    tip: "Make sure the link includes http:// or https://, or simply paste the headline directly.",
  },
  EXTRACTION_FAILED: {
    badge: "Article Unavailable",
    title: "We couldn't read this article",
    icon: FileX,
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/25",
    border: "border-rose-500/30",
    defaultMessage: "We couldn't read this article. The website may be blocking automated access.",
    tip: "The publisher might require a subscription, or you can paste the headline or key claims directly into the box above.",
  },
  UNSUPPORTED: {
    badge: "Format Check",
    title: "Article format not supported",
    icon: FileX,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
    border: "border-amber-500/30",
    defaultMessage: "This page does not appear to contain a standard news article.",
    tip: "Make sure the link points to a written news report rather than an index, video stream, or audio feed.",
  },
  NETWORK_ERROR: {
    badge: "Connection Notice",
    title: "We couldn't reach some sources right now",
    icon: WifiOff,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
    border: "border-amber-500/30",
    defaultMessage: "We couldn't reach some sources right now. Try again in a moment.",
    tip: "Please check your internet connection and try verifying again.",
  },
  SERVER_ERROR: {
    badge: "Verification Notice",
    title: "We couldn't complete this verification",
    icon: AlertCircle,
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/25",
    border: "border-rose-500/30",
    defaultMessage: "We couldn't complete this verification. Please try again.",
    tip: "An unexpected issue occurred while checking this story. Please retry in a few moments.",
  },
  RATE_LIMITED: {
    badge: "High Volume",
    title: "Verification temporarily busy",
    icon: RefreshCw,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
    border: "border-amber-500/30",
    defaultMessage: "We're experiencing high verification volume. Please wait a moment.",
    tip: "Wait a few seconds and click Retry to run the verification.",
  },
  CONFIG_ERROR: {
    badge: "Service Unavailable",
    title: "Verification temporarily unavailable",
    icon: AlertCircle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/25",
    border: "border-amber-500/30",
    defaultMessage: "Verification services are temporarily unavailable. Please try again shortly.",
    tip: "Our team has been alerted. Please try again in a few moments.",
  },
};

export function ErrorState({
  type = "EXTRACTION_FAILED",
  message,
  onRetry,
  onReset,
  onSearch,
  className,
}: ErrorStateProps) {
  const config = ERROR_CONFIGS[type] || ERROR_CONFIGS.EXTRACTION_FAILED;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-3xl surface-card border shadow-2xl relative overflow-hidden",
        config.border,
        className
      )}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Status Badge */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider",
            config.iconBg,
            config.iconColor
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{config.badge}</span>
        </div>

        {/* Heading */}
        <h2 className="text-xl sm:text-2xl font-editorial font-bold text-[#F5F5F5] tracking-tight">
          {config.title}
        </h2>

        {/* User-friendly message */}
        <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed max-w-lg font-sans">
          {message || config.defaultMessage}
        </p>

        {/* Practical tip */}
        <div className="w-full p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#717B89] font-sans text-left">
          <strong className="text-[#A1A1AA] block mb-1">Suggestion:</strong>
          <span>{config.tip}</span>
        </div>

        {/* If article was unreadable / extraction failed, provide search box right here to paste headline or text */}
        {type === "EXTRACTION_FAILED" && onSearch && (
          <div className="w-full pt-2">
            <SearchBar
              onSearch={onSearch}
              placeholder="Paste a news link, headline or claim"
              className="w-full"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Search</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
