import {
  Omission,
  OmissionSchema,
} from "@/schemas/omission";

export interface OmissionValidationSuccess {
  isValid: true;
  omission: Omission;
}

export interface OmissionValidationFailure {
  isValid: false;
  error: string;
}

export type OmissionValidationResult =
  | OmissionValidationSuccess
  | OmissionValidationFailure;

/**
 * Validates a single omission output against strict Zod schemas and semantic traceability rules:
 *
 * 1. Zod structural conformance
 * 2. Every evidenceId must exist in the verified evidence set
 * 3. Deduplicate evidenceIds
 * 4. At least one valid evidenceId is required
 * 5. If claimId is specified, it must exist in validClaimIds (or be null for article-wide omissions)
 * 6. description and whyItMatters must be non-empty
 *
 * Never trusts raw LLM output.
 */
export function validateSingleOmission(
  rawOmission: unknown,
  validEvidenceIds: Set<string>,
  validClaimIds: Set<string>
): OmissionValidationResult {
  // 1. Structural Zod validation
  const parseResult = OmissionSchema.safeParse(rawOmission);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues
      .map((issue) => `${issue.path.join(".") || "omission"}: ${issue.message}`)
      .join("; ");
    return {
      isValid: false,
      error: `Structural validation failure: ${errorMsg}`,
    };
  }

  const omission = parseResult.data;

  // 2. Claim ID validation (if provided)
  if (omission.claimId !== null && !validClaimIds.has(omission.claimId)) {
    return {
      isValid: false,
      error: `Omission cites non-existent claimId "${omission.claimId}".`,
    };
  }

  // 3. Evidence traceability: every evidenceId must exist in the verified evidence set
  const seenIds = new Set<string>();
  const deduplicatedEvidenceIds: string[] = [];

  for (const evId of omission.evidenceIds) {
    const trimmedId = evId.trim();
    if (!trimmedId) continue;

    if (!validEvidenceIds.has(trimmedId)) {
      return {
        isValid: false,
        error: `Fabricated or invalid evidence ID "${trimmedId}" cited in omission. Evidence ID does not exist in verification dataset.`,
      };
    }

    if (!seenIds.has(trimmedId)) {
      seenIds.add(trimmedId);
      deduplicatedEvidenceIds.push(trimmedId);
    }
  }

  // 4. Must cite at least 1 verified evidence ID
  if (deduplicatedEvidenceIds.length === 0) {
    return {
      isValid: false,
      error: "Omission must cite at least one verified evidence ID demonstrating the missing context.",
    };
  }

  // 5. Semantic validity: description and whyItMatters must not be blank
  if (!omission.description.trim() || !omission.whyItMatters.trim()) {
    return {
      isValid: false,
      error: "Omission description and whyItMatters cannot be empty or blank.",
    };
  }

  return {
    isValid: true,
    omission: {
      ...omission,
      description: omission.description.trim(),
      whyItMatters: omission.whyItMatters.trim(),
      evidenceIds: deduplicatedEvidenceIds,
    },
  };
}

/**
 * Normalizes text to extract core semantic words for similarity deduplication.
 */
function extractSemanticWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return new Set(words);
}

/**
 * Computes Jaccard word similarity between two text snippets.
 */
function computeSemanticOverlap(textA: string, textB: string): number {
  const wordsA = extractSemanticWords(textA);
  const wordsB = extractSemanticWords(textB);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicates omissions based on:
 * - claimId match (or both null)
 * - omission type match
 * - high semantic overlap (> 0.5) in description / whyItMatters
 *
 * If duplicate omissions are found, merges evidenceIds so no evidence source is lost.
 */
export function deduplicateOmissions(omissions: Omission[]): Omission[] {
  const deduplicated: Omission[] = [];

  for (const candidate of omissions) {
    const existingIndex = deduplicated.findIndex((existing) => {
      const sameClaim = existing.claimId === candidate.claimId;
      const sameType = existing.type === candidate.type;
      if (!sameClaim || !sameType) return false;

      // Check semantic overlap
      const descSimilarity = computeSemanticOverlap(
        existing.description,
        candidate.description
      );
      const whySimilarity = computeSemanticOverlap(
        existing.whyItMatters,
        candidate.whyItMatters
      );

      return descSimilarity >= 0.45 || whySimilarity >= 0.45;
    });

    if (existingIndex >= 0) {
      // Merge candidate evidenceIds into existing omission
      const existing = deduplicated[existingIndex];
      const mergedEvidenceIds = Array.from(
        new Set([...existing.evidenceIds, ...candidate.evidenceIds])
      );

      // Keep the higher severity if differing
      const severityRank = { high: 3, medium: 2, low: 1 };
      const higherSeverity =
        severityRank[candidate.severity] > severityRank[existing.severity]
          ? candidate.severity
          : existing.severity;

      // Keep higher confidence
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      const higherConfidence =
        confidenceRank[candidate.confidence] >
        confidenceRank[existing.confidence]
          ? candidate.confidence
          : existing.confidence;

      deduplicated[existingIndex] = {
        ...existing,
        severity: higherSeverity,
        confidence: higherConfidence,
        evidenceIds: mergedEvidenceIds,
      };
    } else {
      deduplicated.push(candidate);
    }
  }

  return deduplicated;
}
