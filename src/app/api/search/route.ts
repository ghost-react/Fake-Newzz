import { NextRequest, NextResponse } from "next/server";
import {
  SearchApiResponse,
  SearchClaimsRequestSchema,
} from "@/schemas/evidence";
import { searchMultipleClaims } from "@/lib/search/searchClaims";
import { SearchError, SerperProvider } from "@/lib/search/serper";
import { applyRouteGuard, sanitizeErrorMessage } from "@/lib/ratelimit/limiter";

/**
 * POST /api/search
 * Server-side Multi-Source Evidence Retrieval using Serper.
 *
 * Enforces:
 * - Server-side only execution (SERPER_API_KEY never exposed to browser)
 * - Maximum 20 claims per request
 * - Query generation preserving claim facts
 * - Normalization to strict Evidence objects with relationship = "unknown"
 * - Deduplication by normalized URL
 * - Controlled errors without leaking secrets or stack traces
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SearchApiResponse>> {
  const guard = await applyRouteGuard(request, "search", { maxRequests: 25, windowSeconds: 60 }, 1);
  if (guard) return guard as NextResponse<SearchApiResponse>;

  try {
    // 1. Parse JSON body safely
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request payload. Please send a valid JSON body.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Validate request schema using Zod
    const validation = SearchClaimsRequestSchema.safeParse(body);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message:
              firstIssue ||
              "Invalid claim structure. Each claim must have id, text, and importance.",
          },
        },
        { status: 400 }
      );
    }

    // 3. Verify server-side search provider configuration
    const apiKey =
      process.env.SERPER_API_KEY || process.env.Serper_API_Key;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: "Search provider configuration is missing.",
          },
        },
        { status: 500 }
      );
    }

    // 4. Execute Multi-Source Search Orchestration
    try {
      const provider = new SerperProvider(apiKey);
      const results = await searchMultipleClaims(validation.data.claims, provider, {
        limit: 5,
        timeoutMs: 10000,
      });

      return NextResponse.json(
        {
          success: true,
          results,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      if (err instanceof SearchError) {
        let httpStatus = err.statusCode || 500;
        if (err.code === "RATE_LIMITED") httpStatus = 429;
        if (err.code === "SEARCH_TIMEOUT") httpStatus = 504;
        if (err.code === "BAD_REQUEST") httpStatus = 400;

        return NextResponse.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
          },
          { status: httpStatus }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEARCH_FAILED",
            message: "Unable to retrieve search results.",
          },
        },
        { status: 500 }
      );
    }
  } catch {
    // Top-level unhandled safety net — never leak stack trace or internal details
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SEARCH_FAILED",
          message: "Unable to retrieve search results.",
        },
      },
      { status: 500 }
    );
  }
}
