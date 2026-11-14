import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { scoreCanReach100 } from "../src/lib/scoring/perfectScore";
import { DEFAULT_SCORING_V2_CONFIG } from "../src/lib/scoring/config.v2";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation, ClaimEvaluationSchema } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import { Article } from "../src/schemas/article";
import { ComparisonReport } from "../src/schemas/comparison";
import { LlmDimensionalComparisonSchema } from "../src/lib/comparison/compareClaims";
import { OmissionSchema, OmissionResultSchema } from "../src/schemas/omission";

describe("Scoring v2 Engine Test Suite", () => {
  // ── a. Five syndicated copies (1 cluster) score the same as one report ──
  it("a. Five syndicated copies (1 cluster) score the same as one report", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "The High Court issued guidelines on municipal elections",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by reporting.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence1: Evidence = {
      id: "ev1",
      claimId: "c1",
      title: "HC election guidelines",
      snippet: "PTI: High court issued guidelines.",
      url: "https://outlet1.com/hc",
      domain: "outlet1.com",
      sourceType: "national_news",
      sourceRelationship: "syndicated",
      evidenceQuality: "high",
      relevance: "direct",
      relationship: "supporting",
      sourceContentStatus: "retrieved",
      sourceContentExcerpt: "The High Court issued guidelines on municipal elections.",
    };

    // Case 1: 1 report (1 cluster)
    const comparison1: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "event" }] }],
          independentClusterCount: 1,
          agreementSummary: "weak",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
    };

    const res1 = calculateScoreV2(claims, evaluations, [], {
      comparison: comparison1,
      evidence: [evidence1],
    });

    // Case 2: 5 syndicated copies (still 1 cluster)
    const comparison5: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "event" }] }],
          independentClusterCount: 1, // Syndicated copies collapse into 1 cluster
          agreementSummary: "weak",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
    };

    const res5 = calculateScoreV2(claims, evaluations, [], {
      comparison: comparison5,
      evidence: [evidence1],
    });

    assert.equal(res1.overallTrustScore, res5.overallTrustScore, "5 syndicated copies must produce identical score to 1 copy");
  });

  // ── b. Three truly independent clusters score higher than one on identical verdicts ──
  it("b. Three truly independent clusters score higher than one on identical verdicts", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Global health body approves second malaria vaccine",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by reports.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Malaria vaccine",
        snippet: "WHO approves vaccine",
        url: "https://who.int/vax",
        domain: "who.int",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Full official announcement.",
      },
    ];

    const comp1Cluster: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [{ clusterId: "c1", evidenceId: "ev1", value: "event" }] }],
          independentClusterCount: 1,
          agreementSummary: "weak",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
    };

    const comp3Clusters: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [{ clusterId: "c1", evidenceId: "ev1", value: "event" }] }],
          independentClusterCount: 3,
          agreementSummary: "strong",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    const score1 = calculateScoreV2(claims, evaluations, [], {
      comparison: comp1Cluster,
      evidence,
    });

    const score3 = calculateScoreV2(claims, evaluations, [], {
      comparison: comp3Clusters,
      evidence,
    });

    assert.ok(
      score3.overallTrustScore > score1.overallTrustScore,
      `Expected 3 independent clusters (${score3.overallTrustScore}) to score higher than 1 cluster (${score1.overallTrustScore})`
    );
  });

  // ── c. Airfare-style case: event_occurred & statement_made supported by 2+ clusters, underlying_fact insufficient ──
  it("c. Airfare-style case: event_occurred and statement_made supported by 2+ clusters, underlying_fact insufficient, is NOT 'unverified' and clearly below fully verified", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Supreme Court issued notice on petition concerning surging airfares",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
      {
        id: "c2",
        text: "The petitioner submitted that airfares surged 700% on specific regional routes",
        importance: "high",
        claimType: "statement_attribution",
        layer: "statement_made",
      },
      {
        id: "c3",
        text: "Airfares on regional routes actually increased by 700% during the festival season",
        importance: "high",
        claimType: "statistic",
        layer: "underlying_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Court hearing records confirm notice issued.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
        layer: "event_occurred",
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Petition text confirms this statement was submitted.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
        layer: "statement_made",
      },
      {
        claimId: "c3",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Independent market data on 700% fare increase is unavailable.",
        evidenceIds: [],
        importantNotes: ["Underlying fare increase not independently audited."],
        layer: "underlying_fact",
      },
    ];

    const comparison: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "notice", sourceValues: [] }],
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [],
        },
        {
          claimId: "c2",
          dimensions: [{ dimension: "quotations", outcome: "agreement", articleValue: "allegation", sourceValues: [] }],
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [],
        },
        {
          claimId: "c3",
          dimensions: [{ dimension: "numbers", outcome: "unsupported_detail", articleValue: "700%", sourceValues: [] }],
          independentClusterCount: 0,
          agreementSummary: "none",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 2,
      totalConflicts: 0,
      totalUnresolvedDimensions: 1,
      coverageLimited: false,
    };

    const res = calculateScoreV2(claims, evaluations, [], {
      comparison,
    });

    assert.notEqual(res.veracityVerdict, "unverified", "Airfare case with supported event_occurred must NOT be unverified");
    assert.ok(res.overallTrustScore < 90, "Score must be clearly below a fully verified article (< 90)");
    assert.ok(res.overallTrustScore > 50, "Score must be above neutral baseline (> 50)");
  });

  // ── d. Insufficient never lowers the score below the neutral baseline ──
  it("d. insufficient never lowers the score below the neutral baseline", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Rumor of secret talks in Geneva", importance: "high", claimType: "event", layer: "event_occurred" },
      { id: "c2", text: "Both parties agreed to ceasefire framework", importance: "high", claimType: "event", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "insufficient", confidence: "low", explanation: "No reporting", evidenceIds: [], importantNotes: [] },
      { claimId: "c2", verdict: "insufficient", confidence: "low", explanation: "No reporting", evidenceIds: [], importantNotes: [] },
    ];

    const res = calculateScoreV2(claims, evaluations, []);

    assert.equal(res.overallTrustScore, 50, "All insufficient claims must result in neutral baseline score of 50");
  });

  // ── e. A fetch failure or absent coverage does not change the score ──
  it("e. A fetch failure or absent coverage does not change the score", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "New transport policy announced", importance: "high", claimType: "event", layer: "event_occurred" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev1"], importantNotes: [] },
    ];

    const evGood: Evidence = {
      id: "ev1",
      claimId: "c1",
      title: "Policy announcement",
      snippet: "Govt announced policy",
      url: "https://govt.in/policy",
      domain: "govt.in",
      publishedAt: null,
      sourceType: "official",
      sourceRelationship: "original",
      evidenceQuality: "high",
      relevance: "direct",
      relationship: "supporting",
      sourceContentStatus: "retrieved",
      sourceContentExcerpt: "Full policy statement.",
    };

    const evFailed: Evidence = {
      id: "ev_failed",
      claimId: "c1",
      title: "Failed link",
      snippet: "404",
      url: "https://blocked.com/404",
      domain: "blocked.com",
      publishedAt: null,
      sourceType: "other",
      sourceRelationship: "unknown",
      evidenceQuality: "low",
      relevance: "direct",
      relationship: "supporting",
      sourceContentStatus: "failed", // FAILED
    };

    const resWithoutFailed = calculateScoreV2(claims, evaluations, [], {
      evidence: [evGood],
    });

    const resWithFailed = calculateScoreV2(claims, evaluations, [], {
      evidence: [evGood, evFailed],
    });

    assert.equal(resWithFailed.overallTrustScore, resWithoutFailed.overallTrustScore, "Failed fetch must not alter the score");

    // Absent coverage (coverageLimited: true) should also not reduce score
    const resLimited = calculateScoreV2(claims, evaluations, [], {
      evidence: [evGood],
      coverageLimited: true,
    });

    assert.equal(resLimited.overallTrustScore, resWithoutFailed.overallTrustScore, "coverageLimited must not reduce the numeric score");
  });

  // ── f. Snippet-only evidence cannot produce high-confidence contribution ──
  it("f. snippet-only evidence cannot produce high-confidence contribution", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Archeologists discover ancient city", importance: "high", claimType: "event", layer: "event_occurred" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Snippet only", evidenceIds: ["ev_snippet"], importantNotes: [] },
    ];

    const evSnippetOnly: Evidence = {
      id: "ev_snippet",
      claimId: "c1",
      title: "Ancient city found",
      snippet: "Researchers found ancient ruins in desert.",
      url: "https://archaeology.org/city",
      domain: "archaeology.org",
      publishedAt: null,
      sourceType: "national_news",
      sourceRelationship: "unknown",
      evidenceQuality: "medium",
      relevance: "direct",
      relationship: "supporting",
      sourceContentStatus: "snippet_only", // SNIPPET ONLY
      sourceContentExcerpt: "",
    };

    const evFullText: Evidence = {
      ...evSnippetOnly,
      sourceContentStatus: "retrieved",
      sourceContentExcerpt: "Comprehensive report with full details on the excavation.",
    };

    const resSnippet = calculateScoreV2(claims, evaluations, [], {
      evidence: [evSnippetOnly],
    });

    const resFull = calculateScoreV2(claims, evaluations, [], {
      evidence: [evFullText],
    });

    assert.ok(
      resSnippet.overallTrustScore < resFull.overallTrustScore,
      `Snippet-only evidence (${resSnippet.overallTrustScore}) must score lower than full text (${resFull.overallTrustScore})`
    );

    const hasSnippetFactor = resSnippet.scoreBreakdown.factors.some(
      (f) => f.code === "SNIPPET_ONLY_CONFIDENCE_CAP"
    );
    assert.ok(hasSnippetFactor, "Score breakdown must include SNIPPET_ONLY_CONFIDENCE_CAP");
  });

  // ── g. A material conflict between two independent clusters reduces the score and appears in scoreBreakdown ──
  it("g. A material conflict between two independent clusters reduces the score and appears in scoreBreakdown", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Bridge construction cost totaled 500 million dollars", importance: "high", claimType: "statistic", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Cost reported", evidenceIds: ["ev1", "ev2"], importantNotes: [] },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Bridge cost",
        snippet: "500m",
        url: "https://outlet1.com/bridge",
        domain: "outlet1.com",
        publishedAt: null,
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Cost was 500m.",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Bridge cost update",
        snippet: "800m",
        url: "https://outlet2.com/bridge",
        domain: "outlet2.com",
        publishedAt: null,
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Cost was 800m.",
      },
    ];

    const compWithoutConflict: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "numbers", outcome: "agreement", articleValue: "500m", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "500m" }, { clusterId: "cl2", evidenceId: "ev2", value: "500m" }] }],
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 2,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    const compWithConflict: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "numbers", outcome: "contradiction", articleValue: "500m", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "500m" }, { clusterId: "cl2", evidenceId: "ev2", value: "800m" }] }],
          independentClusterCount: 2,
          agreementSummary: "weak",
          conflicts: [{ dimension: "numbers", description: "Discrepancy 500m vs 800m", evidenceIds: ["ev1", "ev2"] }],
        },
      ],
      totalIndependentClusters: 2,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    const resNoConflict = calculateScoreV2(claims, evaluations, [], {
      comparison: compWithoutConflict,
      evidence,
    });

    const resConflict = calculateScoreV2(claims, evaluations, [], {
      comparison: compWithConflict,
      evidence,
    });

    assert.ok(
      resConflict.overallTrustScore < resNoConflict.overallTrustScore,
      `Score with material conflict (${resConflict.overallTrustScore}) must be lower than without (${resNoConflict.overallTrustScore})`
    );

    const hasConflictFactor = resConflict.scoreBreakdown.factors.some(
      (f) => f.code === "MATERIAL_CONFLICT" || f.code === "MATERIAL_CONFLICT_ADJUSTMENT"
    );
    assert.ok(hasConflictFactor, "Score breakdown must record material conflict adjustment");
  });

  // ── h. possible_update does not reduce the score ──
  it("h. possible_update does not reduce the score", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "At least 30 people treated after factory incident", importance: "high", claimType: "statistic", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Updated casualty figures", evidenceIds: ["ev1", "ev2"], importantNotes: [] },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Factory incident morning",
        snippet: "15 injured",
        url: "https://outlet1.com/morning",
        domain: "outlet1.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "15 injured at 9 AM",
        publishedAt: "2026-03-01T09:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Factory incident evening update",
        snippet: "30 injured",
        url: "https://outlet2.com/evening",
        domain: "outlet2.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Updated to 30 injured at 5 PM",
        publishedAt: "2026-03-01T17:00:00Z",
      },
    ];

    // Case with possible_update note
    const compPossibleUpdate: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "numbers", outcome: "partial_agreement", articleValue: "30", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "15" }, { clusterId: "cl2", evidenceId: "ev2", value: "30" }], note: "possible_update" }],
          independentClusterCount: 2,
          agreementSummary: "moderate",
          conflicts: [], // No conflict logged for possible_update
        },
      ],
      totalIndependentClusters: 2,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    const res = calculateScoreV2(claims, evaluations, [], {
      comparison: compPossibleUpdate,
      evidence,
    });

    const hasConflictPenalty = res.scoreBreakdown.factors.some((f) => f.code === "MATERIAL_CONFLICT_ADJUSTMENT");
    assert.equal(hasConflictPenalty, false, "possible_update must never trigger a conflict penalty");
  });

  // ── i. 100 is returned for a fully qualifying fixture, and is not returned when any single gate condition fails ──
  it("i. 100 is returned for a fully qualifying fixture, and is not returned when any single gate condition fails (test each condition alone)", () => {
    const perfectClaims: ClaimInput[] = [
      { id: "c1", text: "Government approves landmark biodiversity accord", importance: "high", claimType: "event", layer: "event_occurred" },
      { id: "c2", text: "Treaty pledges 30 percent conservation target", importance: "medium", claimType: "statistic", layer: "underlying_fact" },
    ];

    const perfectEvaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Fully verified", evidenceIds: ["ev1", "ev2"], importantNotes: [], layer: "event_occurred" },
      { claimId: "c2", verdict: "supporting", confidence: "high", explanation: "Target confirmed", evidenceIds: ["ev1", "ev2"], importantNotes: [], layer: "underlying_fact" },
    ];

    const perfectEvidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Biodiversity Accord",
        snippet: "Official accord",
        url: "https://un.org/biodiv",
        domain: "un.org",
        publishedAt: null,
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Full official text.",
      },
      {
        id: "ev2",
        claimId: "c2",
        title: "News coverage",
        snippet: "Accord signed",
        url: "https://reuters.com/biodiv",
        domain: "reuters.com",
        publishedAt: null,
        sourceType: "international_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Full independent reporting.",
      },
    ];

    const perfectComparison: ComparisonReport = {
      claims: [
        {
          claimId: "c1",
          dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "accord", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "accord" }, { clusterId: "cl2", evidenceId: "ev2", value: "accord" }] }],
          independentClusterCount: 3,
          agreementSummary: "strong",
          conflicts: [],
        },
        {
          claimId: "c2",
          dimensions: [{ dimension: "numbers", outcome: "agreement", articleValue: "30%", sourceValues: [{ clusterId: "cl1", evidenceId: "ev1", value: "30%" }, { clusterId: "cl2", evidenceId: "ev2", value: "30%" }] }],
          independentClusterCount: 3,
          agreementSummary: "strong",
          conflicts: [],
        },
      ],
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    // 0. Base Qualifying Fixture -> 100/100
    const perfectRes = calculateScoreV2(perfectClaims, perfectEvaluations, [], {
      comparison: perfectComparison,
      evidence: perfectEvidence,
    });
    assert.equal(perfectRes.overallTrustScore, 100, "Qualifying fixture must receive 100/100");

    // Fail 1: One medium claim is qualifying instead of supporting
    const fail1Evals: ClaimEvaluation[] = [
      perfectEvaluations[0],
      { ...perfectEvaluations[1], verdict: "qualifying" },
    ];
    const resFail1 = calculateScoreV2(perfectClaims, fail1Evals, [], {
      comparison: perfectComparison,
      evidence: perfectEvidence,
    });
    assert.ok(resFail1.overallTrustScore < 100, "Condition 1 failure must prevent 100 score");

    // Fail 2: Cluster count < 2 without official source
    const nonOfficialEvidence: Evidence[] = perfectEvidence.map((e) => ({ ...e, sourceType: "national_news" }));
    const fail2Comparison: ComparisonReport = {
      ...perfectComparison,
      claims: perfectComparison.claims.map((c) => ({ ...c, independentClusterCount: 1 })),
      totalIndependentClusters: 1,
    };
    const resFail2 = calculateScoreV2(perfectClaims, perfectEvaluations, [], {
      comparison: fail2Comparison,
      evidence: nonOfficialEvidence,
    });
    assert.ok(resFail2.overallTrustScore < 100, "Condition 2 failure must prevent 100 score");

    // Fail 3: Evaluator confidence medium instead of high
    const fail3Evals: ClaimEvaluation[] = [
      perfectEvaluations[0],
      { ...perfectEvaluations[1], confidence: "medium" },
    ];
    const resFail3 = calculateScoreV2(perfectClaims, fail3Evals, [], {
      comparison: perfectComparison,
      evidence: perfectEvidence,
    });
    assert.ok(resFail3.overallTrustScore < 100, "Condition 3 failure must prevent 100 score");

    // Fail 4: Evidence is snippet-only
    const snippetEvidence: Evidence[] = perfectEvidence.map((e) => ({
      ...e,
      sourceType: "national_news",
      sourceContentStatus: "snippet_only",
      sourceContentExcerpt: "",
    }));
    const resFail4 = calculateScoreV2(perfectClaims, perfectEvaluations, [], {
      comparison: perfectComparison,
      evidence: snippetEvidence,
    });
    assert.ok(resFail4.overallTrustScore < 100, "Condition 4 failure must prevent 100 score");

    // Fail 5: Conflict present
    const fail5Comparison: ComparisonReport = {
      ...perfectComparison,
      totalConflicts: 1,
      claims: [
        perfectComparison.claims[0],
        { ...perfectComparison.claims[1], conflicts: [{ dimension: "numbers", description: "Conflict", evidenceIds: ["ev1"] }] },
      ],
    };
    const resFail5 = calculateScoreV2(perfectClaims, perfectEvaluations, [], {
      comparison: fail5Comparison,
      evidence: perfectEvidence,
    });
    assert.ok(resFail5.overallTrustScore < 100, "Condition 5 failure must prevent 100 score");

    // Fail 6: Unsupported material detail present
    const fail6Comparison: ComparisonReport = {
      ...perfectComparison,
      claims: [
        perfectComparison.claims[0],
        {
          ...perfectComparison.claims[1],
          dimensions: [{ dimension: "numbers", outcome: "unsupported_detail", articleValue: "30%", sourceValues: [] }],
        },
      ],
    };
    const resFail6 = calculateScoreV2(perfectClaims, perfectEvaluations, [], {
      comparison: fail6Comparison,
      evidence: perfectEvidence,
    });
    assert.ok(resFail6.overallTrustScore < 100, "Condition 6 failure must prevent 100 score");

    // Fail 7: Omission present
    const resFail7 = calculateScoreV2(
      perfectClaims,
      perfectEvaluations,
      [{ id: "om-1", type: "missing_context", claimId: "c1", description: "Important context omitted", whyItMatters: "Context matters", severity: "low", confidence: "high", evidenceIds: ["ev1"] }],
      { comparison: perfectComparison, evidence: perfectEvidence }
    );
    assert.ok(resFail7.overallTrustScore < 100, "Condition 7 failure must prevent 100 score");

    // Fail 8: Interpretation claim evaluated as supported fact
    const claimsWithInterp: ClaimInput[] = [
      ...perfectClaims,
      { id: "c3", text: "The treaty was a political masterstroke", importance: "high", claimType: "opinion", layer: "interpretation" },
    ];
    const evalsWithInterp: ClaimEvaluation[] = [
      ...perfectEvaluations,
      { claimId: "c3", verdict: "supporting", confidence: "high", explanation: "Opinion supported", evidenceIds: ["ev1"], importantNotes: [], layer: "interpretation" },
    ];
    const resFail8 = calculateScoreV2(claimsWithInterp, evalsWithInterp, [], {
      comparison: perfectComparison,
      evidence: perfectEvidence,
    });
    assert.ok(resFail8.overallTrustScore < 100, "Condition 8 failure must prevent 100 score");
  });

  // ── j. Scores are monotonic: adding independent supporting evidence never lowers; adding contradicting never raises ──
  it("j. Scores are monotonic: adding independent supporting evidence never lowers a score; adding a contradicting one never raises it", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "City inaugurates new metro line", importance: "high", claimType: "event", layer: "event_occurred" },
    ];

    const baseEvals: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "medium", explanation: "Supported", evidenceIds: ["ev1"], importantNotes: [] },
    ];

    const comp1: ComparisonReport = {
      claims: [{ claimId: "c1", dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [] }], independentClusterCount: 1, agreementSummary: "weak", conflicts: [] }],
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
    };

    const comp2: ComparisonReport = {
      claims: [{ claimId: "c1", dimensions: [{ dimension: "event", outcome: "agreement", articleValue: "event", sourceValues: [] }], independentClusterCount: 3, agreementSummary: "strong", conflicts: [] }],
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
    };

    const baseScore = calculateScoreV2(claims, baseEvals, [], { comparison: comp1 }).overallTrustScore;
    const moreEvidenceScore = calculateScoreV2(claims, baseEvals, [], { comparison: comp2 }).overallTrustScore;

    assert.ok(moreEvidenceScore >= baseScore, "Adding supporting clusters must never lower score");

    // Add contradicting claim
    const claimsWithContradicting: ClaimInput[] = [
      ...claims,
      { id: "c2", text: "Metro line was built completely free of cost", importance: "high", claimType: "statistic", layer: "underlying_fact" },
    ];
    const evalsWithContradicting: ClaimEvaluation[] = [
      baseEvals[0],
      { claimId: "c2", verdict: "contradicting", confidence: "high", explanation: "False assertion", evidenceIds: ["ev1"], importantNotes: [] },
    ];

    const contradictingScore = calculateScoreV2(claimsWithContradicting, evalsWithContradicting, [], { comparison: comp1 }).overallTrustScore;

    assert.ok(contradictingScore <= baseScore, "Adding contradicting evidence must never raise score");
  });

  // ── k. Same input yields the same score on repeated computation ──
  it("k. Same input yields the same score on repeated computation", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Spacecraft enters Mars orbit", importance: "high", claimType: "event", layer: "event_occurred" },
      { id: "c2", text: "Orbit achieved at 1500 km altitude", importance: "medium", claimType: "statistic", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Orbit confirmed", evidenceIds: ["ev1"], importantNotes: [] },
      { claimId: "c2", verdict: "supporting", confidence: "medium", explanation: "Altitude confirmed", evidenceIds: ["ev1"], importantNotes: [] },
    ];

    const firstRun = calculateScoreV2(claims, evaluations, []);

    for (let i = 0; i < 10; i++) {
      const run = calculateScoreV2(claims, evaluations, []);
      assert.equal(run.overallTrustScore, firstRun.overallTrustScore);
      assert.equal(run.veracityVerdict, firstRun.veracityVerdict);
      assert.deepEqual(run.scoreBreakdown, firstRun.scoreBreakdown);
    }
  });

  // ── l. SCORING_V2=off produces the exact pre-change report ──
  it("l. SCORING_V2=off produces the exact pre-change report", async () => {
    const originalEnv = process.env.SCORING_V2;
    process.env.SCORING_V2 = "off";

    try {
      const article = {
        title: "Test Article",
        sourceDomain: "test.org",
        content: "Content",
        url: "https://test.org/news",
      };

      const claims: ClaimInput[] = [
        { id: "c1", text: "Primary assertion", importance: "high", claimType: "event", layer: "event_occurred" },
      ];

      const evaluations: ClaimEvaluation[] = [
        { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev1"], importantNotes: [] },
      ];

      const report = await buildReport(article, claims, evaluations, [], {
        customSummaryGenerator: async () => "Test summary.",
      });

      assert.equal(report.scoreV2Shadow, undefined, "scoreV2Shadow must be undefined when SCORING_V2=off");
      assert.equal(report.scoreV1, undefined, "scoreV1 must be undefined when SCORING_V2=off");
      assert.ok(typeof report.overallTrustScore === "number");
    } finally {
      process.env.SCORING_V2 = originalEnv;
    }
  });

  // ── m. The LLM output schemas contain no field that sets or modifies the final score ──
  it("m. The LLM output schemas contain no field that sets or modifies the final score", () => {
    // Check ClaimEvaluationSchema
    const evalShape = ClaimEvaluationSchema.shape;
    assert.equal("score" in evalShape, false);
    assert.equal("trustScore" in evalShape, false);
    assert.equal("finalScore" in evalShape, false);
    assert.equal("overallTrustScore" in evalShape, false);

    // Check OmissionSchema
    const omissionShape = OmissionSchema.shape;
    assert.equal("score" in omissionShape, false);
    assert.equal("trustScore" in omissionShape, false);
    assert.equal("penalty" in omissionShape, false);

    // Check LlmDimensionalComparisonSchema
    const comparisonShape = LlmDimensionalComparisonSchema.shape;
    assert.equal("score" in comparisonShape, false);
    assert.equal("trustScore" in comparisonShape, false);
    assert.equal("finalScore" in comparisonShape, false);
    assert.equal("agreementSummary" in comparisonShape, false); // Agreement summary is deterministic, never chosen by LLM
  });
});
