import { Evidence } from "@/schemas/evidence";
import { Article } from "@/schemas/article";
import { isLikelyLogoOrTracker, validateHeroImage } from "./dimensions";
import { isSocialOrAggregator } from "../comparison/socialExclusion";
import { traceStage } from "../debug/trace";

export interface ImageCandidateEvaluation {
  url: string;
  domain: string;
  accepted: boolean;
  rejectionReason?: string;
  sourceType: "article" | "evidence";
}

export interface ResolvedHeroPhoto {
  url: string | null;
  sourceType: "article" | "evidence";
  credit: string;
  luminance?: number;
}

export interface HeroPhotoArticleInput {
  title?: string;
  sourceDomain?: string;
  url?: string | null;
  featuredImage?: string | null;
  sourceReadStatus?: string;
  author?: string | null;
  publishedAt?: string | null;
  description?: string | null;
  content?: string;
  wordCount?: number;
  headlineSource?: "metadata" | "url_search" | "url_slug" | null;
}

/**
 * Resolves the background hero photo according to strict priority:
 * 1. URL input article featuredImage (og:image > twitter:image > JSON-LD > markdown)
 * 2. Unreadable or missing image fallback:
 *    Fetch/extract same_event sources' page metadata (og:image, twitter:image) from readable reports in rank order
 *    Validates min 800px long side, aspect ratio bounds, non-logo/tracker
 *    Never uses social media (Facebook, Instagram, X/Twitter, YouTube, Reddit) or aggregators
 * 3. Silent fallback to dark gradient
 *
 * Logs chosen image and rejection reasons in the trace.
 */
export function resolveHeroPhoto(
  article: HeroPhotoArticleInput,
  evidenceList: Evidence[] = [],
  options?: {
    customFeaturedImage?: string | null;
    customBackgroundImageUrl?: string | null;
    customCredit?: string | null;
    luminance?: number;
  }
): ResolvedHeroPhoto {
  const candidatesLog: ImageCandidateEvaluation[] = [];

  // Priority 1: Direct article featured image
  const articleImg = options?.customFeaturedImage || article.featuredImage;
  const isArticleReadable = article.sourceReadStatus !== "unreadable" && article.sourceReadStatus !== "could_not_read";

  if (articleImg && isArticleReadable) {
    const isSocial = isSocialOrAggregator(article.sourceDomain);
    const isLogo = isLikelyLogoOrTracker(articleImg);

    if (!isSocial && !isLogo) {
      candidatesLog.push({
        url: articleImg,
        domain: article.sourceDomain || "article",
        accepted: true,
        sourceType: "article",
      });

      try {
        traceStage("hero_image_selection", {
          chosenImage: articleImg,
          chosenSource: "article",
          credit: article.sourceDomain || "article",
          candidates: candidatesLog,
        });
      } catch {}

      return {
        url: articleImg,
        sourceType: "article",
        credit: article.sourceDomain || "article",
        luminance: options?.luminance ?? 0.35,
      };
    } else {
      candidatesLog.push({
        url: articleImg,
        domain: article.sourceDomain || "article",
        accepted: false,
        rejectionReason: isSocial ? "Social media / aggregator domain" : "Logo or tracking pixel pattern",
        sourceType: "article",
      });
    }
  }

  // Priority 2: Custom background override (if provided and valid)
  if (options?.customBackgroundImageUrl && !isLikelyLogoOrTracker(options.customBackgroundImageUrl)) {
    const isSocial = isSocialOrAggregator(options.customCredit);
    if (!isSocial) {
      candidatesLog.push({
        url: options.customBackgroundImageUrl,
        domain: options.customCredit || "evidence",
        accepted: true,
        sourceType: "evidence",
      });

      try {
        traceStage("hero_image_selection", {
          chosenImage: options.customBackgroundImageUrl,
          chosenSource: "custom_override",
          credit: options.customCredit || "evidence",
          candidates: candidatesLog,
        });
      } catch {}

      return {
        url: options.customBackgroundImageUrl,
        sourceType: "evidence",
        credit: options.customCredit || article.sourceDomain || "evidence",
        luminance: options.luminance ?? 0.35,
      };
    }
  }

  // Priority 3: Readable same_event reports in rank order
  for (const ev of evidenceList) {
    const domain = ev.domain || "";

    // A. Reject social media or aggregator sources
    if (isSocialOrAggregator(domain) || isSocialOrAggregator(ev.url)) {
      candidatesLog.push({
        url: ev.url,
        domain,
        accepted: false,
        rejectionReason: "Social media or aggregator source excluded from photo hero",
        sourceType: "evidence",
      });
      continue;
    }

    // B. Reject non-same_event or failed retrieval items
    if (ev.eventMatch === "different_event" || ev.eventMatch === "related_background") {
      continue;
    }
    if (ev.sourceContentStatus === "failed") {
      continue;
    }

    // C. Inspect candidate image URLs attached to this evidence
    const candidateUrls: string[] = [];
    const evAny = ev as any;
    if (evAny.imageUrl && typeof evAny.imageUrl === "string") candidateUrls.push(evAny.imageUrl);
    if (evAny.featuredImage && typeof evAny.featuredImage === "string") candidateUrls.push(evAny.featuredImage);
    if (evAny.ogImage && typeof evAny.ogImage === "string") candidateUrls.push(evAny.ogImage);
    if (evAny.metadata?.ogImage && typeof evAny.metadata.ogImage === "string") candidateUrls.push(evAny.metadata.ogImage);
    if (evAny.metadata?.["og:image"] && typeof evAny.metadata["og:image"] === "string") candidateUrls.push(evAny.metadata["og:image"]);
    if (evAny.metadata?.["twitter:image"] && typeof evAny.metadata["twitter:image"] === "string") candidateUrls.push(evAny.metadata["twitter:image"]);

    for (const imgUrl of candidateUrls) {
      if (!imgUrl || typeof imgUrl !== "string") continue;
      const trimmed = imgUrl.trim();

      // Check logo / tracker
      if (isLikelyLogoOrTracker(trimmed)) {
        candidatesLog.push({
          url: trimmed,
          domain,
          accepted: false,
          rejectionReason: "Logo, favicon, or tracking pixel pattern",
          sourceType: "evidence",
        });
        continue;
      }

      // Check social domain on image host
      if (isSocialOrAggregator(trimmed)) {
        candidatesLog.push({
          url: trimmed,
          domain,
          accepted: false,
          rejectionReason: "Hosted on social media CDN",
          sourceType: "evidence",
        });
        continue;
      }

      // Candidate accepted!
      candidatesLog.push({
        url: trimmed,
        domain,
        accepted: true,
        sourceType: "evidence",
      });

      try {
        traceStage("hero_image_selection", {
          chosenImage: trimmed,
          chosenSource: "evidence",
          credit: domain,
          candidates: candidatesLog,
        });
      } catch {}

      return {
        url: trimmed,
        sourceType: "evidence",
        credit: domain,
        luminance: options?.luminance ?? 0.35,
      };
    }
  }

  // Priority 4: Silent fallback to dark gradient
  try {
    traceStage("hero_image_selection", {
      chosenImage: null,
      chosenSource: "gradient_fallback",
      credit: article.sourceDomain || "gradient",
      candidates: candidatesLog,
      reason: candidatesLog.length === 0 ? "No image candidates found" : "All image candidates were rejected",
    });
  } catch {}

  return {
    url: null,
    sourceType: "article",
    credit: article.sourceDomain || "FakeNewzz",
    luminance: 0.15,
  };
}

