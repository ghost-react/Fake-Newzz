import { Evidence, EvidenceRelationship } from "@/schemas/evidence";
import { ClaimInput } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import {
  extractContentExcerpt,
  retrieveSourceContent,
  selectHighValueEvidenceForRetrieval,
  windowContentAroundClaim,
  NormalizedSourceContent,
} from "./sourceContent";
import { prepareEvidenceForClaim } from "./prepareEvidence";
import { ClaimEvaluatorFn, evaluateSingleClaim } from "./evaluateClaim";
import { traceStage } from "../debug/trace";

export interface EvaluateClaimsOptions {
  customEvaluator?: ClaimEvaluatorFn;
  skipRetrieval?: boolean;
  maxDistinctDomainsToFetch?: number;
  concurrency?: number;
  fetchTimeoutMs?: number;
  sourceContentRetriever?: (url: string) => Promise<NormalizedSourceContent | null>;
}

export interface EvaluateClaimsExecutionResult {
  evaluations: ClaimEvaluation[];
  evidence: Evidence[];
}

/**
 * Runs tasks with bounded concurrency.
 */
async function runConcurrentTasks<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 4
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const idx = currentIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Updates the existing Evidence `relationship` field from:
 * "unknown" -> "supporting" | "contradicting" | "qualifying" | "neutral"
 *
 * Rules:
 * - Only done based on verified claim evaluations.
 * - Never derived from source type or evidence quality alone.
 * - Keeps sourceType, sourceRelationship, evidenceQuality, relevance, and relationship as separate concepts.
 * - Non-cited evidence for evaluated claims is marked "neutral".
 */
export function updateEvidenceRelationships(
  evidenceList: Evidence[],
  evaluations: ClaimEvaluation[]
): Evidence[] {
  const evalByClaim = new Map<string, ClaimEvaluation>();
  for (const ev of evaluations) {
    evalByClaim.set(ev.claimId, ev);
  }

  return evidenceList.map((item) => {
    const claimEval = evalByClaim.get(item.claimId);
    if (!claimEval) {
      return item;
    }

    // Check if this evidence was cited in the evaluation
    const wasCited = claimEval.evidenceIds.includes(item.id);

    let newRelationship: EvidenceRelationship = "unknown";

    if (wasCited) {
      if (claimEval.verdict === "supporting") {
        newRelationship = "supporting";
      } else if (claimEval.verdict === "contradicting") {
        newRelationship = "contradicting";
      } else if (claimEval.verdict === "qualifying") {
        newRelationship = "qualifying";
      } else {
        newRelationship = "neutral";
      }
    } else {
      // Evidence retrieved and examined for this claim, but not citing/disproving it
      newRelationship = "neutral";
    }

    return {
      ...item,
      relationship: newRelationship,
    };
  });
}

/**
 * Orchestrates the complete Phase 5 Claim Evaluation pipeline across multiple claims:
 *
 * Flow:
 * 1. Validate claims and evidence grouping
 * 2. Select high-value evidence items per claim
 * 3. Selectively retrieve full source content where useful
 * 4. Prepare compact, strictly filtered evidence for each claim
 * 5. Evaluate claim against prepared evidence
 * 6. Validate result (traceability & semantic correctness)
 * 7. Update evidence relationships
 *
 * Fault Tolerance:
 * A failure on one claim does not fail all claims. Controlled per-claim fallback results are returned.
 */
export async function evaluateClaims(
  claims: ClaimInput[],
  evidence: Evidence[],
  options?: EvaluateClaimsOptions
): Promise<EvaluateClaimsExecutionResult> {
  const evaluations: ClaimEvaluation[] = [];
  const maxDistinctDomains = options?.maxDistinctDomainsToFetch ?? 4;
  const concurrency = options?.concurrency ?? 4;
  const timeoutMs = options?.fetchTimeoutMs ?? 7000;

  // Clone evidence array to avoid direct mutation
  const workingEvidence: Evidence[] = evidence.map((e) => ({ ...e }));

  // Shared URL cache across the run: if two claims share a source URL, fetch it once
  const urlContentCache = new Map<string, Promise<NormalizedSourceContent | null>>();

  const retriever = options?.sourceContentRetriever ?? retrieveSourceContent;

  function getOrFetchSourceContent(url: string): Promise<NormalizedSourceContent | null> {
    if (urlContentCache.has(url)) {
      return urlContentCache.get(url)!;
    }

    const fetchPromise = Promise.race([
      retriever(url),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      ),
    ]).catch(() => null);

    urlContentCache.set(url, fetchPromise);
    return fetchPromise;
  }

  // Evaluate each claim independently
  for (const claim of claims) {
    try {
      // Group evidence for this claim
      const claimEvidence = workingEvidence.filter((ev) => ev.claimId === claim.id);

      const fetchTraceRecords: Array<{
        url: string;
        attempted: boolean;
        success: boolean;
        errorReason: string | null;
        contentLength: number;
        contentUsed: "full_article" | "snippet";
      }> = [];

      let limitedCoverage = false;

      if (!options?.skipRetrieval && claimEvidence.length > 0) {
        // Group claim evidence by distinct domain (lowercased without www)
        const domainGroups = new Map<string, Evidence[]>();
        for (const ev of claimEvidence) {
          const dom = ev.domain.toLowerCase().replace(/^www\./, "");
          if (!domainGroups.has(dom)) {
            domainGroups.set(dom, []);
          }
          domainGroups.get(dom)!.push(ev);
        }

        const distinctDomains = Array.from(domainGroups.keys());
        if (distinctDomains.length < maxDistinctDomains) {
          limitedCoverage = true;
        }

        // Candidates: one top evidence item per distinct domain, prioritized
        const candidates = selectHighValueEvidenceForRetrieval(claimEvidence, distinctDomains.length);

        // Fetch tasks with bounded concurrency and fallback to next distinct domain
        let successfulFetches = 0;

        for (const candidate of candidates) {
          if (successfulFetches >= maxDistinctDomains) {
            break;
          }

          const workingItemIdx = workingEvidence.findIndex((e) => e.id === candidate.id);
          if (workingItemIdx === -1) continue;

          // Attempt fetch via cache
          const fetched = await getOrFetchSourceContent(candidate.url);

          if (fetched && fetched.content && fetched.content.trim().length > 0) {
            const windowedExcerpt = windowContentAroundClaim(
              fetched.content,
              claim.text
            );

            workingEvidence[workingItemIdx] = {
              ...workingEvidence[workingItemIdx],
              sourceContentStatus: "retrieved",
              sourceContentExcerpt: windowedExcerpt,
              contentDepth: "full_text",
              fetchFailed: false,
            };

            fetchTraceRecords.push({
              url: candidate.url,
              attempted: true,
              success: true,
              errorReason: null,
              contentLength: fetched.content.length,
              contentUsed: "full_article",
            });

            successfulFetches++;
          } else {
            // Failed, timed out, or empty: fall back to snippet, mark fetchFailed: true,
            // and continue loop to attempt next-ranked distinct domain
            workingEvidence[workingItemIdx] = {
              ...workingEvidence[workingItemIdx],
              sourceContentStatus: "failed",
              sourceContentExcerpt: null,
              contentDepth: "snippet",
              fetchFailed: true,
            };

            fetchTraceRecords.push({
              url: candidate.url,
              attempted: true,
              success: false,
              errorReason: "Failed to retrieve full content or host blocked scraping",
              contentLength: 0,
              contentUsed: "snippet",
            });
          }
        }
      }

      // Mark any remaining items not fetched as snippet-only
      for (let i = 0; i < workingEvidence.length; i++) {
        const item = workingEvidence[i];
        if (item.claimId === claim.id) {
          if (!item.contentDepth) {
            workingEvidence[i] = {
              ...item,
              contentDepth: "snippet",
              fetchFailed: item.fetchFailed ?? false,
            };
          }
        }
      }

      // Record unattempted items in trace
      for (const item of claimEvidence) {
        if (!fetchTraceRecords.some((r) => r.url === item.url)) {
          fetchTraceRecords.push({
            url: item.url,
            attempted: false,
            success: false,
            errorReason: null,
            contentLength: 0,
            contentUsed: "snippet",
          });
        }
      }

      try {
        traceStage("source_fetch", {
          claimId: claim.id,
          limitedCoverage,
          records: fetchTraceRecords,
        });
      } catch {}

      // Re-read updated evidence items for this claim
      const updatedClaimEvidence = workingEvidence.filter(
        (ev) => ev.claimId === claim.id
      );

      // Prepare compact LLM input
      const preparedEvidence = prepareEvidenceForClaim(
        claim.id,
        updatedClaimEvidence
      );

      try {
        traceStage("evidence_preparation", {
          claimId: claim.id,
          evidence: preparedEvidence.map((pe) => ({
            evidenceId: pe.evidenceId,
            domain: pe.domain,
            relationship: pe.sourceRelationship,
            contentDepth: pe.contentDepth,
            fetchFailed: pe.fetchFailed,
            textLength: (pe.sourceContentExcerpt || pe.snippet || "").length,
          })),
        });
      } catch {}

      // Evaluate the single claim
      const evaluation = await evaluateSingleClaim(
        claim,
        preparedEvidence,
        options?.customEvaluator
      );

      try {
        traceStage("evaluation", {
          claimId: evaluation.claimId,
          verdict: evaluation.verdict,
          confidence: evaluation.confidence,
          evidenceIds: evaluation.evidenceIds,
          importantNotes: evaluation.importantNotes,
        });
      } catch {}

      evaluations.push(evaluation);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err || "Unknown error during evaluation");
      // Controlled per-claim failure: do not crash the entire pipeline
      evaluations.push({
        claimId: claim.id,
        verdict: "insufficient",
        confidence: "low",
        explanation: `Claim evaluation could not be completed reliably: ${errMsg}`,
        evidenceIds: [],
        importantNotes: [
          "Controlled per-claim fallback triggered due to evaluation error.",
        ],
      });
    }
  }

  // Update evidence relationships based on the resulting evaluations
  const finalEvidence = updateEvidenceRelationships(workingEvidence, evaluations);

  return {
    evaluations,
    evidence: finalEvidence,
  };
}
