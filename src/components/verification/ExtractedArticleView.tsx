"use client";

import React, { useState } from "react";
import { Article } from "@/schemas/article";
import {
  ExternalLink,
  Calendar,
  User,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  Globe,
} from "lucide-react";

interface ExtractedArticleViewProps {
  article: Article;
  onReset?: () => void;
}

export function ExtractedArticleView({
  article,
  onReset,
}: ExtractedArticleViewProps) {
  const [copied, setCopied] = useState(false);

  const readingTime = Math.max(1, Math.ceil(article.wordCount / 200));

  const handleCopyContent = () => {
    navigator.clipboard.writeText(article.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = article.publishedAt
    ? (() => {
        try {
          const d = new Date(article.publishedAt);
          return !isNaN(d.getTime())
            ? d.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : article.publishedAt;
        } catch {
          return article.publishedAt;
        }
      })()
    : null;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in-50 duration-500">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ingest Another
            </button>
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Phase 2: Article Ingested & Validated
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-500">Source:</span>
          <span className="font-semibold text-slate-200">{article.sourceDomain}</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
            title="Open Original Source"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Article Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Header Metadata Grid */}
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-slate-200 font-mono font-medium flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-emerald-400" />
              {article.sourceDomain}
            </span>

            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 font-mono flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-sky-400" />
              {article.wordCount.toLocaleString()} words
            </span>

            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400 font-mono flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              ~{readingTime} min read
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-editorial font-bold text-white tracking-tight leading-snug">
            {article.title}
          </h1>

          {/* Description / Summary */}
          {article.description && (
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-sans border-l-2 border-emerald-500/50 pl-4 py-1 italic bg-white/[0.02] rounded-r-lg">
              {article.description}
            </p>
          )}

          {/* Attribution & Date Row */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 text-xs text-slate-400 border-t border-white/10">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">Byline:</span>
              <span className="font-medium text-slate-200">
                {article.author || <span className="italic text-slate-500">Not specified</span>}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">Published:</span>
              <span className="font-medium text-slate-200">
                {formattedDate || <span className="italic text-slate-500">Not specified</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Featured Image (if available) */}
        {article.featuredImage && (
          <div className="relative z-10 overflow-hidden rounded-xl border border-white/10 max-h-96 bg-black/40">
            <img
              src={article.featuredImage}
              alt={article.title}
              className="w-full h-full object-cover max-h-96 hover:scale-[1.01] transition-transform duration-500"
              onError={(e) => {
                // Hide if broken image link
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Clean Article Content Reader */}
        <div className="relative z-10 pt-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Extracted Markdown Body
              </h2>
            </div>

            <button
              onClick={handleCopyContent}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Markdown
                </>
              )}
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto rounded-xl p-5 bg-black/40 border border-white/10 font-mono text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed select-text space-y-3">
            {article.content}
          </div>
        </div>

        {/* Phase Roadmap Footer Banner */}
        <div className="relative z-10 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Phase 2 Complete:</strong> Clean article content parsed & verified against strict Zod schema.
            </span>
          </div>

          <span className="font-mono text-emerald-400/80 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            Next: Phase 3 Claim Extraction
          </span>
        </div>
      </div>
    </div>
  );
}
