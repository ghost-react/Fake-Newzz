"use client";

import React, { useState } from "react";
import { ExternalLink, Globe, Calendar, User, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArticleBlockProps {
  title: string;
  sourceDomain: string;
  featuredImage?: string | null;
  articleUrl?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  className?: string;
}

export function ArticleBlock({
  title,
  sourceDomain,
  featuredImage,
  articleUrl,
  author,
  publishedAt,
  className,
}: ArticleBlockProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const initialLetter = (title || sourceDomain || "N").charAt(0).toUpperCase();

  const formattedDate = publishedAt
    ? (() => {
        try {
          const d = new Date(publishedAt);
          return isNaN(d.getTime()) ? publishedAt : d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } catch {
          return publishedAt;
        }
      })()
    : null;

  const proxiedImageUrl = featuredImage
    ? `/api/image?url=${encodeURIComponent(featuredImage)}`
    : null;

  return (
    <div
      data-testid="article-block"
      className={cn(
        "rounded-3xl p-6 sm:p-8 bg-[#111923] border border-white/[0.08] shadow-lg overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Featured Image with Typographic Fallback */}
        <div className="w-full md:w-56 h-48 sm:h-52 md:h-44 rounded-2xl overflow-hidden shrink-0 relative bg-[#171E29] border border-white/10 flex items-center justify-center select-none">
          {proxiedImageUrl && !imageFailed ? (
            <img
              src={proxiedImageUrl}
              alt={title}
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            /* Typographic Fallback */
            <div
              data-testid="typographic-fallback"
              className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1A2530] via-[#171E29] to-[#111923] p-4 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-2xl font-serif font-bold text-[#10B981] mb-2 shadow-lg">
                {initialLetter}
              </div>
              <span className="text-xs font-mono text-[#A1A1AA] truncate max-w-[140px]">
                {sourceDomain || "Source Article"}
              </span>
            </div>
          )}
        </div>

        {/* Article Metadata & Details */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#171E29] border border-white/5 font-mono text-[#F5F5F5]">
              <Globe className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{sourceDomain}</span>
            </span>

            {author && (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="truncate max-w-[180px]">{author}</span>
              </span>
            )}

            {formattedDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span>{formattedDate}</span>
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-editorial font-bold text-[#F5F5F5] leading-tight tracking-tight">
            {title}
          </h2>

          {articleUrl && (
            <div className="pt-2">
              <a
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#10B981] hover:underline transition-colors"
              >
                <span>Read original published article</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

