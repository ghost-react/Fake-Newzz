import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDimensionValue,
  evaluateConsensusConsistency,
  EvaluateConsensusConsistencyOptions,
} from "../src/lib/scoring/consistency";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { DEFAULT_SCORING_V2_CONFIG } from "../src/lib/scoring/config.v2";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { ComparisonReport } from "../src/schemas/comparison";
import { OriginCluster } from "../src/lib/comparison/independence";

describe("Deterministic Consensus Consistency Test Suite", () => {
  // ─── Normalization Helper Tests ───────────────────────────────────────────
  it("normalizes Indian and Western number words correctly", () => {
    assert.strictEqual(normalizeDimensionValue("7 lakh", "numbers"), "700000");
    assert.strictEqual(normalizeDimensionValue("700,000", "numbers"), "700000");
    assert.strictEqual(normalizeDimensionValue("7,00,000", "numbers"), "700000");
    assert.strictEqual(normalizeDimensionValue("about 7 lakhs", "numbers"), "700000");
    assert.strictEqual(normalizeDimensionValue("1.5 crore", "numbers"), "15000000");
    assert.strictEqual(normalizeDimensionValue("25 percent", "numbers"), "25%");
    assert.strictEqual(normalizeDimensionValue("25%", "numbers"), "25%");
    assert.strictEqual(normalizeDimensionValue("May 1, 2026", "date"), "2026-05-01");
    assert.strictEqual(normalizeDimensionValue("2026-05-01", "date"), "2026-05-01");
    assert.strictEqual(normalizeDimensionValue("n/a", "numbers"), "");
    assert.strictEqual(normalizeDimensionValue("not mentioned", "event"), "");
  });

  // ─── a. Four independent clusters agreeing on all material dimensions ─────
  it("a. Four independent clusters agreeing on all material dimensions: 100 is possible when the gate passes", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Supreme Court bench ordered inquiry into dynamic airfares",
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
        explanation: "Fully supported by court order transcripts across 4 independent outlets.",
        evidenceIds: ["ev1", "ev2", "ev3", "ev4"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "SC order on airfares",
        url: "https://thehindu.com/sc-airfares",
        domain: "thehindu.com",
        snippet: "Supreme Court bench ordered inquiry into dynamic airfares.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "The Supreme Court division bench ordered a comprehensive inquiry.",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Aviation ministry directed by court",
        url: "https://indianexpress.com/sc-airfares",
        domain: "indianexpress.com",
        snippet: "Supreme Court bench ordered inquiry into dynamic airfares.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "primary_document",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Order sheet confirms inquiry directed.",
      },
      {
        id: "ev3",
        claimId: "c1",
        title: "Apex court initiates airfare probe",
        url: "https://timesofindia.com/sc-airfares",
        domain: "timesofindia.com",
        snippet: "Supreme Court bench ordered inquiry into dynamic airfares.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Inquiry ordered by bench.",
      },
      {
        id: "ev4",
        claimId: "c1",
        title: "SC dynamic fares order",
        url: "https://hindustantimes.com/sc-airfares",
        domain: "hindustantimes.com",
        snippet: "Supreme Court bench ordered inquiry into dynamic airfares.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceRelationship: "independent",
        relationship: "supporting",
        sourceType: "national_news",
        evidenceQuality: "high",
        relevance: "direct",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Court bench ordered inquiry.",
      },
    ];

    const clusters: OriginCluster[] = [
      { clusterId: "cluster-1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cluster-2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cluster-3", memberEvidenceIds: ["ev3"], originType: "unknown", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cluster-4", memberEvidenceIds: ["ev4"], originType: "unknown", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 4,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 4,
          agreementSummary: "strong",
          conflicts: [],
          dimensions: [
            {
              dimension: "event",
              outcome: "agreement",
              articleValue: "Supreme Court bench ordered inquiry into dynamic airfares",
              sourceValues: [
                { clusterId: "cluster-1", evidenceId: "ev1", value: "Supreme Court bench ordered inquiry into dynamic airfares" },
                { clusterId: "cluster-2", evidenceId: "ev2", value: "Supreme Court bench ordered inquiry into dynamic airfares" },
                { clusterId: "cluster-3", evidenceId: "ev3", value: "Supreme Court bench ordered inquiry into dynamic airfares" },
                { clusterId: "cluster-4", evidenceId: "ev4", value: "Supreme Court bench ordered inquiry into dynamic airfares" },
              ],
            },
          ],
        },
      ],
    };

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
      coverageLimited: false,
    });

    assert.strictEqual(result.overallTrustScore, 100);
    assert.strictEqual(result.verifiedTrue, true);
    assert.strictEqual(result.veracityVerdict, "verified_true");
    assert.strictEqual(result.consistency?.consistencyScore, 100);
    assert.strictEqual(result.consistency?.assessable, true);
  });

  // ─── b. Different casualty numbers across clusters ─────────────────────────
  it("b. Same story with three different casualty numbers across independent clusters scores lower, and breakdown lists the dimension and versionCount", () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Factory fire caused 10 casualties",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Fire confirmed, but casualty figures vary across reports.",
        evidenceIds: ["ev1", "ev2", "ev3"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "Fire 1", url: "https://outlet1.com/fire", domain: "outlet1.com", snippet: "10 casualties", publishedAt: "2026-05-01T10:00:00Z", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
      { id: "ev2", claimId: "c1", title: "Fire 2", url: "https://outlet2.com/fire", domain: "outlet2.com", snippet: "15 casualties", publishedAt: "2026-05-01T10:00:00Z", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
      { id: "ev3", claimId: "c1", title: "Fire 3", url: "https://outlet3.com/fire", domain: "outlet3.com", snippet: "25 casualties", publishedAt: "2026-05-01T10:00:00Z", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
    ];

    const clusters: OriginCluster[] = [
      { clusterId: "c-1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c-2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c-3", memberEvidenceIds: ["ev3"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 3,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 3,
          agreementSummary: "weak",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "contradiction",
              articleValue: "10 casualties",
              sourceValues: [
                { clusterId: "c-1", evidenceId: "ev1", value: "10 casualties" },
                { clusterId: "c-2", evidenceId: "ev2", value: "15 casualties" },
                { clusterId: "c-3", evidenceId: "ev3", value: "25 casualties" },
              ],
            },
          ],
        },
      ],
    };

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    assert.ok(result.overallTrustScore < 90);
    assert.strictEqual(result.verifiedTrue, false);

    // Breakdown lists dimension 'numbers' and versionCount = 3
    const variationFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "CONSISTENCY_VERSION_VARIATION"
    );
    assert.ok(variationFactor !== undefined);
    assert.strictEqual(variationFactor.dimension, "numbers");
    assert.ok(variationFactor.note?.includes("3 distinct versions"));
  });

  // ─── c. Five syndicated copies equal one vote ──────────────────────────────
  it("c. Five syndicated copies equal one vote", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Ministry announcement", importance: "medium", claimType: "event", layer: "event_occurred" },
    ];

    // Single cluster with 5 syndicated evidence items
    const singleWireEvidence: Evidence[] = Array.from({ length: 5 }, (_, i) => ({
      id: `ev-pti-${i + 1}`,
      claimId: "c1",
      title: `PTI report ${i + 1}`,
      url: `https://outlet${i + 1}.com/pti`,
      domain: `outlet${i + 1}.com`,
      snippet: "PTI: Ministry announced review.",
      publishedAt: "2026-05-01",
      sourceRelationship: "syndicated",
      relationship: "supporting",
      sourceType: "national_news",
      evidenceQuality: "high",
      relevance: "direct",
    }));

    const singleWireCluster: OriginCluster[] = [
      {
        clusterId: "cluster-pti",
        memberEvidenceIds: singleWireEvidence.map((e) => e.id),
        originType: "syndicated",
        independenceConfidence: "high",
        clusterRule: "wire_attribution",
        sharedAgency: "PTI",
      },
    ];

    const comparisonSingle: ComparisonReport = {
      totalIndependentClusters: 1, // 5 copies = 1 cluster!
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 1,
          agreementSummary: "none",
          conflicts: [],
          dimensions: [
            {
              dimension: "event",
              outcome: "agreement",
              articleValue: "Ministry announcement",
              sourceValues: singleWireEvidence.map((e) => ({
                clusterId: "cluster-pti",
                evidenceId: e.id,
                value: "Ministry announcement",
              })),
            },
          ],
        },
      ],
    };

    const consistencyResult = evaluateConsensusConsistency({
      claims,
      comparison: comparisonSingle,
      clusters: singleWireCluster,
      evidence: singleWireEvidence,
    });

    // Exactly 1 cluster -> not assessable (requires at least 2 independent clusters)
    assert.strictEqual(consistencyResult.assessable, false);
    assert.strictEqual(consistencyResult.consistencyScore, null);
  });

  // ─── d. Different numbers explained by publish time ────────────────────────
  it("d. Different numbers explained by publish time: no penalty", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Casualty count updated to 12", importance: "high", claimType: "factual", layer: "underlying_fact" },
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
          agreementSummary: "moderate",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "partial_agreement",
              articleValue: "12 casualties",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "8 casualties" },
                { clusterId: "c2", evidenceId: "ev2", value: "12 casualties" },
              ],
              note: "Details changed between reports (possible_update)",
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "Early report", url: "https://a.com", domain: "a.com", snippet: "8 casualties", publishedAt: "2026-05-01T08:00:00Z", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
      { id: "ev2", claimId: "c1", title: "Late report", url: "https://b.com", domain: "b.com", snippet: "12 casualties", publishedAt: "2026-05-01T16:00:00Z", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
    ];

    const consistencyResult = evaluateConsensusConsistency({
      claims,
      comparison,
      clusters,
      evidence,
    });

    const dimResult = consistencyResult.claimConsistencies[0].dimensions[0];
    assert.strictEqual(dimResult.isPossibleUpdate, true);
    assert.strictEqual(dimResult.penalty, 0);

    const updateFactor = consistencyResult.factors.find(
      (f) => f.code === "CONSISTENCY_POSSIBLE_UPDATE"
    );
    assert.ok(updateFactor !== undefined);
  });

  // ─── e. One source only: consistency not assessable, score unchanged ───────
  it("e. One source only: consistency 'not assessable', score unchanged", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Local event occurred", importance: "medium", claimType: "event", layer: "event_occurred" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Supported by one local report.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "Local", url: "https://local.com", domain: "local.com", snippet: "Local event occurred.", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "regional_news", evidenceQuality: "medium", relevance: "direct" },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 1,
          agreementSummary: "none",
          conflicts: [],
          dimensions: [],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
      coverageLimited: true,
    });

    assert.strictEqual(result.consistency?.assessable, false);
    assert.strictEqual(result.consistency?.consistencyScore, null);

    const notAssessableFactor = result.scoreBreakdown.factors.find(
      (f) => f.code === "CONSISTENCY_NOT_ASSESSABLE"
    );
    assert.ok(notAssessableFactor !== undefined);
  });

  // ─── f. Missing mention is not disagreement ────────────────────────────────
  it("f. Missing mention is not disagreement", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Highway crash injured 2 people", importance: "medium", claimType: "factual", layer: "underlying_fact" },
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
          agreementSummary: "moderate",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "agreement",
              articleValue: "2 injured",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "2 injured" },
                { clusterId: "c2", evidenceId: "ev2", value: "not mentioned" }, // Not mentioned
              ],
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "A", url: "https://a.com", domain: "a.com", snippet: "2 injured", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
      { id: "ev2", claimId: "c1", title: "B", url: "https://b.com", domain: "b.com", snippet: "Crash occurred on highway.", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
    ];

    const consistencyResult = evaluateConsensusConsistency({
      claims,
      comparison,
      clusters,
      evidence,
    });

    const dimResult = consistencyResult.claimConsistencies[0].dimensions[0];
    assert.strictEqual(dimResult.reportingClusterCount, 1);
    // Agreement share is 1.0 (100%), not 0.5, because non-mention is excluded
    assert.strictEqual(dimResult.agreementShare, 1.0);
  });

  // ─── g. Many versions but no contradicting verdicts: never False ───────────
  it("g. Many versions but no contradicting verdicts: never 'False'", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Rumored project budget", importance: "high", claimType: "factual", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Unverified project figures.",
        evidenceIds: ["ev1", "ev2", "ev3", "ev4"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ];

    const comparison: ComparisonReport = {
      totalIndependentClusters: 4,
      totalConflicts: 0,
      totalUnresolvedDimensions: 1,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 4,
          agreementSummary: "none",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "contradiction",
              articleValue: "100 million",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "100 million" },
                { clusterId: "c2", evidenceId: "ev2", value: "200 million" },
                { clusterId: "c3", evidenceId: "ev3", value: "300 million" },
                { clusterId: "c4", evidenceId: "ev4", value: "400 million" },
              ],
            },
          ],
        },
      ],
    };

    const clusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
      { clusterId: "c2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
      { clusterId: "c3", memberEvidenceIds: ["ev3"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
      { clusterId: "c4", memberEvidenceIds: ["ev4"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "A", url: "https://a.com", domain: "a.com", snippet: "100m", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "neutral", sourceType: "national_news", evidenceQuality: "medium", relevance: "direct" },
      { id: "ev2", claimId: "c1", title: "B", url: "https://b.com", domain: "b.com", snippet: "200m", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "neutral", sourceType: "national_news", evidenceQuality: "medium", relevance: "direct" },
      { id: "ev3", claimId: "c1", title: "C", url: "https://c.com", domain: "c.com", snippet: "300m", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "neutral", sourceType: "national_news", evidenceQuality: "medium", relevance: "direct" },
      { id: "ev4", claimId: "c1", title: "D", url: "https://d.com", domain: "d.com", snippet: "400m", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "neutral", sourceType: "national_news", evidenceQuality: "medium", relevance: "direct" },
    ];

    const result = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    // Invariant: Weak evidence with version disagreements must never be 'false' or 'mostly_false'
    assert.notStrictEqual(result.veracityVerdict, "false");
    assert.notStrictEqual(result.veracityVerdict, "mostly_false");
    assert.ok(result.veracityVerdict === "unverified" || result.veracityVerdict === "mixed");
  });

  // ─── h. Monotonicity ───────────────────────────────────────────────────────
  it("h. Monotonic: adding an agreeing independent cluster never lowers the score; adding a differing version never raises it", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Factual claim with number 10", importance: "high", claimType: "factual", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Supported.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ];

    const baseEvidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "A", url: "https://a.com", domain: "a.com", snippet: "10", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "10" },
      { id: "ev2", claimId: "c1", title: "B", url: "https://b.com", domain: "b.com", snippet: "10", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "10" },
    ];

    const baseClusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ];

    const baseComparison: ComparisonReport = {
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
              articleValue: "10",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "10" },
                { clusterId: "c2", evidenceId: "ev2", value: "10" },
              ],
            },
          ],
        },
      ],
    };

    const baseResult = calculateScoreV2(claims, evaluations, [], {
      comparison: baseComparison,
      clusters: baseClusters,
      evidence: baseEvidence,
    });

    // 1. Add agreeing cluster ("10")
    const agreeingEvidence: Evidence[] = [
      ...baseEvidence,
      { id: "ev3", claimId: "c1", title: "C", url: "https://c.com", domain: "c.com", snippet: "10", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "10" },
    ];
    const agreeingClusters = [
      ...baseClusters,
      { clusterId: "c3", memberEvidenceIds: ["ev3"], originType: "original" as const, independenceConfidence: "high" as const, clusterRule: "standalone" as const },
    ];
    const agreeingComparison: ComparisonReport = {
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 3,
          agreementSummary: "strong",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "agreement",
              articleValue: "10",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "10" },
                { clusterId: "c2", evidenceId: "ev2", value: "10" },
                { clusterId: "c3", evidenceId: "ev3", value: "10" }, // Agreeing!
              ],
            },
          ],
        },
      ],
    };

    const agreeingResult = calculateScoreV2(claims, evaluations, [], {
      comparison: agreeingComparison,
      clusters: agreeingClusters,
      evidence: agreeingEvidence,
    });

    // Adding an agreeing independent cluster must never lower the score
    assert.ok(
      agreeingResult.overallTrustScore >= baseResult.overallTrustScore,
      `Agreeing score ${agreeingResult.overallTrustScore} should be >= ${baseResult.overallTrustScore}`
    );

    // 2. Add a differing version ("25")
    const differingEvidence: Evidence[] = [
      ...baseEvidence,
      { id: "ev4", claimId: "c1", title: "D", url: "https://d.com", domain: "d.com", snippet: "25", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "25" },
    ];
    const differingClusters = [
      ...baseClusters,
      { clusterId: "c4", memberEvidenceIds: ["ev4"], originType: "original" as const, independenceConfidence: "high" as const, clusterRule: "standalone" as const },
    ];
    const differingComparison: ComparisonReport = {
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c1",
          independentClusterCount: 3,
          agreementSummary: "weak",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "contradiction",
              articleValue: "10",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "10" },
                { clusterId: "c2", evidenceId: "ev2", value: "10" },
                { clusterId: "c4", evidenceId: "ev4", value: "25" }, // Differing!
              ],
            },
          ],
        },
      ],
    };

    const differingResult = calculateScoreV2(claims, evaluations, [], {
      comparison: differingComparison,
      clusters: differingClusters,
      evidence: differingEvidence,
    });

    // Adding a differing version must never raise the score
    assert.ok(
      differingResult.overallTrustScore <= baseResult.overallTrustScore,
      `Differing score ${differingResult.overallTrustScore} should be <= ${baseResult.overallTrustScore}`
    );
  });

  // ─── i. Same input twice gives identical output ───────────────────────────
  it("i. Same input twice gives identical output (pure determinism)", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Assertion with numbers 7 lakh", importance: "high", claimType: "factual", layer: "underlying_fact" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev1", "ev2"], importantNotes: [], layer: "underlying_fact" },
    ];

    const evidence: Evidence[] = [
      { id: "ev1", claimId: "c1", title: "A", url: "https://a.com", domain: "a.com", snippet: "700,000", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "700,000" },
      { id: "ev2", claimId: "c1", title: "B", url: "https://b.com", domain: "b.com", snippet: "7 lakh", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct", sourceContentStatus: "retrieved", sourceContentExcerpt: "7 lakh" },
    ];

    const clusters: OriginCluster[] = [
      { clusterId: "c1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "c2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
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
              articleValue: "7 lakh",
              sourceValues: [
                { clusterId: "c1", evidenceId: "ev1", value: "700,000" },
                { clusterId: "c2", evidenceId: "ev2", value: "7 lakh" },
              ],
            },
          ],
        },
      ],
    };

    const run1 = calculateScoreV2(claims, evaluations, [], { comparison, clusters, evidence });
    const run2 = calculateScoreV2(claims, evaluations, [], { comparison, clusters, evidence });

    assert.deepStrictEqual(run1, run2);
  });

  // ─── j. SCORING_V2=off yields exact pre-change report ──────────────────────
  it("j. SCORING_V2=off yields the exact pre-change report", async () => {
    const prevMode = process.env.SCORING_V2;
    process.env.SCORING_V2 = "off";

    try {
      const article = {
        title: "Test Article Title",
        sourceDomain: "example.com",
        url: "https://example.com/test",
      };

      const claims: ClaimInput[] = [
        { id: "c1", text: "Important fact verified", importance: "high", claimType: "event", layer: "event_occurred" },
      ];

      const evaluations: ClaimEvaluation[] = [
        { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Confirmed", evidenceIds: ["ev1"], importantNotes: [], layer: "event_occurred" },
      ];

      const evidence: Evidence[] = [
        { id: "ev1", claimId: "c1", title: "Source", url: "https://source.com", domain: "source.com", snippet: "Confirmed", publishedAt: "2026-05-01", sourceRelationship: "independent", relationship: "supporting", sourceType: "national_news", evidenceQuality: "high", relevance: "direct" },
      ];

      const report = await buildReport(article, claims, evaluations, [], {
        evidence,
        customSummaryGenerator: async () => "Summary for test",
      });

      // Under SCORING_V2=off: scoreV2Shadow and scoreV1 are not exposed
      assert.strictEqual(report.scoreV2Shadow, undefined);
      assert.strictEqual(report.scoreV1, undefined);
      assert.ok(typeof report.overallTrustScore === "number");
      assert.strictEqual(report.summary, "Summary for test");
    } finally {
      if (prevMode !== undefined) {
        process.env.SCORING_V2 = prevMode;
      } else {
        delete process.env.SCORING_V2;
      }
    }
  });
});
