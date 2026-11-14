import fs from "node:fs";
import path from "node:path";
import { VERIFICATION_BENCHMARK_FIXTURES } from "../tests/fixtures/verification/benchmark";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { DEFAULT_SCORING_V2_CONFIG } from "../src/lib/scoring/config.v2";
import { OriginCluster, clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import { ComparisonReport } from "../src/schemas/comparison";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";

// Force shadow mode for measurement
process.env.SCORING_V2 = "shadow";

interface CaseMeasurement {
  id: string;
  category: string;
  description: string;
  scoreBeforeConsistency: number;
  scoreAfterConsistency: number;
  delta: number;
  consistencyScore: number;
  tier: string;
  multiplier: number;
  assessable: boolean;
  versionCounts: Record<string, number>;
  dimensionsWithVariation: string[];
  reasons: string[];
}

// Additional specialized benchmark cases representing variations in reporting
const ADDITIONAL_BENCHMARK_CASES: Array<{
  id: string;
  category: string;
  description: string;
  claims: ClaimInput[];
  evidence: Evidence[];
  evaluations: ClaimEvaluation[];
  omissions: Omission[];
  comparison?: ComparisonReport;
  clusters?: OriginCluster[];
}> = [
  // 1. Supreme Court Airfare Petition: different percentage surges reported (700% vs 500% vs 300%)
  {
    id: "sc_airfare_surge_percentage_dispute",
    category: "conflicting_reports",
    description: "Supreme Court airfare surge petition where outlets cite 700%, 500%, and 300% surge",
    claims: [
      {
        id: "c-af-1",
        text: "Petitioner claims airline ticket prices surged by 700% during festival week",
        importance: "high",
        claimType: "numeric",
        layer: "underlying_fact",
      },
    ],
    evaluations: [
      {
        claimId: "c-af-1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Surge reported but figures diverge widely.",
        evidenceIds: ["ev-af-1", "ev-af-2", "ev-af-3"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ],
    evidence: [
      {
        id: "ev-af-1",
        claimId: "c-af-1",
        title: "Plea in SC highlights 700% airfare surge",
        url: "https://barandbench.com/sc-airfare",
        domain: "barandbench.com",
        snippet: "Petitioner argued festival fares jumped 700% on key routes.",
        publishedAt: "2026-05-01T10:00:00Z",
        sourceType: "legal_database",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-af-2",
        claimId: "c-af-1",
        title: "Aviation ministry submits 500% surge data",
        url: "https://thehindu.com/sc-airfare",
        domain: "thehindu.com",
        snippet: "Official ministry submission showed fares rose 500% over base price.",
        publishedAt: "2026-05-01T11:00:00Z",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-af-3",
        claimId: "c-af-1",
        title: "Airlines council claims max hike was 300%",
        url: "https://economictimes.com/airlines-fare",
        domain: "economictimes.com",
        snippet: "Airlines representative stated average festive increase was 300%.",
        publishedAt: "2026-05-01T12:00:00Z",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "medium",
        relevance: "direct",
      },
    ],
    omissions: [],
    clusters: [
      { clusterId: "cl-af-1", memberEvidenceIds: ["ev-af-1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-af-2", memberEvidenceIds: ["ev-af-2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-af-3", memberEvidenceIds: ["ev-af-3"], originType: "original", independenceConfidence: "medium", clusterRule: "standalone" },
    ],
    comparison: {
      totalIndependentClusters: 3,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c-af-1",
          independentClusterCount: 3,
          agreementSummary: "weak",
          conflicts: [{ dimension: "numbers", clusterIds: ["cl-af-1", "cl-af-2", "cl-af-3"], explanation: "Dispute over 700% vs 500% vs 300%" }],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "contradiction",
              articleValue: "700%",
              sourceValues: [
                { clusterId: "cl-af-1", evidenceId: "ev-af-1", value: "700%" },
                { clusterId: "cl-af-2", evidenceId: "ev-af-2", value: "500%" },
                { clusterId: "cl-af-3", evidenceId: "ev-af-3", value: "300%" },
              ],
            },
          ],
        },
      ],
    },
  },

  // 2. Bengaluru Family Incident: differing casualty numbers (4 vs 5 dead)
  {
    id: "bengaluru_family_casualty_discrepancy",
    category: "breaking_news",
    description: "Bengaluru family suicide pact where early reports stated 4 dead and later confirmed 5 dead",
    claims: [
      {
        id: "c-ben-1",
        text: "Five members of a techie's family found dead in Bengaluru apartment",
        importance: "high",
        claimType: "numeric",
        layer: "underlying_fact",
      },
    ],
    evaluations: [
      {
        claimId: "c-ben-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Later official reports confirmed 5 deceased.",
        evidenceIds: ["ev-ben-1", "ev-ben-2", "ev-ben-3"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ],
    evidence: [
      {
        id: "ev-ben-1",
        claimId: "c-ben-1",
        title: "Four found dead in Bengaluru flat",
        url: "https://deccanherald.com/ben-deaths-early",
        domain: "deccanherald.com",
        snippet: "Police discovered four bodies in the flat early morning.",
        publishedAt: "2026-05-02T08:00:00Z",
        sourceType: "regional_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-ben-2",
        claimId: "c-ben-1",
        title: "Death toll rises to 5 in techie family suicide",
        url: "https://ndtv.com/ben-deaths-update",
        domain: "ndtv.com",
        snippet: "Police confirmed five persons, including child, succumbed.",
        publishedAt: "2026-05-02T13:00:00Z",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-ben-3",
        claimId: "c-ben-1",
        title: "Commissioner confirms 5 bodies recovered",
        url: "https://timesofindia.com/ben-commissioner",
        domain: "timesofindia.com",
        snippet: "City commissioner confirmed 5 bodies were recovered.",
        publishedAt: "2026-05-02T15:00:00Z",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ],
    omissions: [],
    clusters: [
      { clusterId: "cl-ben-1", memberEvidenceIds: ["ev-ben-1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-ben-2", memberEvidenceIds: ["ev-ben-2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-ben-3", memberEvidenceIds: ["ev-ben-3"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ],
    comparison: {
      totalIndependentClusters: 3,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c-ben-1",
          independentClusterCount: 3,
          agreementSummary: "moderate",
          conflicts: [],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "partial_agreement",
              articleValue: "5",
              sourceValues: [
                { clusterId: "cl-ben-1", evidenceId: "ev-ben-1", value: "4" },
                { clusterId: "cl-ben-2", evidenceId: "ev-ben-2", value: "5" },
                { clusterId: "cl-ben-3", evidenceId: "ev-ben-3", value: "5" },
              ],
            },
          ],
        },
      ],
    },
  },

  // 3. Syndicated Wire Story (5 outlets syndicating PTI, only 1 independent origin)
  {
    id: "syndicated_wire_single_cluster",
    category: "syndicated",
    description: "Announcement carried identically across 5 news websites tracing to single PTI wire",
    claims: [
      {
        id: "c-syn-1",
        text: "Government notifies new environmental standards for thermal power plants",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
    ],
    evaluations: [
      {
        claimId: "c-syn-1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Syndicated wire reports.",
        evidenceIds: ["ev-syn-1", "ev-syn-2", "ev-syn-3", "ev-syn-4", "ev-syn-5"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ],
    evidence: Array.from({ length: 5 }, (_, i) => ({
      id: `ev-syn-${i + 1}`,
      claimId: "c-syn-1",
      title: `Environment norms notified - Outlet ${i + 1}`,
      url: `https://outlet${i + 1}.in/norms`,
      domain: `outlet${i + 1}.in`,
      snippet: "PTI: The Union Environment Ministry has notified revised emissions standards for thermal plants.",
      publishedAt: "2026-05-03T10:00:00Z",
      sourceType: "national_news",
      sourceRelationship: "syndicated",
      evidenceQuality: "high",
      relevance: "direct",
    })),
    omissions: [],
    clusters: [
      {
        clusterId: "cl-pti-single",
        memberEvidenceIds: ["ev-syn-1", "ev-syn-2", "ev-syn-3", "ev-syn-4", "ev-syn-5"],
        originType: "syndicated",
        independenceConfidence: "high",
        clusterRule: "wire_attribution",
        sharedAgency: "PTI",
      },
    ],
    comparison: {
      totalIndependentClusters: 1,
      totalConflicts: 0,
      totalUnresolvedDimensions: 0,
      coverageLimited: true,
      claims: [
        {
          claimId: "c-syn-1",
          independentClusterCount: 1,
          agreementSummary: "none",
          conflicts: [],
          dimensions: [
            {
              dimension: "event",
              outcome: "agreement",
              articleValue: "Government notifies new environmental standards",
              sourceValues: [
                { clusterId: "cl-pti-single", evidenceId: "ev-syn-1", value: "Government notifies new standards" },
              ],
            },
          ],
        },
      ],
    },
  },

  // 4. Industrial Plant Fire: 4 independent clusters reporting different death tolls (10, 15, 25, 40)
  {
    id: "industrial_fire_conflicting_death_toll",
    category: "conflicting_reports",
    description: "Major fire accident where 4 independent outlets report 10, 15, 25, and 40 casualties",
    claims: [
      {
        id: "c-fire-1",
        text: "At least 10 workers killed in industrial boiler explosion",
        importance: "high",
        claimType: "numeric",
        layer: "underlying_fact",
      },
    ],
    evaluations: [
      {
        claimId: "c-fire-1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Explosion confirmed, but casualty figures vary radically across outlets.",
        evidenceIds: ["ev-f-1", "ev-f-2", "ev-f-3", "ev-f-4"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ],
    evidence: [
      { id: "ev-f-1", claimId: "c-fire-1", title: "Fire 1", url: "https://a.com/fire", domain: "a.com", snippet: "10 dead", publishedAt: "2026-05-04T10:00:00Z", sourceType: "national_news", sourceRelationship: "independent", evidenceQuality: "high", relevance: "direct" },
      { id: "ev-f-2", claimId: "c-fire-1", title: "Fire 2", url: "https://b.com/fire", domain: "b.com", snippet: "15 dead", publishedAt: "2026-05-04T10:00:00Z", sourceType: "national_news", sourceRelationship: "independent", evidenceQuality: "high", relevance: "direct" },
      { id: "ev-f-3", claimId: "c-fire-1", title: "Fire 3", url: "https://c.com/fire", domain: "c.com", snippet: "25 dead", publishedAt: "2026-05-04T10:00:00Z", sourceType: "national_news", sourceRelationship: "independent", evidenceQuality: "high", relevance: "direct" },
      { id: "ev-f-4", claimId: "c-fire-1", title: "Fire 4", url: "https://d.com/fire", domain: "d.com", snippet: "40 dead", publishedAt: "2026-05-04T10:00:00Z", sourceType: "national_news", sourceRelationship: "independent", evidenceQuality: "high", relevance: "direct" },
    ],
    omissions: [],
    clusters: [
      { clusterId: "cl-f-1", memberEvidenceIds: ["ev-f-1"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-f-2", memberEvidenceIds: ["ev-f-2"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-f-3", memberEvidenceIds: ["ev-f-3"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
      { clusterId: "cl-f-4", memberEvidenceIds: ["ev-f-4"], originType: "original", independenceConfidence: "high", clusterRule: "standalone" },
    ],
    comparison: {
      totalIndependentClusters: 4,
      totalConflicts: 1,
      totalUnresolvedDimensions: 0,
      coverageLimited: false,
      claims: [
        {
          claimId: "c-fire-1",
          independentClusterCount: 4,
          agreementSummary: "weak",
          conflicts: [{ dimension: "numbers", clusterIds: ["cl-f-1", "cl-f-2", "cl-f-3", "cl-f-4"], explanation: "Casualty count dispute: 10 vs 15 vs 25 vs 40" }],
          dimensions: [
            {
              dimension: "numbers",
              outcome: "contradiction",
              articleValue: "10",
              sourceValues: [
                { clusterId: "cl-f-1", evidenceId: "ev-f-1", value: "10" },
                { clusterId: "cl-f-2", evidenceId: "ev-f-2", value: "15" },
                { clusterId: "cl-f-3", evidenceId: "ev-f-3", value: "25" },
                { clusterId: "cl-f-4", evidenceId: "ev-f-4", value: "40" },
              ],
            },
          ],
        },
      ],
    },
  },
];

async function runMeasurement() {
  console.log("================================================================================");
  console.log("FAKENEWZZ SCORING V2 SHADOW MODE MEASUREMENT");
  console.log("Consensus Consistency & Multi-Source Dimensional Comparison Evaluation");
  console.log("Flag status: SCORING_V2 = shadow");
  console.log("================================================================================\n");

  const measurements: CaseMeasurement[] = [];

  // 1. Measure all 13 Core Verification Benchmark Fixtures
  for (const fixture of VERIFICATION_BENCHMARK_FIXTURES) {
    const clusters = clusterEvidenceIndependence(fixture.mockEvidence);

    // Build dimensional comparison if clusters exist
    let comparison: ComparisonReport | undefined;
    if (clusters.length > 0) {
      comparison = {
        totalIndependentClusters: clusters.length,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: clusters.length < 2,
        claims: fixture.claims.map((c) => ({
          claimId: c.id,
          independentClusterCount: clusters.length,
          agreementSummary: clusters.length >= 2 ? "strong" : "none",
          conflicts: [],
          dimensions: [
            {
              dimension: c.claimType === "numeric" ? "numbers" : c.claimType === "date" ? "date" : "event",
              outcome: "agreement",
              articleValue: c.text,
              sourceValues: fixture.mockEvidence.slice(0, 3).map((e, idx) => ({
                clusterId: clusters[idx % clusters.length]?.clusterId || `cl-${idx}`,
                evidenceId: e.id,
                value: c.text,
              })),
            },
          ],
        })),
      };
    }

    const v2Result = calculateScoreV2(
      fixture.claims,
      fixture.mockEvaluations,
      fixture.mockOmissions,
      {
        comparison,
        clusters,
        evidence: fixture.mockEvidence,
        coverageLimited: comparison?.coverageLimited,
      }
    );

    const consistencyResult = v2Result.consistency;
    const consistencyFactor = v2Result.scoreBreakdown.factors.find(
      (f) => f.code === "CONSISTENCY_MULTIPLIER"
    );
    const reduction = consistencyFactor?.effect ?? 0;
    const scoreAfter = v2Result.overallTrustScore;
    const scoreBefore = scoreAfter - reduction;

    // Collect version counts per dimension
    const versionCounts: Record<string, number> = {};
    if (consistencyResult?.claimConsistencies) {
      for (const cc of consistencyResult.claimConsistencies) {
        if (Array.isArray(cc.dimensions)) {
          for (const dimResult of cc.dimensions) {
            versionCounts[dimResult.dimension] = Math.max(
              versionCounts[dimResult.dimension] || 0,
              dimResult.versionCount
            );
          }
        }
      }
    }

    const reasons: string[] = [];
    if (consistencyFactor?.note) {
      reasons.push(consistencyFactor.note);
    }
    if (v2Result.scoreBreakdown.factors.some((f) => f.code === "CONSISTENCY_VERDICT_CAP")) {
      reasons.push("Verdict capped at mixed due to low consensus consistency");
    }

    const dimsWithVar = consistencyResult?.dimensionsWithMostVariation
      ? consistencyResult.dimensionsWithMostVariation.map(
          (d: any) => (typeof d === "string" ? d : `${d.dimension} (${d.versionCount} vers)`)
        )
      : [];

    measurements.push({
      id: fixture.id,
      category: fixture.category,
      description: fixture.description,
      scoreBeforeConsistency: scoreBefore,
      scoreAfterConsistency: scoreAfter,
      delta: scoreAfter - scoreBefore,
      consistencyScore: consistencyResult?.consistencyScore ?? 100,
      tier: consistencyResult?.tier ?? "none",
      multiplier: consistencyResult?.multiplier ?? 1.0,
      assessable: consistencyResult?.assessable ?? false,
      versionCounts,
      dimensionsWithVariation: dimsWithVar,
      reasons,
    });
  }

  // 2. Measure additional specialized cases (discrepancies, wire syndication, etc.)
  for (const c of ADDITIONAL_BENCHMARK_CASES) {
    const v2Result = calculateScoreV2(c.claims, c.evaluations, c.omissions, {
      comparison: c.comparison,
      clusters: c.clusters,
      evidence: c.evidence,
      coverageLimited: c.comparison?.coverageLimited,
    });

    const consistencyResult = v2Result.consistency;
    const consistencyFactor = v2Result.scoreBreakdown.factors.find(
      (f) => f.code === "CONSISTENCY_MULTIPLIER"
    );
    const reduction = consistencyFactor?.effect ?? 0;
    const scoreAfter = v2Result.overallTrustScore;
    const scoreBefore = scoreAfter - reduction;

    const versionCounts: Record<string, number> = {};
    if (consistencyResult?.claimConsistencies) {
      for (const cc of consistencyResult.claimConsistencies) {
        if (Array.isArray(cc.dimensions)) {
          for (const dimResult of cc.dimensions) {
            versionCounts[dimResult.dimension] = Math.max(
              versionCounts[dimResult.dimension] || 0,
              dimResult.versionCount
            );
          }
        }
      }
    }

    const reasons: string[] = [];
    if (consistencyFactor?.note) {
      reasons.push(consistencyFactor.note);
    }
    const variationFactors = v2Result.scoreBreakdown.factors.filter(
      (f) => f.code === "CONSISTENCY_VERSION_VARIATION"
    );
    variationFactors.forEach((vf) => {
      if (vf.note) reasons.push(vf.note);
    });

    const dimsWithVar = consistencyResult?.dimensionsWithMostVariation
      ? consistencyResult.dimensionsWithMostVariation.map(
          (d: any) => (typeof d === "string" ? d : `${d.dimension} (${d.versionCount} vers)`)
        )
      : [];

    measurements.push({
      id: c.id,
      category: c.category,
      description: c.description,
      scoreBeforeConsistency: scoreBefore,
      scoreAfterConsistency: scoreAfter,
      delta: scoreAfter - scoreBefore,
      consistencyScore: consistencyResult?.consistencyScore ?? 100,
      tier: consistencyResult?.tier ?? "none",
      multiplier: consistencyResult?.multiplier ?? 1.0,
      assessable: consistencyResult?.assessable ?? false,
      versionCounts,
      dimensionsWithVariation: dimsWithVar,
      reasons,
    });
  }

  // 3. Print Complete Measurement Table
  console.log("------------------------------------------------------------------------------------------------------------------------");
  console.log(
    "Case ID".padEnd(42) +
    "Category".padEnd(20) +
    "Raw v2".padEnd(10) +
    "After".padEnd(10) +
    "Delta".padEnd(10) +
    "Consistency".padEnd(14) +
    "Versions / Dim"
  );
  console.log("------------------------------------------------------------------------------------------------------------------------");

  for (const m of measurements) {
    const vStr = Object.entries(m.versionCounts)
      .map(([dim, cnt]) => `${dim}:${cnt}`)
      .join(", ") || (m.assessable ? "all=1" : "N/A (<2 clusters)");

    console.log(
      m.id.padEnd(42) +
      m.category.padEnd(20) +
      String(m.scoreBeforeConsistency).padEnd(10) +
      String(m.scoreAfterConsistency).padEnd(10) +
      (m.delta === 0 ? " 0" : String(m.delta)).padEnd(10) +
      `${m.consistencyScore}% (${m.tier})`.padEnd(14) +
      vStr
    );
  }

  console.log("------------------------------------------------------------------------------------------------------------------------\n");

  // 4. Identify and Print the 10 Largest Score Changes
  const sortedByAbsDelta = [...measurements].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top10 = sortedByAbsDelta.slice(0, 10);

  console.log("================================================================================");
  console.log("TOP 10 CASES WITH LARGEST SCORE CHANGES DUE TO CONSENSUS CONSISTENCY");
  console.log("================================================================================\n");

  top10.forEach((item, index) => {
    console.log(`${index + 1}. [${item.id}] (${item.category})`);
    console.log(`   Description:   ${item.description}`);
    console.log(`   Raw v2 Score:  ${item.scoreBeforeConsistency} -> Score After Consistency: ${item.scoreAfterConsistency} (Delta: ${item.delta} pts)`);
    console.log(`   Consistency:   ${item.consistencyScore}/100 [Tier: ${item.tier}, Multiplier: ${item.multiplier}x, Assessable: ${item.assessable}]`);
    console.log(`   Dimensions:    ${item.dimensionsWithVariation.length > 0 ? item.dimensionsWithVariation.join(", ") : "None (perfect consensus)"}`);
    console.log(`   Version Counts: ${JSON.stringify(item.versionCounts)}`);
    if (item.reasons.length > 0) {
      console.log(`   Explanations:`);
      item.reasons.forEach((r) => console.log(`     - ${r}`));
    }
    console.log("");
  });

  // Verify SCORING_V2 flag is still "shadow"
  console.log("Flag verification: process.env.SCORING_V2 = " + process.env.SCORING_V2);
  console.log("STATUS: Shadow mode run complete. SCORING_V2 remains 'shadow'. Flag was NOT turned 'on'.");
}

runMeasurement().catch((err) => {
  console.error("Measurement script failed:", err);
  process.exit(1);
});
