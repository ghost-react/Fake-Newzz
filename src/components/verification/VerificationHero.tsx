"use client";

import React, { useState } from "react";
import {
  Globe,
  Calendar,
  Clock,
  ShieldCheck,
  Share2,
  ExternalLink,
  CheckCircle2,
  FileText,
  User,
  Sparkles,
  Check,
} from "lucide-react";
import { VerificationReport } from "@/types/verification";
import { Article } from "@/schemas/article";
import { TrustScore } from "@/components/ui/TrustScore";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { cn } from "@/lib/utils";

interface VerificationHeroProps {
  report?: VerificationReport | null;
  article?: Article | null;
  onOpenMethodology?: () => void;
  className?: string;
}

function formatPublishedDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function VerificationHero({
  report,
  article,
  onOpenMethodology,
  className,
}: VerificationHeroProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const isArticleMode = Boolean(article);

  // Dynamic Tint
  const dynamicTint = (() => {
    if (isArticleMode) {
      return "from-emerald-950/30 via-[#0B0F17]/90 to-[#0B0F17]";
    }
    switch (report?.verdict) {
      case "VERIFIED":
        return "from-emerald-950/40 via-[#0B0F17]/90 to-[#0B0F17]";
      case "CONTRADICTED":
        return "from-rose-950/40 via-[#0B0F17]/90 to-[#0B0F17]";
      case "CONTEXT_MISSING":
        return "from-amber-950/40 via-[#0B0F17]/90 to-[#0B0F17]";
      default:
        return "from-slate-950/40 via-[#0B0F17]/90 to-[#0B0F17]";
    }
  })();

  const featuredImage = isArticleMode
    ? article?.featuredImage
    : report?.featuredImageUrl;

  const title = isArticleMode ? article?.title : report?.articleTitle;
  const domain = isArticleMode ? article?.sourceDomain : report?.sourceDomain;
  const author = isArticleMode ? article?.author : report?.articleAuthor;
  const rawDate = isArticleMode ? article?.publishedAt : report?.publicationDate;
  const formattedDate = formatPublishedDate(rawDate);
  const description = isArticleMode
    ? article?.description
    : report?.executiveSummary;
  const articleUrl = isArticleMode ? article?.url : report?.inputQuery;

  const readingTime = article
    ? Math.max(1, Math.ceil(article.wordCount / 200))
    : report?.readTimeMinutes;

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const shareUrl = articleUrl || window.location.href;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-2xl transition-all duration-700 bg-slate-900/60",
        className
      )}
    >
      {/* Dynamic Background Image Layer with Ambient Blur & Vignette (hidden if no image exists) */}
      {featuredImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center filter blur-2xl scale-105 opacity-25 transition-all duration-1000"
          style={{ backgroundImage: `url(${featuredImage})` }}
        />
      )}

      {/* Dynamic Multi-layered Gradient Tint */}
      <div
        className={cn(
          "absolute inset-0 z-0 bg-gradient-to-b transition-colors duration-700",
          dynamicTint
        )}
      />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10">
        {/* Left Side: Scorecard Box / Circular Radial Gauge */}
        <div className="flex flex-col items-center justify-center flex-shrink-0">
          {isArticleMode ? (
            /* ARTICLE RETRIEVED STATE: Clearly distinguish from VERIFICATION COMPLETE */
            <>
              <div className="p-5 rounded-2xl glass-card border border-emerald-500/30 flex flex-col items-center justify-center bg-black/50 text-center w-[180px] min-h-[180px] shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />

                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                  ARTICLE RETRIEVED
                </span>

                <span className="text-xs text-slate-300 font-medium mt-1 leading-snug">
                  Article ready for verification
                </span>

                {article && (
                  <div className="mt-3 pt-2 border-t border-white/10 w-full">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {article.wordCount.toLocaleString()} words extracted
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-emerald-400/90 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Content Ingested
                </span>
              </div>
            </>
          ) : report ? (
            /* VERIFIED REPORT STATE: Real verified score */
            <>
              <div className="p-3 sm:p-4 rounded-2xl glass-card border border-white/10 flex flex-col items-center justify-center bg-black/40">
                <TrustScore
                  score={report.overallTrustScore}
                  verdict={report.verdict}
                  size={180}
                />
              </div>

              <div className="mt-3">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Audit Hash: <code className="text-slate-300">{report.id}</code>
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Right Side: Headline, Source & Date, Status Badge, Summary */}
        <div className="flex-1 space-y-3.5 text-center md:text-left">
          {/* Article Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-editorial font-bold text-slate-50 tracking-tight leading-[1.2]">
            {title}
          </h1>

          {/* Source Domain & Date & Author Metadata */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-slate-300 font-mono">
            {domain && (
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                {domain}
              </span>
            )}

            {/* Publication Date (hidden if null) */}
            {formattedDate && (
              <>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  {formattedDate}
                </span>
              </>
            )}

            {/* Author (hidden if null) */}
            {author && (
              <>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-slate-400 italic">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  By {author}
                </span>
              </>
            )}

            {/* Word count & Reading length */}
            {article && (
              <>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  {article.wordCount.toLocaleString()} words
                </span>
                {readingTime && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      ~{readingTime} min read
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Verdict / Status Pill */}
          <div className="pt-1 flex items-center justify-center md:justify-start">
            {isArticleMode ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Article ready for verification</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400 text-[10px] font-normal tracking-normal lowercase">
                  verification pending
                </span>
              </div>
            ) : report ? (
              <VerdictBadge
                status={report.verdict}
                confidence={report.confidence}
                showConfidence
                size="lg"
              />
            ) : null}
          </div>

          {/* Article Description / Executive Summary (hidden gracefully if null) */}
          {description && (
            <div className="rounded-2xl p-4 sm:p-5 bg-black/40 border border-white/10 backdrop-blur-md mt-2">
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans-ui">
                {description}
              </p>
            </div>
          )}

          {/* Action links */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
            {articleUrl && (
              <a
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span>Original Source</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>Share</span>
                </>
              )}
            </button>

            {onOpenMethodology && (
              <button
                type="button"
                onClick={onOpenMethodology}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verification Standards</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
