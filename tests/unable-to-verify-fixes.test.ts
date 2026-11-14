import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/verify/route";
import { calculateScoreV2 } from "../src/lib/scoring/calculateScoreV2";
import { buildReport } from "../src/lib/verification/buildReport";
import {
  areRangesPartiallyAgreeing,
  areCurrenciesEquivalent,
  isDetailVariation,
} from "../src/lib/comparison/normalization";
import {
  classifyEvidenceEventMatch,
} from "../src/lib/comparison/eventMatching";
import {
  deterministicCompareClaim,
  validateComparisonOutput,
} from "../src/lib/comparison/compareClaims";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { OriginCluster } from "../src/lib/comparison/independence";
import { ComparisonReport } from "../src/schemas/comparison";

function makeEvidence(e: Partial<Evidence> & { id: string; claimId: string; url: string; domain: string }): Evidence {
  return {
    title: "Test Title",
    snippet: "Test snippet",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "general_web",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: null,
    sourceContentStatus: "snippet_only",
    ...e,
  } as Evidence;
}

function makeCluster(c: Partial<OriginCluster> & { clusterId: string; memberEvidenceIds: string[] }): OriginCluster {
  return {
    originType: "original",
    independenceConfidence: "high",
    clusterRule: "origin_metadata",
    ...c,
  } as OriginCluster;
}

describe("Unable to Verify Fixes Suite (Prompt 10)", () => {
  // ─── 6.a TOI-style 403 URL returns sourceReadStatus: 'unreadable' ─────────
  it("6.a TOI-style 403 URL returns sourceReadStatus: 'unreadable', score not reduced for fetch failure", async () => {
    // URL with clear headline slug that fails standard fetch
    const url =
      "https://timesofindia.indiatimes.com/india/supreme-court-dismisses-plea-against-arbitrary-airfares/articleshow/108345678.cms";

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Supreme Court dismisses plea against arbitrary airfares",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Supported by court records and reporting across independent outlets.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        title: "SC rejects plea on airfares",
        snippet: "Supreme court dismissed the petition seeking cap on airfares.",
        url: "https://livelaw.in/sc-airfares",
        domain: "livelaw.in",
        publishedAt: "2024-03-15",
        sourceType: "legal_court",
        sourceRelationship: "independent",
        relationship: "supporting",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c1",
        title: "Apex court declines to regulate airfares",
        snippet: "A bench led by CJI declined to entertain plea on flight pricing.",
        url: "https://thehindu.com/sc-airfares",
        domain: "thehindu.com",
        publishedAt: "2024-03-15",
        sourceType: "national_news",
        sourceRelationship: "independent",
        relationship: "supporting",
      }),
    ];

    const report = await buildReport(
      {
        title: "Supreme court dismisses plea against arbitrary airfares",
        sourceDomain: "timesofindia.indiatimes.com",
        url,
      },
      claims,
      evaluations,
      [],
      {
        evidence,
        sourceReadStatus: "unreadable",
        sourceReadNote:
          "We couldn't read the original article, so this check is based on independent reporting of the same story.",
      }
    );

    assert.strictEqual(report.sourceReadStatus, "unreadable");
    assert.ok(report.sourceReadNote?.includes("based on independent reporting"));
    // Must not be unable to verify; score must reflect independent verification
    assert.ok(report.overallTrustScore >= 70, `Score was ${report.overallTrustScore}`);
    assert.ok(report.veracityVerdict === "mostly_true" || report.veracityVerdict === "verified_true");
  });

  // ─── 6.b Fetch fails AND no independent evidence -> 'could_not_read' ───────
  it("6.b URL where fetch fails AND no independent reporting exists returns 'could_not_read', not Unable to Verify", async () => {
    // Calling route with an unparseable URL slug that fails ingestion
    const req = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/p" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.veracityVerdict, "could_not_read");
    assert.strictEqual(data.sourceReadStatus, "could_not_read");
    assert.notStrictEqual(data.veracityVerdict, "unverified");
  });

  // ─── 6.c Core event supported by 3 clusters with age 14-17 vs 16+ ──────────
  it("6.c Core event supported by 3 clusters with age 14-17 vs 16+ variation does not get Unable to Verify; records detail_variation", () => {
    process.env.SCORING_V2 = "on";

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Italy approved youth crime decree imposing stricter measures for minors aged 14 to 17",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Decree was officially passed by cabinet.",
        evidenceIds: ["ev1", "ev2", "ev3"],
        importantNotes: [],
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
    ];

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        title: "Italy passes Meloni decree",
        snippet: "Cabinet passed decree cracking down on youth crime for youths aged 14-17.",
        url: "https://ansa.it/decree",
        domain: "ansa.it",
        publishedAt: "2023-09-08",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "supporting",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c1",
        title: "Italian youth crime package",
        snippet: "New provisions apply to minors aged 16 and older.",
        url: "https://corriere.it/youth-crime",
        domain: "corriere.it",
        publishedAt: "2023-09-08",
        sourceType: "national_news",
        sourceRelationship: "independent",
        relationship: "supporting",
      }),
      makeEvidence({
        id: "ev3",
        claimId: "c1",
        title: "Italy cracks down on juvenile crime",
        snippet: "Minors aged 14-17 face stricter penalties under the new decree.",
        url: "https://reuters.com/italy-decree",
        domain: "reuters.com",
        publishedAt: "2023-09-08",
        sourceType: "wire",
        sourceRelationship: "independent",
        relationship: "supporting",
      }),
    ];

    const clusters: OriginCluster[] = [
      makeCluster({ clusterId: "cl-1", memberEvidenceIds: ["ev1"], originType: "original", independenceConfidence: "high" }),
      makeCluster({ clusterId: "cl-2", memberEvidenceIds: ["ev2"], originType: "original", independenceConfidence: "high" }),
      makeCluster({ clusterId: "cl-3", memberEvidenceIds: ["ev3"], originType: "original", independenceConfidence: "high" }),
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
          agreementSummary: "strong",
          conflicts: [
            {
              dimension: "numbers",
              description: "Age threshold difference: 14-17 vs 16+",
              evidenceIds: ["ev2"],
              conflictType: "detail_variation",
            },
          ],
          dimensions: [
            {
              dimension: "event",
              outcome: "agreement",
              articleValue: "decree passed",
              sourceValues: [{ clusterId: "cl-1", evidenceId: "ev1", value: "decree passed" }],
            },
            {
              dimension: "numbers",
              outcome: "detail_variation",
              articleValue: "14 to 17",
              sourceValues: [
                { clusterId: "cl-1", evidenceId: "ev1", value: "14-17" },
                { clusterId: "cl-2", evidenceId: "ev2", value: "16+" },
                { clusterId: "cl-3", evidenceId: "ev3", value: "14-17" },
              ],
              note: "Age threshold variation",
            },
          ],
        },
      ],
    };

    const res = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    // Gate must pass
    assert.strictEqual(res.coreEventGatePassed, true);
    // Verdict cannot be unverified
    assert.notStrictEqual(res.veracityVerdict, "unverified");
    assert.ok(res.veracityVerdict === "mostly_true" || res.veracityVerdict === "verified_true");
    // Factors record detail variation
    assert.ok(res.scoreBreakdown.factors.some((f) => f.code === "DETAIL_VARIATION"));
  });

  // ─── 6.d Range partial agreement ──────────────────────────────────────────
  it("6.d Article stating 'up to five years' matched by source stating 'two to five years' is partial_agreement, not contradiction", () => {
    const textA = "violators face imprisonment of up to five years";
    const textB = "penalties range from two to five years in prison";

    assert.strictEqual(areRangesPartiallyAgreeing(textA, textB), true);

    const comp = deterministicCompareClaim(
      { id: "c1", text: textA, importance: "high", claimType: "event" },
      textA,
      new Map([
        [
          "cl-1",
          [
            {
              evidence: makeEvidence({
                id: "ev1",
                claimId: "c1",
                title: "Report",
                url: "https://test.com/1",
                domain: "test.com",
                snippet: textB,
                publishedAt: "2024-01-01",
              }),
              passage: textB,
            },
          ],
        ],
      ]),
      []
    );

    const numDim = comp.dimensions.find((d) => d.dimension === "numbers");
    assert.ok(numDim);
    assert.strictEqual(numDim?.outcome, "partial_agreement");
    // No contradiction conflict created
    assert.strictEqual(comp.conflicts.length, 0);
  });

  // ─── 6.e Currency equivalence ─────────────────────────────────────────────
  it("6.e EUR 20,000 matched by INR 21 lakh and USD 22,500 produces no conflict", () => {
    const eurText = "parents face fines of up to EUR 20,000";
    const inrText = "fines reach ₹21 lakh for non-compliance";
    const usdText = "penalties capped at $22,500";

    assert.strictEqual(areCurrenciesEquivalent(eurText, inrText), true);
    assert.strictEqual(areCurrenciesEquivalent(eurText, usdText), true);

    const detailVar = isDetailVariation(eurText, inrText);
    assert.strictEqual(detailVar.isVariation, true);

    const comp = deterministicCompareClaim(
      { id: "c1", text: eurText, importance: "high", claimType: "event" },
      eurText,
      new Map([
        [
          "cl-1",
          [
            {
              evidence: makeEvidence({
                id: "ev1",
                claimId: "c1",
                title: "Report 1",
                url: "https://test.com/1",
                domain: "test.com",
                snippet: inrText,
                publishedAt: "2024-01-01",
              }),
              passage: inrText,
            },
          ],
        ],
      ]),
      []
    );

    const numDim = comp.dimensions.find((d) => d.dimension === "numbers");
    assert.ok(numDim);
    assert.strictEqual(numDim?.outcome, "agreement");
    assert.strictEqual(comp.conflicts.length, 0);
  });

  // ─── 6.f July bill article used as evidence is related_background ─────────
  it("6.f July bill article used as evidence for September decree is related_background and creates no conflict", () => {
    const septemberDecreeArticle = {
      title: "Italy passes September decree cracking down on youth crime",
      contentExcerpt: "Cabinet approved urgent decree in September addressing juvenile delinquency.",
      publishedAt: "2023-09-08",
    };

    const julyBillEvidence: Evidence = makeEvidence({
      id: "ev_july",
      claimId: "c1",
      title: "Parliamentary bill proposed in July to modify juvenile laws",
      snippet: "An earlier bill introduced in July suggested different sentencing structures.",
      url: "https://news.it/july-bill",
      domain: "news.it",
      publishedAt: "2023-07-15",
    });

    const matchType = classifyEvidenceEventMatch(julyBillEvidence, septemberDecreeArticle);
    assert.strictEqual(matchType, "related_background");

    // In validation, background evidence is stripped from conflicts
    const validated = validateComparisonOutput(
      {
        dimensions: [
          {
            dimension: "numbers",
            outcome: "contradiction",
            articleValue: "decree penalties",
            sourceValues: [{ clusterId: "cl-july", evidenceId: "ev_july", value: "july bill numbers" }],
          },
        ],
        conflicts: [
          {
            dimension: "numbers",
            description: "July bill had different numbers",
            evidenceIds: ["ev_july"],
          },
        ],
      },
      new Set(["ev_july"]),
      new Set(["cl-july"]),
      new Map([["ev_july", { ...julyBillEvidence, eventMatch: "related_background" }]])
    );

    // Conflict created by related_background evidence must be discarded
    assert.strictEqual(validated.conflicts.length, 0);
  });

  // ─── 6.g One official + one independent cluster passes gate ───────────────
  it("6.g One official source cluster and one independent news cluster passes core-event gate", () => {
    process.env.SCORING_V2 = "on";

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Ministry issued official notification updating regulations",
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
        explanation: "Confirmed by official gazette and national news.",
        evidenceIds: ["ev_gov", "ev_news"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev_gov",
        claimId: "c1",
        title: "Official Gazette Notification",
        snippet: "Notification 442 issued by ministry.",
        url: "https://egazette.gov.in/442",
        domain: "egazette.gov.in",
        sourceType: "official",
        sourceRelationship: "original",
      }),
      makeEvidence({
        id: "ev_news",
        claimId: "c1",
        title: "Government notifies regulatory changes",
        snippet: "The ministry published new regulations on Monday.",
        url: "https://thehindu.com/regs",
        domain: "thehindu.com",
        sourceType: "national_news",
        sourceRelationship: "independent",
      }),
    ];

    const clusters: OriginCluster[] = [
      makeCluster({ clusterId: "cl-gov", memberEvidenceIds: ["ev_gov"], originType: "original", independenceConfidence: "high" }),
      makeCluster({ clusterId: "cl-news", memberEvidenceIds: ["ev_news"], originType: "original", independenceConfidence: "high" }),
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
              dimension: "event",
              outcome: "agreement",
              articleValue: "Notification issued",
              sourceValues: [
                { clusterId: "cl-gov", evidenceId: "ev_gov", value: "Notification 442" },
                { clusterId: "cl-news", evidenceId: "ev_news", value: "Notification 442" },
              ],
            },
          ],
        },
      ],
    };

    const res = calculateScoreV2(claims, evaluations, [], {
      comparison,
      clusters,
      evidence,
    });

    assert.strictEqual(res.coreEventGatePassed, true);
    assert.notStrictEqual(res.veracityVerdict, "unverified");
    assert.ok(res.veracityVerdict === "mostly_true" || res.veracityVerdict === "verified_true");
    assert.ok(res.scoreBreakdown.factors.some((f) => f.code === "CORE_EVENT_GATE_PASSED"));
  });

  // ─── 6.h Regression: Genuinely false claim returns negative verdict ────────
  it("6.h Regression: Genuinely false claim with contradicting evidence still returns a negative verdict", () => {
    process.env.SCORING_V2 = "on";

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Central bank declared total currency ban on all banknotes starting tomorrow",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Central bank issued a public statement clarifying that reports of a banknote ban are fake.",
        evidenceIds: ["ev_debunk"],
        importantNotes: [],
        layer: "event_occurred",
      },
    ];

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev_debunk",
        claimId: "c1",
        title: "RBI clarifies rumours on banknote ban are false",
        snippet: "The central bank warned against false social media rumours.",
        url: "https://rbi.org.in/press/debunk",
        domain: "rbi.org.in",
        sourceType: "official",
        sourceRelationship: "original",
      }),
    ];

    const res = calculateScoreV2(claims, evaluations, [], {
      evidence,
    });

    assert.strictEqual(res.coreEventGatePassed, false);
    assert.ok(res.veracityVerdict === "false" || res.veracityVerdict === "mostly_false");
    assert.ok(res.overallTrustScore <= 35);
  });

  // ─── 6.i Determinism: Same input twice gives same score and verdict ────────
  it("6.i Determinism: Same input twice gives same score and verdict", () => {
    process.env.SCORING_V2 = "on";

    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Cabinet approved railway safety upgrade plan",
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
      },
      {
        id: "c2",
        text: "Allocation is 10000 crore rupees",
        importance: "medium",
        claimType: "factual",
        layer: "underlying_fact",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Cabinet announcement confirmed.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "event_occurred",
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Budget documents confirm allocation.",
        evidenceIds: ["ev1"],
        importantNotes: [],
        layer: "underlying_fact",
      },
    ];

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        title: "Cabinet decisions",
        snippet: "Cabinet cleared railway plan with 10,000 cr allocation.",
        url: "https://pib.gov.in/rail",
        domain: "pib.gov.in",
        sourceType: "official",
        sourceRelationship: "original",
      }),
    ];

    const run1 = calculateScoreV2(claims, evaluations, [], { evidence });
    const run2 = calculateScoreV2(claims, evaluations, [], { evidence });

    assert.strictEqual(run1.overallTrustScore, run2.overallTrustScore);
    assert.strictEqual(run1.veracityVerdict, run2.veracityVerdict);
    assert.strictEqual(run1.confidence, run2.confidence);
    assert.strictEqual(run1.coreEventGatePassed, run2.coreEventGatePassed);
    assert.deepStrictEqual(run1.scoreBreakdown.factors, run2.scoreBreakdown.factors);
  });
});
