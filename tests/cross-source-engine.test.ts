import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clusterEvidenceIndependence } from "../src/lib/comparison/independence";
import {
  compareClaimsAcrossClusters,
  computeAgreementSummary,
  validateComparisonOutput,
} from "../src/lib/comparison/compareClaims";
import { DEFAULT_COMPARISON_CONFIG } from "../src/lib/comparison/config";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import { Article } from "../src/schemas/article";
import { VerificationReportSchema } from "../src/schemas/verification";

describe("Cross-Source Comparison Engine Test Suite (Prompt 10)", () => {
  // ── a. 5 outlets with near-identical PTI text form 1 cluster ──
  it("a. 5 outlets with near-identical PTI text form 1 cluster", () => {
    const ptiText =
      "New Delhi: The Supreme Court on Friday stayed the high court order regarding teacher recruitment examinations across the state, citing procedural discrepancies.";

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "SC stays HC order on teacher recruitment: PTI",
        snippet: ptiText,
        url: "https://outlet1.com/news/1",
        domain: "outlet1.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: `(PTI) ${ptiText}`,
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Supreme court puts stay on teacher exam order",
        snippet: ptiText,
        url: "https://outlet2.com/news/2",
        domain: "outlet2.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: `By PTI News Service: ${ptiText}`,
      },
      {
        id: "ev3",
        claimId: "c1",
        title: "Teacher recruitment: Top court stays HC decision",
        snippet: ptiText,
        url: "https://outlet3.com/news/3",
        domain: "outlet3.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: `Press Trust of India: ${ptiText}`,
      },
      {
        id: "ev4",
        claimId: "c1",
        title: "Apex court stays teacher recruitment order",
        snippet: ptiText,
        url: "https://outlet4.com/news/4",
        domain: "outlet4.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: `PTI reports: ${ptiText}`,
      },
      {
        id: "ev5",
        claimId: "c1",
        title: "HC order on teachers stayed by Supreme Court",
        snippet: ptiText,
        url: "https://outlet5.com/news/5",
        domain: "outlet5.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: `New Delhi (PTI) - ${ptiText}`,
      },
    ];

    const clusters = clusterEvidenceIndependence(evidence);

    assert.equal(clusters.length, 1, "Expected all 5 PTI syndicated outlets to collapse into 1 cluster");
    assert.equal(clusters[0].memberEvidenceIds.length, 5);
    assert.equal(clusters[0].originType, "syndicated");
    assert.equal(clusters[0].sharedAgency, "Press Trust of India");
  });

  // ── b. 2 outlets with different wording form 2 clusters with originType 'unknown' ──
  it("b. 2 outlets with different wording form 2 clusters with originType 'unknown'", () => {
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Heavy rainfall causes waterlogging in northern suburbs",
        snippet: "Incessant monsoon rains flooded several low-lying neighborhoods in North Bengaluru, causing massive traffic snarls.",
        url: "https://thehindu.com/news/rainfall",
        domain: "thehindu.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Incessant monsoon rains flooded several low-lying neighborhoods in North Bengaluru.",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "City civic body deploys emergency pumping boats amid cloudburst",
        snippet: "Civic authorities rushed disaster teams with inflatable boats to rescue stranded motorists following unprecedented localized downpours.",
        url: "https://deccanherald.com/news/floods",
        domain: "deccanherald.com",
        sourceType: "regional_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Civic authorities rushed disaster teams with inflatable boats to rescue stranded motorists.",
      },
    ];

    const clusters = clusterEvidenceIndependence(evidence);

    assert.equal(clusters.length, 2, "Expected 2 independently written outlets to form 2 distinct clusters");
    assert.equal(clusters[0].originType, "unknown", "Unmatched independent items must have originType 'unknown'");
    assert.equal(clusters[1].originType, "unknown", "Unmatched independent items must have originType 'unknown'");
  });

  // ── c. 'according to Reuters' joins Reuters' cluster ──
  it("c. 'according to Reuters' joins Reuters' cluster", () => {
    const evidence: Evidence[] = [
      {
        id: "ev_reuters",
        claimId: "c1",
        title: "Central bank signals impending interest rate pause",
        snippet: "The central bank signaled it may hold rates steady at its upcoming monetary policy meeting next month.",
        url: "https://reuters.com/markets/rates",
        domain: "reuters.com",
        sourceType: "international_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "The central bank signaled it may hold rates steady at its upcoming meeting.",
      },
      {
        id: "ev_secondary",
        claimId: "c1",
        title: "Rates could remain unchanged, reports indicate",
        snippet: "Policy makers are considering holding interest rates unchanged, according to Reuters.",
        url: "https://financialnews.com/central-bank",
        domain: "financialnews.com",
        sourceType: "specialized_trade",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Policy makers are considering holding interest rates unchanged, according to Reuters, as inflation cools.",
      },
    ];

    const clusters = clusterEvidenceIndependence(evidence);

    assert.equal(clusters.length, 1, "Explicit citation of Reuters should join Reuters' cluster");
    assert.ok(clusters[0].memberEvidenceIds.includes("ev_reuters"));
    assert.ok(clusters[0].memberEvidenceIds.includes("ev_secondary"));
  });

  // ── d. Differing numbers across publication dates flagged as possible_update, not contradiction ──
  it("d. Differing numbers across publication dates flagged as possible_update, not contradiction", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "At least 45 people were hospitalized following the chemical plant leak",
        importance: "high",
        claimType: "statistic",
        layer: "underlying_fact",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_early",
        claimId: "c1",
        title: "20 hospitalized after chemical leak at industrial estate",
        snippet: "Initial hospital reports confirm 20 workers were admitted with breathing difficulties.",
        url: "https://outlet1.com/leak-morning",
        domain: "outlet1.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "At 9 AM, 20 people were admitted to district hospital.",
        publishedAt: "2026-03-01T09:00:00Z",
      },
      {
        id: "ev_later",
        claimId: "c1",
        title: "Casualties rise to 45 in chemical plant incident",
        snippet: "By afternoon, health department updated that 45 patients were receiving treatment.",
        url: "https://outlet2.com/leak-evening",
        domain: "outlet2.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Official update at 4 PM stated 45 people are hospitalized.",
        publishedAt: "2026-03-01T16:00:00Z",
      },
    ];

    const report = await compareClaimsAcrossClusters(claims, evidence);

    assert.equal(report.claims.length, 1);
    const numDim = report.claims[0].dimensions.find((d) => d.dimension === "numbers");
    assert.ok(numDim, "Numbers dimension must be present");
    assert.equal(numDim.outcome, "partial_agreement");
    assert.equal(numDim.note, "possible_update");
    assert.equal(report.claims[0].conflicts.length, 0, "No contradiction conflict when numbers differ due to timestamp updates");
  });

  // ── e. Claim mentioned by no source yields unsupported_detail without altering claim evaluation verdict ──
  it("e. Claim mentioned by no source yields unsupported_detail without altering claim evaluation verdict", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "The state cabinet held an emergency session on Sunday evening",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
      {
        id: "c2",
        text: "The chief minister personally distributed gold watches to all attendees",
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
      },
    ];

    // Evidence only covers c1, zero evidence for c2
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "State cabinet convenes special emergency meeting",
        snippet: "Ministers gathered for an extraordinary evening cabinet briefing.",
        url: "https://news.com/cabinet",
        domain: "news.com",
        sourceType: "national_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "The state cabinet held an emergency session on Sunday evening.",
      },
    ];

    const report = await compareClaimsAcrossClusters(claims, evidence);

    const c2Result = report.claims.find((c) => c.claimId === "c2");
    assert.ok(c2Result, "c2 must be evaluated in comparison");
    const unsupportedDim = c2Result.dimensions.find((d) => d.outcome === "unsupported_detail");
    assert.ok(unsupportedDim, "Expected unsupported_detail dimension for claim not found in any source");
    assert.equal(c2Result.agreementSummary, "none");
  });

  // ── f. Nonexistent evidenceId in comparison output is rejected ──
  it("f. Nonexistent evidenceId in comparison output is rejected", () => {
    const validEvidenceIds = new Set(["ev1", "ev2"]);
    const validClusterIds = new Set(["cluster-1", "cluster-2"]);
    const evidenceMap = new Map<string, Evidence>();

    const rawOutput = {
      dimensions: [
        {
          dimension: "event" as const,
          outcome: "agreement" as const,
          articleValue: "The treaty was signed",
          sourceValues: [
            { clusterId: "cluster-1", evidenceId: "ev1", value: "Treaty signed" },
            { clusterId: "cluster-fake", evidenceId: "ev-hallucinated", value: "Fabricated report" },
          ],
        },
      ],
      conflicts: [
        {
          dimension: "event" as const,
          description: "Disputed venue",
          evidenceIds: ["ev1", "ev-hallucinated"],
        },
      ],
    };

    const { dimensions, conflicts, validationMetrics } = validateComparisonOutput(
      rawOutput,
      validEvidenceIds,
      validClusterIds,
      evidenceMap
    );

    assert.equal(dimensions.length, 1);
    assert.equal(dimensions[0].sourceValues.length, 1, "Hallucinated source value must be dropped");
    assert.equal(dimensions[0].sourceValues[0].evidenceId, "ev1");
    assert.ok(validationMetrics.droppedEvidenceIds.includes("ev-hallucinated"));
    assert.equal(conflicts[0].evidenceIds.length, 1);
    assert.equal(conflicts[0].evidenceIds[0], "ev1");
  });

  // ── g. Failed fetch never creates contradiction/unresolved outcome ──
  it("g. Failed fetch never creates contradiction/unresolved outcome", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "The spacecraft landed safely on the lunar surface",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_good",
        claimId: "c1",
        title: "Lunar lander touches down successfully",
        snippet: "Mission control confirmed a safe touchdown on the lunar south pole.",
        url: "https://spaceagency.gov/moon-landing",
        domain: "spaceagency.gov",
        sourceType: "official",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "The spacecraft landed safely on the lunar surface.",
      },
      {
        id: "ev_failed",
        claimId: "c1",
        title: "Lander crashed into crater: Unconfirmed blog",
        snippet: "Lander crashed",
        url: "https://blocked-paywall.com/news",
        domain: "blocked-paywall.com",
        sourceType: "other",
        sourceRelationship: "unknown",
        evidenceQuality: "low",
        relevance: "direct",
        relationship: "contradicting",
        sourceContentStatus: "failed", // FAILED FETCH
        sourceContentExcerpt: "Disaster struck as communication was lost completely.",
      },
    ];

    const report = await compareClaimsAcrossClusters(claims, evidence);

    const c1Result = report.claims[0];
    const contradictionDim = c1Result.dimensions.find((d) => d.outcome === "contradiction");
    const unresolvedDim = c1Result.dimensions.find((d) => d.outcome === "unresolved");

    assert.equal(contradictionDim, undefined, "Failed fetch must not produce contradiction");
    assert.equal(unresolvedDim, undefined, "Failed fetch must not produce unresolved");
    assert.equal(c1Result.conflicts.length, 0, "Failed fetch must not produce conflict");
  });

  // ── h. agreementSummary thresholds behave strictly at boundaries ──
  it("h. agreementSummary thresholds behave strictly at boundaries (strong >= 3, moderate = 2, weak = 1 or conflicts, none = 0)", () => {
    const emptyDimensions = [
      {
        dimension: "event" as const,
        outcome: "agreement" as const,
        articleValue: "Event",
        sourceValues: [],
      },
    ];
    const unresolvedDimensions = [
      {
        dimension: "event" as const,
        outcome: "unresolved" as const,
        articleValue: "Event",
        sourceValues: [],
      },
    ];
    const conflictItem = [
      {
        dimension: "event" as const,
        description: "Contradiction",
        evidenceIds: ["ev1", "ev2"],
      },
    ];

    // Boundary 0 clusters -> none
    assert.equal(computeAgreementSummary(0, [], emptyDimensions), "none");

    // Boundary 1 cluster -> weak
    assert.equal(computeAgreementSummary(1, [], emptyDimensions), "weak");

    // Boundary 2 clusters, no conflicts -> moderate
    assert.equal(computeAgreementSummary(2, [], emptyDimensions), "moderate");

    // Boundary 2 clusters, with conflicts -> weak
    assert.equal(computeAgreementSummary(2, conflictItem, emptyDimensions), "weak");

    // Boundary 3 clusters, no conflicts, resolved -> strong
    assert.equal(computeAgreementSummary(3, [], emptyDimensions), "strong");

    // Boundary 3 clusters, with conflicts -> weak
    assert.equal(computeAgreementSummary(3, conflictItem, emptyDimensions), "weak");

    // Boundary 3 clusters, with unresolved dimension -> moderate
    assert.equal(computeAgreementSummary(3, [], unresolvedDimensions), "moderate");

    // Boundary 4 clusters, no conflicts, resolved -> strong
    assert.equal(computeAgreementSummary(4, [], emptyDimensions), "strong");
  });

  // ── i. COMPARISON_ENABLED=false produces report identical to pre-change report ──
  it("i. COMPARISON_ENABLED=false produces report identical to pre-change report", async () => {
    const article = {
      title: "Researchers develop novel room-temperature semiconductor",
      sourceDomain: "sciencenews.org",
      content: "Researchers have synthesized a novel material that functions as a semiconductor at room temperature.",
      url: "https://sciencenews.org/semiconductor",
    };

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Researchers develop novel room-temperature semiconductor",
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
        explanation: "Verified by official university press release.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const omissions: Omission[] = [];

    // When comparison is omitted (like when COMPARISON_ENABLED is false)
    const reportWithout = await buildReport(article, claims, evaluations, omissions);

    assert.equal(reportWithout.comparison, undefined);
    assert.ok(VerificationReportSchema.safeParse(reportWithout).success);
  });

  // ── j. overallTrustScore and verdicts are strictly identical with comparison on vs off ──
  it("j. overallTrustScore and verdicts are strictly identical with comparison on vs off", async () => {
    const article = {
      title: "Global Summit reaches agreement on clean water access",
      sourceDomain: "globalnews.org",
      content: "Delegates from 120 nations reached a landmark agreement on universal clean water access.",
      url: "https://globalnews.org/water-summit",
    };

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Global Summit reaches agreement on clean water access",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
      {
        id: "c2",
        text: "Delegates from 120 nations reached a landmark agreement",
        importance: "medium",
        claimType: "statistic",
        layer: "underlying_fact",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Nations pledge clean water access at summit",
        snippet: "Representatives from over one hundred countries signed the accord.",
        url: "https://un.org/news/water",
        domain: "un.org",
        sourceType: "official",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Delegates from 120 nations reached a landmark agreement.",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Clean water treaty concluded in Geneva",
        snippet: "The treaty was ratified on Sunday afternoon.",
        url: "https://genevanews.ch/summit",
        domain: "genevanews.ch",
        sourceType: "international_news",
        sourceRelationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Global summit reaches historic agreement on water rights.",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by UN official statement.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "120 delegate count corroborated by reporting.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ];

    const omissions: Omission[] = [];

    // Build report without comparison
    const reportWithout = await buildReport(article, claims, evaluations, omissions, {
      evidence,
    });

    // Generate comparison
    const comparisonReport = await compareClaimsAcrossClusters(claims, evidence);

    // Build report with comparison attached
    const reportWith = await buildReport(article, claims, evaluations, omissions, {
      evidence,
      comparison: comparisonReport,
    });

    assert.equal(reportWith.overallTrustScore, reportWithout.overallTrustScore);
    assert.equal(reportWith.veracityVerdict, reportWithout.veracityVerdict);
    assert.equal(reportWith.confidence, reportWithout.confidence);
    assert.deepEqual(reportWith.scoreBreakdown, reportWithout.scoreBreakdown);
    assert.deepEqual(reportWith.claimSummary, reportWithout.claimSummary);
    assert.ok(reportWith.comparison !== undefined);
    assert.equal(reportWithout.comparison, undefined);
  });
});

