import { NextRequest, NextResponse } from "next/server";
import { ClaimInput } from "@/schemas/evidence";
import { decomposeStatementClaims } from "@/lib/verification/statementIntent";
import { applyRouteGuard } from "@/lib/ratelimit/limiter";

export const maxDuration = 300;

/**
 * Deterministically decomposes article text or headline into atomic factual claims.
 */
function extractClaimsFromArticle(article: {
  title?: string;
  description?: string | null;
  content?: string;
}): ClaimInput[] {
  const claims: ClaimInput[] = [];

  // Claim 1: Primary headline assertion (High importance)
  if (article.title && article.title.trim()) {
    claims.push({
      id: "claim-1",
      text: article.title.trim(),
      importance: "high",
      claimType: "event",
    });
  }

  // Claim 2: Secondary summary assertion from description or first paragraph (Medium importance)
  if (article.description && article.description.trim()) {
    const desc = article.description.trim();
    if (desc !== article.title?.trim()) {
      claims.push({
        id: "claim-2",
        text: desc,
        importance: "medium",
        claimType: "factual",
      });
    }
  }

  // Claim 3: Additional core factual sentence from content if available
  if (article.content && article.content.trim()) {
    // Split into sentences and find a significant factual sentence
    const sentences = article.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^#+\s*/, ""))
      .filter((s) => s.length >= 30 && s.length <= 280 && !s.includes("http"));

    for (const sentence of sentences) {
      if (
        sentence !== article.title?.trim() &&
        sentence !== article.description?.trim() &&
        claims.length < 3
      ) {
        claims.push({
          id: `claim-${claims.length + 1}`,
          text: sentence,
          importance: claims.length === 1 ? "medium" : "low",
          claimType: "factual",
        });
      }
    }
  }

  // Fallback if no claims could be extracted
  if (claims.length === 0) {
    claims.push({
      id: "claim-1",
      text: "Primary ingested news story assertion",
      importance: "high",
      claimType: "factual",
    });
  }

  return claims;
}

/**
 * POST /api/claims
 * Decomposes an ingested article or text into atomic testable assertions.
 */
export async function POST(request: NextRequest) {
  const guard = await applyRouteGuard(request, "claims", { maxRequests: 30, windowSeconds: 60 });
  if (guard) return guard;

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid JSON payload.",
          },
        },
        { status: 400 }
      );
    }

    const article = body?.article;
    const rawText = body?.text;

    if (!article && !rawText) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_INPUT",
            message: "Please provide an article object or text string to extract claims.",
          },
        },
        { status: 400 }
      );
    }

    const claims = article
      ? extractClaimsFromArticle(article)
      : decomposeStatementClaims(String(rawText).trim(), "claim");

    return NextResponse.json({
      success: true,
      claims,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EXTRACTION_FAILED",
          message: "Failed to decompose claims from provided content.",
        },
      },
      { status: 500 }
    );
  }
}
