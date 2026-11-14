"use client";

import React, { useState } from "react";
import { ExternalLink, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import {
  isValidHttpUrl,
  SOURCE_LINK_MOTION_CLASSES,
} from "@/lib/ui/sourceCardConfig";
import { cn } from "@/lib/utils";

export type SourceOriginLabel = "Original" | "Republished" | "Origin unclear";

export interface SyndicatedOutlet {
  domain: string;
  url: string;
  title?: string;
}

export interface SourceLinkProps {
  url?: string | null;
  domain: string;
  title?: string | null;
  headline?: string | null;
  originLabel?: SourceOriginLabel | string;
  originType?: string | null;
  isWireSyndicated?: boolean;
  isIndependent?: boolean;
  statusText?: string | null;
  statusColor?: string | null;
  syndicatedOutlets?: SyndicatedOutlet[];
  quote?: string | null;
  timeText?: string | null;
  variant?: "hero-strip" | "floating-card" | "comparison-row" | "evidence-card" | "citation-pill" | "white-strip-card";
  className?: string;
  id?: string;
  "data-testid"?: string;
  children?: React.ReactNode;
}

/**
 * Resolves the standardized origin badge:
 * - "Original": Emerald theme
 * - "Republished": Slate theme
 * - "Origin unclear": Amber theme
 */
export function resolveOriginLabel(
  label?: string | null,
  type?: string | null,
  isWireSyndicated?: boolean,
  isIndependent?: boolean
): SourceOriginLabel {
  if (label === "Original" || label === "Republished" || label === "Origin unclear") {
    return label;
  }
  if (isWireSyndicated || type === "syndicated" || type === "republished" || type === "wire") {
    return "Republished";
  }
  if (isIndependent || type === "original" || type === "independent" || type === "primary") {
    return "Original";
  }
  return "Origin unclear";
}

export function getOriginBadgeStyles(origin: SourceOriginLabel): string {
  switch (origin) {
    case "Original":
      return "text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30";
    case "Republished":
      return "text-[#94A3B8] bg-[#64748B]/15 border-[#64748B]/30";
    case "Origin unclear":
    default:
      return "text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/30";
  }
}

/**
 * SyndicatedOutletsToggle renders an expandable "+N outlets" sub-list.
 * Renders separate, accessible <a> links for each outlet without nesting anchor tags.
 */
export function SyndicatedOutletsToggle({
  outlets,
}: {
  outlets: SyndicatedOutlet[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!outlets || outlets.length === 0) return null;

  return (
    <div className="w-full pt-1.5" data-testid="syndicated-outlets-container">
      <button
        type="button"
        data-testid="syndicated-outlets-toggle"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded((prev) => !prev);
        }}
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <span>
          {isExpanded ? "Hide" : `+${outlets.length} outlet${outlets.length === 1 ? "" : "s"}`}
        </span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isExpanded && (
        <div
          data-testid="syndicated-outlets-list"
          className="mt-2.5 pl-3 border-l-2 border-white/10 flex flex-wrap gap-2"
        >
          {outlets.map((outlet, i) => (
            <SourceLink
              key={`${outlet.domain}-${outlet.url}-${i}`}
              url={outlet.url}
              domain={outlet.domain}
              title={outlet.title}
              originLabel="Republished"
              variant="citation-pill"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared SourceLink component.
 *
 * Requirements:
 * 1. Renders a semantic <a> with target="_blank" and rel="noopener noreferrer nofollow"
 *    so middle-click, copy link, and screen readers work.
 * 2. href is the exact stored evidence URL, never domain homepage or composed URL.
 * 3. Shows domain, headline/title, origin label (Original/Republished/Origin unclear),
 *    and a small external-link icon (Lucide ExternalLink).
 * 4. Hover-lift animation (-4px translateY, deeper shadow, brighter border, 180ms ease-out).
 * 5. Touch devices disable lift (@media (hover: none)), support tap pressed state.
 * 6. Accessible AA focus ring (focus-visible:ring-2 focus-visible:ring-emerald-400).
 * 7. Syndicated clusters render origin card + "+N outlets" expandable toggle.
 */
export function SourceLink({
  url,
  domain,
  title,
  headline,
  originLabel,
  originType,
  isWireSyndicated,
  isIndependent,
  statusText,
  statusColor,
  syndicatedOutlets,
  quote,
  timeText,
  variant = "hero-strip",
  className,
  id,
  "data-testid": testId,
  children,
}: SourceLinkProps) {
  const displayTitle = headline || title || domain;
  const origin = resolveOriginLabel(originLabel, originType, isWireSyndicated, isIndependent);
  const badgeStyle = getOriginBadgeStyles(origin);
  const isSafeUrl = isValidHttpUrl(url);

  // Fallback non-link rendering if URL is missing or invalid
  const renderCardContent = () => {
    switch (variant) {
      case "floating-card":
        return (
          <>
            <div className="flex items-center justify-between text-xs font-mono text-[#A1A1AA]">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Key Independent Source
              </span>
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", badgeStyle)}>
                {origin}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] font-sans line-clamp-2 group-hover/sourcelink:text-white transition-colors">
              {displayTitle}
            </h4>
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-mono text-[#717B89]">
              <span className="text-[#A1A1AA]">{domain}</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span>{statusText || "Corroborated"}</span>
                <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
            </div>
          </>
        );

      case "comparison-row":
        return (
          <>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#A1A1AA] mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[#F5F5F5] truncate">{domain}</span>
                <span className={cn("text-[9px] px-1.5 py-0.2 rounded border font-mono shrink-0", badgeStyle)}>
                  {origin}
                </span>
              </div>
              <ExternalLink className="w-3 h-3 text-[#717B89] group-hover/sourcelink:text-emerald-400 transition-colors shrink-0 ml-1" />
            </div>
            {children}
            {quote && (
              <p className="text-[11px] text-[#A1A1AA] italic mt-1 border-l-2 border-[#10B981]/40 pl-2">
                &ldquo;{quote}&rdquo;
              </p>
            )}
          </>
        );

      case "evidence-card":
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold", badgeStyle)}>
                  {origin}
                </span>
                <span className="text-xs font-mono text-[#F5F5F5] font-semibold">
                  {domain}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#10B981] group-hover/sourcelink:underline">
                <span className="font-mono text-[11px]">Open Article</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-[#F5F5F5] leading-snug group-hover/sourcelink:text-white transition-colors">
              {displayTitle}
            </h3>

            {children}
          </>
        );

      case "citation-pill":
        return (
          <>
            <span className="font-semibold text-[#F5F5F5] group-hover/sourcelink:text-white truncate max-w-[120px]">
              {domain || id || "Source"}
            </span>
            <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0", badgeStyle)}>
              {origin}
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-[#717B89] group-hover/sourcelink:text-emerald-400 transition-colors shrink-0" />
          </>
        );

      case "white-strip-card": {
        const isOriginUnclear = origin === "Origin unclear";
        return (
          <div className="flex flex-col justify-between h-full w-full space-y-1.5 text-left min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
              <span
                className="font-semibold text-[#F5F5F5] text-xs font-mono truncate max-w-[120px] sm:max-w-[160px]"
                title={domain}
              >
                {domain}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {timeText && (
                  <span className="text-[10px] font-mono text-[#717B89] shrink-0 whitespace-nowrap">
                    {timeText}
                  </span>
                )}
                {!isOriginUnclear && (
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold shrink-0 whitespace-nowrap", badgeStyle)}>
                    {origin}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 text-[#717B89] group-hover/sourcelink:text-emerald-400 transition-colors shrink-0" />
              </div>
            </div>

            {/* "Origin unclear" tag placed on its own line on narrow/small cards */}
            {isOriginUnclear && (
              <div className="pt-0.5">
                <span className={cn("text-[8.5px] font-mono px-1.5 py-0.2 rounded border font-semibold inline-block shrink-0 whitespace-nowrap", badgeStyle)}>
                  {origin}
                </span>
              </div>
            )}

            <p className="text-xs text-[#CBD5E1] group-hover/sourcelink:text-white font-sans font-medium line-clamp-2 leading-snug break-words transition-colors">
              {displayTitle}
            </p>
          </div>
        );
      }

      case "hero-strip":
      default:
        return (
          <>
            <span className="font-semibold text-[#F5F5F5] group-hover/sourcelink:text-white shrink-0">
              {domain}
            </span>
            <span className="text-[#64748B]">·</span>
            <span className="text-[#A1A1AA] max-w-[180px] truncate group-hover/sourcelink:text-[#F5F5F5] transition-colors">
              {displayTitle}
            </span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0",
                badgeStyle
              )}
            >
              {origin}
            </span>
            <ExternalLink className="w-3 h-3 text-[#717B89] group-hover/sourcelink:text-emerald-400 transition-colors shrink-0" />
          </>
        );
    }
  };

  const getVariantContainerClasses = () => {
    switch (variant) {
      case "floating-card":
        return "p-4 rounded-2xl bg-[#111923]/75 border border-white/[0.12] backdrop-blur-xl shadow-2xl space-y-2.5 max-w-xs block text-left";
      case "comparison-row":
        return "p-2.5 rounded-xl bg-[#171E29] border border-white/5 space-y-1 block text-left";
      case "evidence-card":
        return "p-4 rounded-2xl bg-[#171E29]/70 border border-white/[0.06] space-y-2.5 block text-left w-full";
      case "citation-pill":
        return "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111923] border border-white/10 text-xs font-mono";
      case "white-strip-card":
        return "p-3 sm:p-3.5 rounded-xl bg-[#111923]/80 hover:bg-[#171E29] text-white border border-white/[0.08] hover:border-white/20 shadow-lg backdrop-blur-md transition-all block text-left min-w-[240px] sm:min-w-0 flex-1";
      case "hero-strip":
      default:
        return "flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-sans shrink-0";
    }
  };

  // If a valid URL is provided, render semantic <a> link
  const cardElement = isSafeUrl ? (
    <a
      href={url!}
      target="_blank"
      rel="noopener noreferrer nofollow"
      id={id}
      data-testid={testId}
      className={cn(
        getVariantContainerClasses(),
        SOURCE_LINK_MOTION_CLASSES,
        "cursor-pointer",
        className
      )}
    >
      {renderCardContent()}
    </a>
  ) : (
    <div
      id={id}
      data-testid={testId}
      className={cn(
        getVariantContainerClasses(),
        className
      )}
    >
      {renderCardContent()}
    </div>
  );

  // If syndicated outlets are present, wrap the main card and the toggle together
  if (syndicatedOutlets && syndicatedOutlets.length > 0) {
    return (
      <div className="space-y-1 w-full" data-testid="syndicated-cluster-wrapper">
        {cardElement}
        <SyndicatedOutletsToggle outlets={syndicatedOutlets} />
      </div>
    );
  }

  return cardElement;
}

