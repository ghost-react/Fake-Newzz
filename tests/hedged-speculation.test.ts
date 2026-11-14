import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { determineVerdictWithRule, determineStoryStatus } from "../src/lib/scoring/determineVerdict";
import { deterministicEvaluateClaim } from "../src/lib/verification/evaluateClaim";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import { Article } from "../src/schemas/article";
import { ComparisonReport } from "../src/schemas/comparison";
import { OriginCluster } from "../src/lib/comparison/independence";

describe("Hedged, Speculative & Analytical Verification Test Suite", () => {
  // ─── a. Analysis article with hedged scenarios for three teams ──────────────
  it("a. Analysis article with hedged scenarios for three teams, all credibly reported, no confirmation: NOT Misleading, not False, storyStatus unconfirmed_reports", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Hardik Pandya could potentially be traded to Punjab Kings ahead of next season",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
      {
        id: "c2",
        text: "Delhi Capitals are also reportedly considering exploring options for an all-rounder trade",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
      {
        id: "c3",
        text: "Lucknow Super Giants may emerge as a dark horse in trade talks",
        importance: "medium",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "IPL Trade Rumours: PBKS explore all-rounder options",
        url: "https://cricinfo.com/trade-talks-pbks",
        domain: "cricinfo.com",
        snippet: "Punjab Kings are reportedly exploring options to trade for Hardik Pandya, though discussions remain preliminary.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "specialized_trade",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Punjab Kings exploring options for trade talks.",
      },
      {
        id: "ev2",
        claimId: "c2",
        title: "Delhi Capitals monitor auction market",
        url: "https://cricbuzz.com/dc-trade",
        domain: "cricbuzz.com",
        snippet: "Delhi Capitals management is considering trade scenarios for senior Indian all-rounders.",
        publishedAt: "2026-05-01T11:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "specialized_trade",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "DC considering trade scenarios.",
      },
      {
        id: "ev3",
        claimId: "c3",
        title: "LSG keep tabs on player movements",
        url: "https://sportstar.com/lsg-talks",
        domain: "sportstar.com",
        snippet: "Insiders suggest LSG may emerge in discussions if trade windows open.",
        publishedAt: "2026-05-01T12:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "specialized_trade",
        evidenceQuality: "medium",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "LSG may emerge in discussions.",
      },
    ];

    // Evaluate deterministically with certainty = speculation
    const evaluations: ClaimEvaluation[] = claims.map((c) =>
      deterministicEvaluateClaim(
        c,
        evidence
          .filter((e) => e.claimId === c.id)
          .map((e) => ({
            evidenceId: e.id,
            claimId: e.claimId,
            title: e.title,
            snippet: e.snippet,
            domain: e.domain,
            url: e.url,
            sourceType: e.sourceType,
            sourceRelationship: e.sourceRelationship,
            evidenceQuality: e.evidenceQuality,
            relevance: e.relevance,
            sourceContentStatus: e.sourceContentStatus || "retrieved",
            sourceContentExcerpt: e.sourceContentExcerpt || null,
            publishedAt: e.publishedAt || null,
          }))
      )
    );

    // All claims are supported as "credibly reported"
    evaluations.forEach((ev) => {
      assert.strictEqual(ev.verdict, "supporting");
      assert.ok(ev.importantNotes.some((n) => n.includes("Speculation") || n.includes("credibly reported")));
    });

    const clusters: OriginCluster[] = [
      { clusterId: "cl1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl3", memberEvidenceIds: ["ev3"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: claims.map((c) => ({
        claimId: c.id,
        independentClusterCount: 1,
        agreementSummary: "strong",
        conflicts: [],
        dimensions: [
          {
            dimension: "event",
            outcome: "agreement",
            articleValue: c.text,
            sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: c.text }],
          },
        ],
      })),
    };

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    // Invariant: Hedged, credibly reported analysis is NOT Misleading and NOT False
    assert.notStrictEqual(result.veracityVerdict, "misleading");
    assert.notStrictEqual(result.veracityVerdict, "false");
    assert.notStrictEqual(result.veracityVerdict, "mostly_false");
    assert.strictEqual(result.veracityVerdict, "mostly_true");
    assert.strictEqual(result.storyStatus, "unconfirmed_reports");

    // Breakdown includes the note explaining unconfirmed developments
    const hedgedFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "HEDGED_SPECULATION_MOSTLY_TRUSTWORTHY"
    );
    assert.ok(hedgedFactor !== undefined);
    assert.ok(hedgedFactor.note?.includes("This story reports unconfirmed developments"));
  });

  // ─── b. Same story headlined as "Hardik Pandya joins PBKS" ─────────────────
  it("b. The same story headlined as 'Hardik Pandya joins PBKS' while evidence shows only talks: flagged as framing mismatch, Potentially Misleading, with evidenceIds", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Hardik Pandya joins Punjab Kings for the upcoming season",
        importance: "high",
        claimType: "factual",
        layer: "event_occurred",
        certainty: "asserted_fact", // Unhedged assertion of a done deal
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "PBKS and MI in preliminary trade talks",
        url: "https://cricinfo.com/pbks-talks",
        domain: "cricinfo.com",
        snippet: "Franchises have held informal talks regarding trade possibilities, but no agreement or signing has occurred.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "specialized_trade",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Informal talks only; no agreement or signing.",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting", // Evidence confirms talks, but framing is exaggerated
        confidence: "medium",
        explanation: "Evidence shows only talks are reported; the finalized transfer is unconfirmed.",
        evidenceIds: ["ev1"],
        importantNotes: ["Framing mismatch: only talks reported while article asserts a finalized move."],
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    // Material omission: framing mismatch
    const omissions: Omission[] = [
      {
        id: "om-framing-1",
        claimId: "c1",
        type: "misleading_framing",
        severity: "high",
        confidence: "high",
        description: "The article presents the player transfer as an established fact ('joins PBKS'), but independent reporting shows only preliminary trade talks took place.",
        whyItMatters: "Readers are led to believe a transfer has been completed when no contract or agreement exists.",
        evidenceIds: ["ev1"],
      },
    ];

    const result = calculateScoreV2(claims, evaluations, omissions, {
      evidence,
    });

    // Invariant: Asserted fact with only speculative evidence is Potentially Misleading
    assert.strictEqual(result.veracityVerdict, "misleading");
    assert.ok(result.scoreBreakdown.omissionPenalty > 0);

    // Omission is properly backed by evidenceIds
    assert.strictEqual(omissions[0].evidenceIds.length, 1);
    assert.strictEqual(omissions[0].evidenceIds[0], "ev1");
  });

  // ─── c. Different outlets naming different teams ───────────────────────────
  it("c. Different outlets naming different teams: no contradiction, lower confidence only", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Several IPL teams are reportedly interested in acquiring Hardik Pandya",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Credible reporting notes multi-franchise trade interest.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: ["Speculation: developing rumour variation across outlets."],
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    // Comparison where different outlets report different destination teams
    const comparison: ComparisonReport = {
      totalIndependentClusters: 2,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [
            {
              dimension: "names",
              description: "Outlet A names PBKS while Outlet B names DC",
              evidenceIds: ["ev1", "ev2"],
              conflictType: "unconfirmed_variation", // Expected rumour variation!
            },
          ],
          dimensions: [
            {
              dimension: "names",
              outcome: "unconfirmed_variation",
              articleValue: "PBKS, DC",
              sourceValues: [
                { clusterId: "cl1", evidenceId: "ev1", value: "Punjab Kings" },
                { clusterId: "cl2", evidenceId: "ev2", value: "Delhi Capitals" },
              ],
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "cl1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "PBKS in talks", url: "https://a.com", domain: "a.com", snippet: "PBKS", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "PBKS" },
      { id: "ev2", claimId: "c1", title: "DC in talks", url: "https://b.com", domain: "b.com", snippet: "DC", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "DC" },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    // Invariant: Unconfirmed rumour variation does NOT create a contradiction penalty
    const conflictPenaltyFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "MATERIAL_CONFLICT_ADJUSTMENT"
    );
    assert.strictEqual(conflictPenaltyFactor, undefined, "Expected no material conflict penalty for unconfirmed variation");

    // Breakdown includes the unconfirmed variation note
    const unconfirmedFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "UNCONFIRMED_VARIATION"
    );
    assert.ok(unconfirmedFactor !== undefined);

    // Confidence is lowered to medium (not high)
    assert.strictEqual(result.confidence, "medium");
    assert.notStrictEqual(result.veracityVerdict, "misleading");
  });

  // ─── d. Franchise denial appears as a "denial" context entry ───────────────
  it("d. A franchise denial appears as a 'denial' context entry and does not turn another outlet's report into a contradiction", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "PBKS are considering a blockbuster trade for Hardik Pandya",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Trade discussions reported by sports outlets.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    // PBKS CEO issues public denial
    const comparison: ComparisonReport = {
      totalIndependentClusters: 2,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [
            {
              dimension: "official_statements",
              description: "PBKS CEO denies formal trade approach",
              evidenceIds: ["ev2"],
              conflictType: "denial",
            },
          ],
          dimensions: [
            {
              dimension: "official_statements",
              outcome: "denial",
              articleValue: "Talks underway",
              sourceValues: [
                { clusterId: "cl1", evidenceId: "ev1", value: "Talks underway" },
                { clusterId: "cl2", evidenceId: "ev2", value: "Franchise denies formal trade talks" },
              ],
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "cl1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "Trade talks reported", url: "https://a.com", domain: "a.com", snippet: "Talks reported", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "Talks" },
      { id: "ev2", claimId: "c1", title: "PBKS denies talks", url: "https://b.com", domain: "b.com", snippet: "CEO denies approach", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "neutral", sourceType: "official", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "CEO denial" },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    // Invariant: Denial does NOT trigger a material conflict reduction
    const conflictAdj = result.scoreBreakdown.factors.find(
      (f) => f.code === "MATERIAL_CONFLICT_ADJUSTMENT"
    );
    assert.strictEqual(conflictAdj, undefined, "Denial must not trigger material conflict reduction");

    // Denial is recorded as additional context factor
    const denialFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "DENIAL_CONTEXT"
    );
    assert.ok(denialFactor !== undefined);
    assert.ok(denialFactor.note?.includes("Denial by interested party recorded"));
  });

  // ─── e. Opinion/analysis claims excluded from weighted score ───────────────
  it("e. Opinion/analysis claims are excluded from the weighted score", () => {
    const factualClaim: ClaimInput = {
      id: "c1",
      text: "The meeting between franchise executives took place on Tuesday",
      importance: "high",
      claimType: "event",
      layer: "event_occurred",
      certainty: "asserted_fact",
    };

    const opinionClaim: ClaimInput = {
      id: "c2",
      text: "Hardik Pandya would be the perfect captain to revive Punjab Kings",
      importance: "high",
      claimType: "opinion",
      layer: "interpretation",
      certainty: "opinion_analysis",
    };

    const factualEvaluation: ClaimEvaluation = {
      claimId: "c1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Meeting confirmed by multiple reports.",
      evidenceIds: ["ev1"],
      importantNotes: [],
      layer: "event_occurred",
      certainty: "asserted_fact",
    };

    const opinionEvaluation: ClaimEvaluation = {
      claimId: "c2",
      verdict: "insufficient",
      confidence: "low",
      explanation: "Editorial viewpoint cannot be evaluated as an objective factual assertion.",
      evidenceIds: [],
      importantNotes: ["Opinion/analysis claim: omitted from factual verification score."],
      layer: "interpretation",
      certainty: "opinion_analysis",
    };

    // 1. Calculate score with factual claim alone
    const scoreSingle = calculateScoreV2([factualClaim], [factualEvaluation], []);

    // 2. Calculate score with factual claim AND opinion claim
    const scoreWithOpinion = calculateScoreV2(
      [factualClaim, opinionClaim],
      [factualEvaluation, opinionEvaluation],
      []
    );

    // Invariant: Opinion claim has zero effect on the score
    assert.strictEqual(
      scoreWithOpinion.overallTrustScore,
      scoreSingle.overallTrustScore,
      "Adding an opinion/analysis claim must not change the overall trust score"
    );

    // Breakdown records the exclusion factor
    const exclusionFactor = scoreWithOpinion.scoreBreakdown.factors.find(
      (f) => f.code === "OPINION_ANALYSIS_CLAIM_EXCLUDED" || f.code === "INTERPRETATION_CLAIM_EXCLUDED"
    );
    assert.ok(exclusionFactor !== undefined);
  });

  // ─── f. Confirmed fact article is unchanged (regression) ───────────────────
  it("f. A confirmed fact article is unchanged by this task (regression)", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "The Reserve Bank of India kept the repo rate unchanged at 6.5%",
        importance: "high",
        claimType: "numeric",
        layer: "underlying_fact",
        certainty: "asserted_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "RBI official monetary policy statement confirms rate held at 6.5%.",
        evidenceIds: ["ev-rbi-1", "ev-rbi-2"],
        importantNotes: [],
        layer: "underlying_fact",
        certainty: "asserted_fact",
      },
    ];

    const evidence: Evidence[] = [
      { id: "ev-rbi-1", claimId: "c1", title: "RBI Policy", url: "https://rbi.org.in", domain: "rbi.org.in", snippet: "Repo rate held at 6.5%", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "official", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "6.5%" },
      { id: "ev-rbi-2", claimId: "c1", title: "Reuters RBI", url: "https://reuters.com", domain: "reuters.com", snippet: "RBI holds 6.5%", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "wire", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "6.5%" },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 2,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 2,
          agreementSummary: "strong",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "agreement",
              articleValue: "6.5%",
              sourceValues: [
                { clusterId: "cl1", evidenceId: "ev-rbi-1", value: "6.5%" },
                { clusterId: "cl2", evidenceId: "ev-rbi-2", value: "6.5%" },
              ],
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "cl1", memberEvidenceIds: ["ev-rbi-1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl2", memberEvidenceIds: ["ev-rbi-2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    assert.ok(result.overallTrustScore >= 90);
    assert.strictEqual(result.veracityVerdict, "verified_true");
    assert.strictEqual(result.storyStatus, "confirmed");
  });

  // ─── g. False claim stated as fact is still marked contradicted ────────────
  it("g. A false claim stated as fact is still marked contradicted", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "The government announced the complete abolition of income tax",
        importance: "high",
        claimType: "factual",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "PIB Fact Check: Income tax abolition claim is false",
        url: "https://pib.gov.in/fact-check",
        domain: "pib.gov.in",
        snippet: "PIB Fact Check confirms the claim is completely fake. No such announcement was made.",
        publishedAt: "2026-05-01",
        sourceRelationship: "independent",
        relationship: "contradicting",
        sourceType: "fact_check",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Fake claim refuted.",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official fact-checking bodies and government releases directly debunk this claim as false.",
        evidenceIds: ["ev1"],
        importantNotes: ["Claim refuted by official authorities."],
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      evidence,
    });

    assert.strictEqual(result.veracityVerdict, "false");
    assert.ok(result.overallTrustScore < 30);
  });

  // ─── h. Same input twice gives the same score (pure determinism) ───────────
  it("h. The same input twice gives the same score (pure determinism)", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Hardik Pandya could be considering a trade scenario",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Credibly reported trade scenario.",
        evidenceIds: ["ev1"],
        importantNotes: ["Speculation: possibility credibly reported."],
        layer: "underlying_fact",
        certainty: "speculation",
      },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "Trade rumours", url: "https://sport.com", domain: "sport.com", snippet: "Trade scenario", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "medium", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "Trade scenario" },
    ];

    const run1 = calculateScoreV2(claims, evaluations, [], { evidence });
    const run2 = calculateScoreV2(claims, evaluations, [], { evidence });

    assert.strictEqual(run1.overallTrustScore, run2.overallTrustScore);
    assert.strictEqual(run1.veracityVerdict, run2.veracityVerdict);
    assert.strictEqual(run1.storyStatus, run2.storyStatus);
    assert.deepStrictEqual(run1.scoreBreakdown, run2.scoreBreakdown);
  });
});

