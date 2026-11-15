import { NextRequest, NextResponse } from "next/server";
import { EvaluateClaimsRequestSchema } from "@/schemas/evaluation";
import { evaluateClaims } from "@/lib/verification/evaluateClaims";
import { applyRouteGuard, sanitizeErrorMessage } from "@/lib/ratelimit/limiter";

export const maxDuration = 300;

/**
 * POST /api/evaluate
 *
 * Evaluates individual atomic claims against retrieved, ranked evidence.
 * Validates inputs with Zod and enforces valid claim references.
 *
 * Phase 5 strictly evaluates individual claims only.
 * Does NOT calculate article-level score or overall verdict.
 */
export async function POST(request: NextRequest) {
  const guard = await applyRouteGuard(request, "evaluate", { maxRequests: 25, windowSeconds: 60 });
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

    // Validate claims and evidence structure
    const parseResult = EvaluateClaimsRequestSchema.safeParse(body);
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

    const { claims, evidence } = parseResult.data;

    // Execute Phase 5 claim evaluation service
    const result = await evaluateClaims(claims, evidence);

    return NextResponse.json({
      success: true,
      evaluations: result.evaluations,
      evidence: result.evidence,
    });
  } catch (err: any) {
    const code = err?.code || "EVALUATION_ERROR";
    const message = sanitizeErrorMessage(
      err,
      "An unexpected server error occurred during claim evaluation."
    );

    const status = code === "CONFIG_ERROR" ? 500 : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status }
    );
  }
}
