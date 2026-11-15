import { NextRequest, NextResponse } from "next/server";
import { ingestArticle, validateSafeUrl } from "@/lib/ingestion/article";
import { Article, ArticleApiResponse } from "@/schemas/article";
import { recoverHeadline } from "@/lib/ingestion/headlineRecovery";
import { SerperProvider } from "@/lib/search/serper";
import { applyRouteGuard, sanitizeErrorMessage } from "@/lib/ratelimit/limiter";

export const maxDuration = 300;

/**
 * POST /api/article
 * Ingests a news article URL via server-side Firecrawl, normalizes and strictly validates it.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ArticleApiResponse>> {
  const guard = await applyRouteGuard(request, "article", { maxRequests: 20, windowSeconds: 60 }, 1);
  if (guard) return guard as NextResponse<ArticleApiResponse>;

  try {
    // 1. Parse JSON body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_URL",
            message: "Invalid request payload. Please send a JSON object with a 'url' property.",
          },
        },
        { status: 400 }
      );
    }

    const rawUrl = body?.url;

    // 2. Validate URL existence and string type
    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_URL",
            message: "A valid news article URL must be provided.",
          },
        },
        { status: 400 }
      );
    }

    // 3. SSRF and Protocol Security Verification
    const urlValidation = validateSafeUrl(rawUrl);
    if (!urlValidation.isValid || !urlValidation.sanitizedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_URL",
            message: urlValidation.errorMessage || "Please provide a valid, publicly accessible HTTP or HTTPS URL.",
          },
        },
        { status: 400 }
      );
    }

    // 4. Ingest and normalize article with Firecrawl
    try {
      const article = await ingestArticle(urlValidation.sanitizedUrl);

      return NextResponse.json(
        {
          success: true,
          article,
        },
        { status: 200 }
      );
    } catch (err: any) {
      // Ingestion failed (blocked, 403/429, empty body, timeout, paywall).
      // Attempt headline recovery without reading the blocked page:
      // a. Any title or og:title metadata already returned by the fetch attempt
      // b. Exact URL search via search provider
      // c. URL slug cleaned into words
      try {
        const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key;
        const searchProvider = apiKey ? new SerperProvider(apiKey) : null;
        const recovery = await recoverHeadline(urlValidation.sanitizedUrl, {
          metadata: err?.metadata,
          searchProvider,
        });

        if (recovery && recovery.headline) {
          const domain = new URL(urlValidation.sanitizedUrl).hostname.replace(/^www\./i, "").toLowerCase();
          const syntheticArticle: Article = {
            url: urlValidation.sanitizedUrl,
            title: recovery.headline,
            description: recovery.snippet || null,
            author: null,
            publishedAt: null,
            sourceDomain: domain,
            featuredImage: null,
            content: recovery.snippet || recovery.headline,
            wordCount: (recovery.snippet || recovery.headline).split(/\s+/).filter(Boolean).length,
            sourceReadStatus: "unreadable",
            headlineSource: recovery.headlineSource,
          };

          return NextResponse.json(
            {
              success: true,
              article: syntheticArticle,
            },
            { status: 200 }
          );
        }
      } catch {
        // Recovery failed; proceed to standard error response below
      }

      // If recovery produces nothing, return error with clear suggestion to paste headline/text
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ARTICLE_EXTRACTION_FAILED",
            message: "We couldn't read this article. Please paste the headline or key claims directly to verify this story.",
          },
        },
        { status: 422 }
      );
    }
  } catch {
    // Unhandled server error (guarantee never exposing secrets, stack traces or keys)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ARTICLE_EXTRACTION_FAILED",
          message: "Unable to extract this article due to an internal server error.",
        },
      },
      { status: 500 }
    );
  }
}
