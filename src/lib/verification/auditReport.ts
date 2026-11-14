import { VerificationReport } from "@/schemas/verification";
import { ClaimInput, Evidence } from "@/schemas/evidence";

export class TraceabilityAuditError extends Error {
  public readonly auditErrors: string[];

  constructor(auditErrors: string[]) {
    super(`Evidence traceability audit failed:\n- ${auditErrors.join("\n- ")}`);
    this.name = "TraceabilityAuditError";
    this.auditErrors = auditErrors;
  }
}

export interface AuditResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that an article verification report maintains strict evidence traceability:
 * 1. Every claim evaluation references existing, valid evidence items for that specific claim.
 * 2. Every supporting verdict is anchored in at least one verified evidence ID.
 * 3. Every cited evidence item contains a valid, publicly accessible HTTP/HTTPS URL.
 * 4. Every omission references existing evidence IDs.
 * 5. Score breakdown and claim counts are mathematically consistent with evaluations.
 */
export function auditReport(
  report: VerificationReport,
  claims: ClaimInput[],
  evidence: Evidence[]
): AuditResult {
  const errors: string[] = [];

  const claimIdSet = new Set(claims.map((c) => c.id));
  const evidenceMap = new Map<string, Evidence>();
  evidence.forEach((ev) => evidenceMap.set(ev.id, ev));

  // 1. Audit Claim Evaluations
  for (const evaluation of report.evaluations) {
    // Claim ID exists in input claims
    if (!claimIdSet.has(evaluation.claimId)) {
      errors.push(
        `Evaluation references non-existent claimId "${evaluation.claimId}".`
      );
    }

    // Supporting verdicts must have citations
    if (
      evaluation.verdict === "supporting" &&
      (!evaluation.evidenceIds || evaluation.evidenceIds.length === 0)
    ) {
      errors.push(
        `Claim "${evaluation.claimId}" has verdict "supporting" but provides no evidence IDs.`
      );
    }

    // Check evidence IDs
    for (const evId of evaluation.evidenceIds) {
      const evItem = evidenceMap.get(evId);
      if (!evItem) {
        errors.push(
          `Claim "${evaluation.claimId}" cites non-existent evidenceId "${evId}".`
        );
        continue;
      }

      // Evidence item must belong to the evaluated claim
      if (evItem.claimId && evItem.claimId !== evaluation.claimId) {
        errors.push(
          `Claim "${evaluation.claimId}" cites cross-claim evidenceId "${evId}" belonging to claim "${evItem.claimId}".`
        );
      }

      // Evidence URL validity
      if (!evItem.url || typeof evItem.url !== "string") {
        errors.push(
          `Evidence item "${evId}" cited by claim "${evaluation.claimId}" lacks a valid URL.`
        );
      } else {
        try {
          const parsed = new URL(evItem.url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            errors.push(
              `Evidence item "${evId}" URL has invalid protocol "${parsed.protocol}".`
            );
          }
        } catch {
          errors.push(
            `Evidence item "${evId}" has malformed URL "${evItem.url}".`
          );
        }
      }
    }
  }

  // 2. Audit Omissions
  for (const omission of report.omittedContext) {
    for (const evId of omission.evidenceIds) {
      const evItem = evidenceMap.get(evId);
      if (!evItem) {
        errors.push(
          `Omission "${omission.id}" cites non-existent evidenceId "${evId}".`
        );
      }
    }
  }

  // 3. Mathematical Consistency
  if (report.overallTrustScore !== report.scoreBreakdown.finalScore) {
    errors.push(
      `overallTrustScore (${report.overallTrustScore}) does not match scoreBreakdown.finalScore (${report.scoreBreakdown.finalScore}).`
    );
  }

  if (report.overallTrustScore < 0 || report.overallTrustScore > 100) {
    errors.push(
      `overallTrustScore (${report.overallTrustScore}) must be between 0 and 100.`
    );
  }

  const calculatedTotal =
    report.claimSummary.supporting +
    report.claimSummary.contradicting +
    report.claimSummary.qualifying +
    report.claimSummary.insufficient;

  if (report.claimSummary.total !== report.evaluations.length) {
    errors.push(
      `claimSummary.total (${report.claimSummary.total}) does not match evaluations count (${report.evaluations.length}).`
    );
  }

  if (calculatedTotal !== report.claimSummary.total) {
    errors.push(
      `Sum of claimSummary categories (${calculatedTotal}) does not match claimSummary.total (${report.claimSummary.total}).`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Asserts that the verification report passes the traceability audit.
 * Throws TraceabilityAuditError if any violations are found.
 */
export function assertAuditedReport(
  report: VerificationReport,
  claims: ClaimInput[],
  evidence: Evidence[]
): void {
  const result = auditReport(report, claims, evidence);
  if (!result.isValid) {
    throw new TraceabilityAuditError(result.errors);
  }
}

