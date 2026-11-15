import { NextRequest, NextResponse } from "next/server";
import { AnalyzeContextRequestSchema } from "@/schemas/omission";
import { analyzeArticleContext } from "@/lib/verification/contextAnalysis";
import { applyRouteGuard, sanitizeErrorMessage } from "@/lib/ratelimit/limiter";

export const maxDuration = 300;

/**
 * POST /api/context
 *
 * Detects materially important missing context in an article/claim presentation.
 * Uses only the supplied article, claims, ranked evidence, and claim evaluations.
 *
 * Phase 6 does NOT calculate an article-wide score or verdict.
 */
export async function POST(request: NextRequest) {
  const guard = await applyRouteGuard(request, "context", { maxRequests: 25, windowSeconds: 60 });
  if (guard) return guard;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request payload must be valid JSON.",
          },
        },
        { status: 400 }
      );
    }

    // Validate request schema
    const parseResult = AnalyzeContextRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: errorMessage,
          },
        },
        { status: 400 }
      );
    }

    const { article, claims, evidence, evaluations } = parseResult.data;

    // Execute Phase 6 context analysis
    const omissions = await analyzeArticleContext(
      article,
      claims,
      evidence,
      evaluations
    );

    return NextResponse.json({
      success: true,
      omissions,
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const code = (errorObj as Error & { code?: string }).code || "CONTEXT_ERROR";
    const message = sanitizeErrorMessage(
      errorObj,
      "An unexpected server error occurred during context analysis."
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status: 500 }
    );
  }
}
