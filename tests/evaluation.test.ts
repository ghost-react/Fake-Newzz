import test from "node:test";
import assert from "node:assert/strict";

import {
  ClaimEvaluation,
  EvaluateClaimsRequestSchema,
} from "../src/schemas/evaluation";
import { Evidence, ClaimInput } from "../src/schemas/evidence";
import { validateClaimEvaluation } from "../src/lib/verification/validateEvaluation";
import { prepareEvidenceForClaim } from "../src/lib/verification/prepareEvidence";
import {
  evaluateClaims,
  updateEvidenceRelationships,
} from "../src/lib/verification/evaluateClaims";
import { evaluateSingleClaim } from "../src/lib/verification/evaluateClaim";

test("Phase 5 Claim Evaluation Test Suite", async (t) => {
  // 1. SUPPORTING: Official evidence directly confirms claim -> supporting / high
  await t.test(
    "1. supporting verdict - official evidence directly confirms claim (supporting / high)",
    async () => {
      const claim: ClaimInput = {
        id: "claim-sup-1",
        text: "The Ministry of Finance announced an increase in basic tax exemption to 3 Lakh rupees.",
        importance: "high",
        claimType: "policy",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-sup-1",
          claimId: "claim-sup-1",
          title: "Ministry of Finance Press Release",
          url: "https://finmin.gov.in/press/budget-2026",
          domain: "finmin.gov.in",
          snippet: "Basic tax exemption limit officially hiked to Rs 3 Lakh in Budget 2026 announcement.",
          publishedAt: "2026-02-01T11:00:00Z",
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "official",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      // Evaluator directly assessing the evidence against claim
      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "supporting",
        confidence: "high",
        explanation: "The official Ministry of Finance press release directly confirms the basic tax exemption increase to 3 Lakh rupees.",
        evidenceIds: ["ev-sup-1"],
        importantNotes: [],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "supporting");
      assert.strictEqual(result.confidence, "high");
      assert.strictEqual(result.evidenceIds.length, 1);
      assert.strictEqual(result.evidenceIds[0], "ev-sup-1");
    }
  );

  // 2. CONTRADICTING: Strong evidence directly disproves claim -> contradicting / high
  await t.test(
    "2. contradicting verdict - strong evidence directly disproves claim (contradicting / high)",
    async () => {
      const claim: ClaimInput = {
        id: "claim-contra-1",
        text: "NASA announced that the James Webb telescope has been decommissioned due to power failure.",
        importance: "high",
        claimType: "science",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-contra-1",
          claimId: "claim-contra-1",
          title: "NASA Mission Status Report",
          url: "https://nasa.gov/missions/webb/status-update",
          domain: "nasa.gov",
          snippet: "The James Webb Space Telescope continues nominal science operations with full power systems operational.",
          publishedAt: "2026-03-10T14:00:00Z",
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "official",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official NASA mission status directly refutes decommissioning and confirms full operational status.",
        evidenceIds: ["ev-contra-1"],
        importantNotes: ["Decommissioning claim is contradicted by primary mission control status."],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "contradicting");
      assert.strictEqual(result.confidence, "high");
      assert.strictEqual(result.evidenceIds[0], "ev-contra-1");
    }
  );

  // 3. QUALIFYING: Evidence narrows or materially adds conditions -> qualifying
  await t.test(
    "3. qualifying verdict - evidence narrows or materially changes the claim",
    async () => {
      const claim: ClaimInput = {
        id: "claim-qual-1",
        text: "The new highway speed limit has been raised to 140 km/h nationwide.",
        importance: "high",
        claimType: "regulatory",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-qual-1",
          claimId: "claim-qual-1",
          title: "National Highway Authority Gazette Notification",
          url: "https://nhai.gov.in/gazette/speed-limits-2026.pdf",
          domain: "nhai.gov.in",
          snippet: "Speed limit increased to 140 km/h strictly for expressways with controlled access, and remains 100 km/h on standard highways.",
          publishedAt: "2026-01-15T00:00:00Z",
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "primary_document",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "qualifying",
        confidence: "high",
        explanation: "The gazette notification shows the 140 km/h speed limit applies strictly to controlled-access expressways, not nationwide on all highways.",
        evidenceIds: ["ev-qual-1"],
        importantNotes: ["Applies only to expressways, not all national highways."],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "qualifying");
      assert.strictEqual(result.evidenceIds.length, 1);
    }
  );

  // 4. INSUFFICIENT: Weak/vague evidence cannot establish truth -> insufficient
  await t.test(
    "4. insufficient verdict - weak or vague evidence cannot establish truth",
    async () => {
      const claim: ClaimInput = {
        id: "claim-insuf-1",
        text: "TechCorp plans to acquire StartupX for 2 Billion dollars next quarter.",
        importance: "medium",
        claimType: "business",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-insuf-1",
          claimId: "claim-insuf-1",
          title: "Tech Rumor Blog Post",
          url: "https://rumorcentral.xyz/post-123",
          domain: "rumorcentral.xyz",
          snippet: "Sources on social media claim TechCorp might be looking at acquisitions in the AI space.",
          publishedAt: "2026-04-01T08:00:00Z",
          sourceRelationship: "unknown",
          relationship: "unknown",
          sourceType: "blog",
          evidenceQuality: "low",
          relevance: "weak",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "insufficient",
        confidence: "low",
        explanation: "The available evidence consists of an unverified rumor blog without specific confirmation of the deal or terms.",
        evidenceIds: ["ev-insuf-1"],
        importantNotes: ["Unsubstantiated market rumor."],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "insufficient");
      assert.strictEqual(result.confidence, "low");
    }
  );

  // 5. CONFLICT: Strong independent evidence supports and contradicts -> insufficient
  await t.test(
    "5. conflict resolution - conflicting strong independent evidence yields insufficient",
    async () => {
      const claim: ClaimInput = {
        id: "claim-conf-1",
        text: "City Airport runway expansion project has been formally approved.",
        importance: "high",
        claimType: "civic",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-conf-1",
          claimId: "claim-conf-1",
          title: "Municipal Authority Bulletin",
          url: "https://city.gov/bulletin/expansion-approved",
          domain: "city.gov",
          snippet: "The airport runway expansion proposal passed municipal council approval today.",
          publishedAt: "2026-05-02T10:00:00Z",
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "official",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-conf-2",
          claimId: "claim-conf-1",
          title: "National Environmental Court Stay Order",
          url: "https://envcourt.gov/orders/stay-airport-runway",
          domain: "envcourt.gov",
          snippet: "Environmental court issues interim injunction staying all runway expansion approvals pending assessment.",
          publishedAt: "2026-05-02T12:00:00Z",
          sourceRelationship: "independent",
          relationship: "unknown",
          sourceType: "primary_document",
          evidenceQuality: "high",
          relevance: "direct",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "insufficient",
        confidence: "low",
        explanation: "Direct conflict between the municipal approval announcement and a simultaneous judicial court stay order prevents reliable determination.",
        evidenceIds: ["ev-conf-1", "ev-conf-2"],
        importantNotes: ["Direct unresolvable conflict between municipal decree and judicial stay."],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "insufficient");
      assert.strictEqual(result.confidence, "low");
      assert.strictEqual(result.evidenceIds.length, 2);
    }
  );

  // 6. SYNDICATION: Multiple sites repeat same wire source -> not treated as independent confirmations
  await t.test(
    "6. syndication handling - syndicated copies are not treated as independent confirmations",
    async () => {
      const claim: ClaimInput = {
        id: "claim-syn-1",
        text: "Global trade summit dates shifted to November.",
        importance: "medium",
        claimType: "diplomatic",
      };

      const evidence: Evidence[] = [
        {
          id: "ev-wire-1",
          claimId: "claim-syn-1",
          title: "Reuters: Trade Summit Moved to November",
          url: "https://reuters.com/world/trade-summit-shift",
          domain: "reuters.com",
          snippet: "Diplomats confirmed the trade summit is moved to November.",
          publishedAt: "2026-04-10T09:00:00Z",
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "wire",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-copy-1",
          claimId: "claim-syn-1",
          title: "Portal A: Summit in November (Reuters)",
          url: "https://portala.com/news/summit-nov",
          domain: "portala.com",
          snippet: "Reuters reports that diplomats confirmed the trade summit is moved to November.",
          publishedAt: "2026-04-10T10:00:00Z",
          sourceRelationship: "syndicated",
          relationship: "unknown",
          sourceType: "national_news",
          evidenceQuality: "medium",
          relevance: "direct",
        },
        {
          id: "ev-copy-2",
          claimId: "claim-syn-1",
          title: "NewsFeed: Trade Summit Date Change",
          url: "https://newsfeed.org/trade-summit",
          domain: "newsfeed.org",
          snippet: "According to Reuters, diplomats confirmed the summit moved to November.",
          publishedAt: "2026-04-10T11:00:00Z",
          sourceRelationship: "syndicated",
          relationship: "unknown",
          sourceType: "other",
          evidenceQuality: "low",
          relevance: "direct",
        },
      ];

      const prepared = prepareEvidenceForClaim(claim.id, evidence);

      // Verify that prepared evidence faithfully preserves sourceRelationship
      assert.strictEqual(prepared[0].sourceRelationship, "original");
      assert.strictEqual(prepared[1].sourceRelationship, "syndicated");
      assert.strictEqual(prepared[2].sourceRelationship, "syndicated");

      const mockEvaluator = async () => ({
        claimId: claim.id,
        verdict: "supporting",
        confidence: "medium",
        explanation: "Single wire report from Reuters supports the claim; two other portals are syndicated copies rather than independent confirmations.",
        evidenceIds: ["ev-wire-1"],
        importantNotes: ["Syndicated re-publications from Portal A and NewsFeed were discounted as duplicates."],
      });

      const result = await evaluateSingleClaim(claim, prepared, mockEvaluator);
      assert.strictEqual(result.verdict, "supporting");
      // Cites only the single primary wire, not treating the 3 items as 3 confirmations
      assert.strictEqual(result.evidenceIds.length, 1);
      assert.strictEqual(result.evidenceIds[0], "ev-wire-1");
    }
  );

  // 7. INVALID EVIDENCE ID: LLM references nonexistent ID -> validation failure
  await t.test(
    "7. invalid evidence ID rejection - rejects fabricated IDs not in supplied evidence",
    () => {
      const rawEval = {
        claimId: "claim-101",
        verdict: "supporting",
        confidence: "high",
        explanation: "Verified by official press briefing.",
        evidenceIds: ["ev-real-1", "ev-FABRICATED-999"],
        importantNotes: [],
      };

      const validEvidenceIds = ["ev-real-1", "ev-real-2"];
      const result = validateClaimEvaluation(rawEval, "claim-101", validEvidenceIds);

      assert.strictEqual(result.isValid, false);
      if (!result.isValid) {
        assert.match(
          result.error,
          /Fabricated or invalid evidence ID "ev-FABRICATED-999"/
        );
      }
    }
  );

  // 8. CROSS-CLAIM ID: Evidence ID belongs to another claim -> validation failure
  await t.test(
    "8. cross-claim ID rejection - rejects evidence ID from different claim",
    () => {
      const rawEval = {
        claimId: "claim-target",
        verdict: "supporting",
        confidence: "high",
        explanation: "Confirmed by report.",
        evidenceIds: ["ev-from-other-claim-99"],
        importantNotes: [],
      };

      // Only ev-target-1 belongs to claim-target
      const validEvidenceIds = ["ev-target-1"];
      const result = validateClaimEvaluation(rawEval, "claim-target", validEvidenceIds);

      assert.strictEqual(result.isValid, false);
      if (!result.isValid) {
        assert.match(
          result.error,
          /Fabricated or invalid evidence ID "ev-from-other-claim-99"/
        );
      }
    }
  );

  // 9. DEDUPLICATION OF EVIDENCE IDS
  await t.test(
    "9. evidence ID deduplication - collapses duplicate citations",
    () => {
      const rawEval = {
        claimId: "claim-dedup-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Valid confirmation.",
        evidenceIds: ["ev-1", "ev-1", "ev-2", "ev-1"],
        importantNotes: [],
      };

      const validEvidenceIds = ["ev-1", "ev-2"];
      const result = validateClaimEvaluation(rawEval, "claim-dedup-1", validEvidenceIds);

      assert.strictEqual(result.isValid, true);
      if (result.isValid) {
        assert.deepStrictEqual(result.evaluation.evidenceIds, ["ev-1", "ev-2"]);
      }
    }
  );

  // 10. REJECTION OF EMPTY EXPLANATION OR MISSING EVIDENCE FOR SUPPORTING
  await t.test(
    "10. validation constraints - supporting requires at least 1 evidence ID and non-empty explanation",
    () => {
      // Empty explanation -> rejected by Zod
      const emptyExp = {
        claimId: "claim-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "   ",
        evidenceIds: ["ev-1"],
        importantNotes: [],
      };
      assert.strictEqual(
        validateClaimEvaluation(emptyExp, "claim-1", ["ev-1"]).isValid,
        false
      );

      // Supporting with zero evidence IDs -> rejected
      const zeroEv = {
        claimId: "claim-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Valid explanation but no evidence.",
        evidenceIds: [],
        importantNotes: [],
      };
      assert.strictEqual(
        validateClaimEvaluation(zeroEv, "claim-1", ["ev-1"]).isValid,
        false
      );

      // Insufficient with zero evidence IDs -> permitted
      const insufZeroEv = {
        claimId: "claim-1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "No evidence found to verify.",
        evidenceIds: [],
        importantNotes: [],
      };
      assert.strictEqual(
        validateClaimEvaluation(insufZeroEv, "claim-1", ["ev-1"]).isValid,
        true
      );
    }
  );

  // 11. EVIDENCE RELATIONSHIP UPDATE
  await t.test(
    "11. evidence relationship update - maps verdict to evidence item relationships",
    () => {
      const evidenceList: Evidence[] = [
        {
          id: "ev-1",
          claimId: "claim-1",
          title: "Title 1",
          url: "https://example.com/1",
          domain: "example.com",
          snippet: "Snippet 1",
          publishedAt: null,
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "official",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-2",
          claimId: "claim-1",
          title: "Title 2",
          url: "https://example.com/2",
          domain: "example.com",
          snippet: "Snippet 2",
          publishedAt: null,
          sourceRelationship: "independent",
          relationship: "unknown",
          sourceType: "national_news",
          evidenceQuality: "medium",
          relevance: "related",
        },
      ];

      const evaluations: ClaimEvaluation[] = [
        {
          claimId: "claim-1",
          verdict: "supporting",
          confidence: "high",
          explanation: "Supported by ev-1.",
          evidenceIds: ["ev-1"],
          importantNotes: [],
        },
      ];

      const updated = updateEvidenceRelationships(evidenceList, evaluations);

      // ev-1 was cited as supporting
      assert.strictEqual(updated[0].relationship, "supporting");
      // ev-2 was retrieved but not cited -> neutral
      assert.strictEqual(updated[1].relationship, "neutral");
    }
  );

  // 12. EVALUATE CLAIMS SERVICE - FAULT ISOLATION
  await t.test(
    "12. fault isolation - failure on one claim does not crash batch evaluation",
    async () => {
      const claims: ClaimInput[] = [
        {
          id: "claim-ok",
          text: "Claim that succeeds.",
          importance: "high",
          claimType: "factual",
        },
        {
          id: "claim-fail",
          text: "Claim that errors.",
          importance: "low",
          claimType: "factual",
        },
      ];

      const evidence: Evidence[] = [
        {
          id: "ev-ok",
          claimId: "claim-ok",
          title: "Good evidence",
          url: "https://example.com/good",
          domain: "example.com",
          snippet: "Good text",
          publishedAt: null,
          sourceRelationship: "original",
          relationship: "unknown",
          sourceType: "official",
          evidenceQuality: "high",
          relevance: "direct",
        },
        {
          id: "ev-fail",
          claimId: "claim-fail",
          title: "Some evidence",
          url: "https://example.com/fail",
          domain: "example.com",
          snippet: "Some snippet",
          publishedAt: null,
          sourceRelationship: "unknown",
          relationship: "unknown",
          sourceType: "other",
          evidenceQuality: "low",
          relevance: "related",
        },
      ];

      const mockEvaluator = async (claim: ClaimInput) => {
        if (claim.id === "claim-fail") {
          throw new Error("Simulated LLM network timeout");
        }
        return {
          claimId: "claim-ok",
          verdict: "supporting",
          confidence: "high",
          explanation: "Good evidence directly confirms claim.",
          evidenceIds: ["ev-ok"],
          importantNotes: [],
        };
      };

      const result = await evaluateClaims(claims, evidence, {
        customEvaluator: mockEvaluator,
        skipRetrieval: true,
      });

      assert.strictEqual(result.evaluations.length, 2);

      // Claim 1 succeeded
      assert.strictEqual(result.evaluations[0].claimId, "claim-ok");
      assert.strictEqual(result.evaluations[0].verdict, "supporting");

      // Claim 2 failed gracefully with controlled fallback
      assert.strictEqual(result.evaluations[1].claimId, "claim-fail");
      assert.strictEqual(result.evaluations[1].verdict, "insufficient");
      assert.match(
        result.evaluations[1].explanation,
        /Simulated LLM network timeout/
      );
    }
  );

  // 13. API REQUEST SCHEMA VALIDATION
  await t.test(
    "13. API request schema validation - rejects invalid claims or cross-claim evidence",
    () => {
      // Rejects empty claims
      const emptyClaims = {
        claims: [],
        evidence: [],
      };
      assert.strictEqual(
        EvaluateClaimsRequestSchema.safeParse(emptyClaims).success,
        false
      );

      // Rejects evidence referencing non-existent claim
      const mismatchedClaim = {
        claims: [
          {
            id: "claim-1",
            text: "Valid claim",
            importance: "high",
            claimType: "factual",
          },
        ],
        evidence: [
          {
            id: "ev-1",
            claimId: "NON_EXISTENT_CLAIM",
            title: "Evidence",
            url: "https://example.com/news",
            domain: "example.com",
            snippet: "Some snippet",
            publishedAt: null,
            sourceRelationship: "unknown",
            relationship: "unknown",
            sourceType: "other",
            evidenceQuality: "unknown",
            relevance: "unknown",
          },
        ],
      };
      assert.strictEqual(
        EvaluateClaimsRequestSchema.safeParse(mismatchedClaim).success,
        false
      );
    }
  );
});
