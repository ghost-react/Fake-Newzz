import {
  ClaimEvaluation,
  ClaimEvaluationSchema,
} from "@/schemas/evaluation";

export interface ValidationSuccess {
  isValid: true;
  evaluation: ClaimEvaluation;
}

export interface ValidationFailure {
  isValid: false;
  error: string;
}

export type EvaluationValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates both Zod structural integrity and semantic correctness of a claim evaluation.
 *
 * Rules:
 * - every evidenceId must exist in the supplied evidence set for the claim
 * - every evidence ID must belong to the current claim (reject cross-claim references)
 * - deduplicate evidence IDs
 * - allowed verdicts only ("supporting", "contradicting", "qualifying", "insufficient")
 * - allowed confidence values only ("high", "medium", "low")
 * - explanation cannot be empty
 * - supporting/contradicting/qualifying requires >= 1 evidence ID
 * - insufficient may have zero or more evidence IDs
 * - reject fabricated IDs
 *
 * Never trust raw LLM output.
 */
export function validateClaimEvaluation(
  rawEvaluation: unknown,
  expectedClaimId: string,
  validEvidenceIdsForClaim: Iterable<string>
): EvaluationValidationResult {
  // 1. Structural Zod Validation
  const zodResult = ClaimEvaluationSchema.safeParse(rawEvaluation);
  if (!zodResult.success) {
    const errorMsg = zodResult.error.issues
      .map((issue) => `${issue.path.join(".") || "evaluation"}: ${issue.message}`)
      .join("; ");
    return {
      isValid: false,
      error: `Structural validation failure: ${errorMsg}`,
    };
  }

  const evalData = zodResult.data;

  // 2. Reject cross-claim mismatch
  if (evalData.claimId !== expectedClaimId) {
    return {
      isValid: false,
      error: `Cross-claim reference rejected: evaluation claimId "${evalData.claimId}" does not match target claim "${expectedClaimId}".`,
    };
  }

  // 3. Explanation must not be blank
  if (!evalData.explanation.trim()) {
    return {
      isValid: false,
      error: "Evaluation explanation cannot be empty.",
    };
  }

  // 4. Trace evidence IDs against valid evidence for this specific claim
  const allowedSet = new Set(validEvidenceIdsForClaim);
  const deduplicatedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const id of evalData.evidenceIds) {
    const trimmedId = id.trim();
    if (!trimmedId) continue;

    // Reject fabricated or cross-claim evidence IDs
    if (!allowedSet.has(trimmedId)) {
      return {
        isValid: false,
        error: `Fabricated or invalid evidence ID "${trimmedId}" cited. Evidence ID does not exist for claim "${expectedClaimId}".`,
      };
    }

    if (!seenIds.has(trimmedId)) {
      seenIds.add(trimmedId);
      deduplicatedIds.push(trimmedId);
    }
  }

  // 5. Evidence citation requirements by verdict:
  // - "supporting", "contradicting", "qualifying" require >= 1 verified evidence ID
  // - "insufficient" may have 0 or more evidence IDs
  if (
    (evalData.verdict === "supporting" ||
      evalData.verdict === "contradicting" ||
      evalData.verdict === "qualifying") &&
    deduplicatedIds.length === 0
  ) {
    return {
      isValid: false,
      error: `Verdict "${evalData.verdict}" requires at least 1 verified evidence ID. None was validly cited.`,
    };
  }

  // Deduplicate importantNotes
  const deduplicatedNotes = Array.from(
    new Set((evalData.importantNotes || []).map((n) => n.trim()).filter(Boolean))
  );

  return {
    isValid: true,
    evaluation: {
      claimId: expectedClaimId,
      verdict: evalData.verdict,
      confidence: evalData.confidence,
      explanation: evalData.explanation.trim(),
      evidenceIds: deduplicatedIds,
      importantNotes: deduplicatedNotes,
    },
  };
}
