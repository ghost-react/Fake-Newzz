import test from "node:test";
import assert from "node:assert/strict";

import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import { rankEvidenceForClaim } from "../src/lib/search/rankEvidence";
import { evaluateSingleClaim, deterministicEvaluateClaim } from "../src/lib/verification/evaluateClaim";
import { prepareEvidenceForClaim } from "../src/lib/verification/prepareEvidence";
import { calculateScore } from "../src/lib/scoring/calculateScore";
import { determineVerdictWithRule, determineVerdict } from "../src/lib/scoring/determineVerdict";
import { buildReport } from "../src/lib/verification/buildReport";

test("Phase 5 & 6 Accuracy Regression Test Suite (All 10 Core Scenarios)", async (t) => {

  // ── 1. Genuine event corroborated by several independent outlets ──────────
  await t.test("1. Genuine event corroborated by several independent outlets", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "NASA James Webb Space Telescope discovers oldest known black hole in the early universe",
        importance: "high",
        claimType: "event",
      },
    ];

    const rawEvidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "NASA Webb Telescope identifies ancient active supermassive black hole",
        url: "https://www.reuters.com/space/jwst-black-hole",
        domain: "reuters.com",
        snippet: "Researchers using NASA's James Webb Space Telescope have discovered the oldest known active supermassive black hole in galaxy CEERS 1019.",
        publishedAt: "2023-07-06T12:00:00Z",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Webb Telescope spots ancient supermassive black hole in early cosmos",
        url: "https://www.bbc.com/news/science-jwst",
        domain: "bbc.com",
        snippet: "Astronomers have detected the most distant active supermassive black hole found to date with the James Webb Space Telescope.",
        publishedAt: "2023-07-06T14:00:00Z",
        sourceType: "international_news",
        sourceRelationship: "independent",
        relationship: "unknown",
        evidenceQuality: "medium",
        relevance: "direct",
      },
    ];

    const ranked = rankEvidenceForClaim(claims[0], rawEvidence);
    const prepared = prepareEvidenceForClaim("c1", ranked);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "supporting", "Expected supporting verdict");
    assert.strictEqual(evalResult.confidence, "high", "Expected high confidence with multiple outlets");
    assert.ok(evalResult.evidenceIds.length >= 1, "Must cite valid evidence IDs");

    const { scoreBreakdown } = calculateScore(claims, [evalResult], []);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, [evalResult], []);

    assert.ok(scoreBreakdown.finalScore >= 90, `Expected score >= 90, got ${scoreBreakdown.finalScore}`);
    assert.strictEqual(verdict, "verified_true", `Expected verified_true, got ${verdict}`);
  });

  // ── 2. Genuine event with uncertain details ───────────────────────────────
  await t.test("2. Genuine event with uncertain details", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "City transit authority approves major electric bus expansion plan",
        importance: "high",
        claimType: "event",
      },
      {
        id: "c2",
        text: "The fleet transition will cost precisely $487.3 million over four years",
        importance: "medium",
        claimType: "statistic",
      },
    ];

    // c1 has clear reporting, c2 has uncertain/unconfirmed financial figures
    const evals: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Transit board minutes and multiple news reports confirm the bus expansion approval.",
        evidenceIds: ["ev-bus-1"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Public releases mention estimated budgets between $400M and $500M, but specific $487.3M figure remains unverified.",
        evidenceIds: [],
        importantNotes: [],
      },
    ];

    const { scoreBreakdown, confidence } = calculateScore(claims, evals, []);
    const { verdict, rule } = determineVerdictWithRule(scoreBreakdown.finalScore, claims, evals, []);

    // Crucial requirement: Must NOT be overridden to 'unverified' when the central event is corroborated!
    assert.notStrictEqual(verdict, "unverified", "Genuine event with uncertain details must not be unverified");
    assert.ok(verdict === "mostly_true" || verdict === "mixed", `Expected mostly_true or mixed, got ${verdict} (${rule})`);
    assert.ok(scoreBreakdown.finalScore >= 60, `Expected score >= 60, got ${scoreBreakdown.finalScore}`);
  });

  // ── 3. Genuine event with syndicated coverage ─────────────────────────────
  await t.test("3. Genuine event with syndicated coverage", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Global maritime canal traffic resumes after container ship freed",
        importance: "high",
        claimType: "event",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev-wire",
        claimId: "c1",
        title: "Canal authority reopens shipping lane as vessel refloated",
        url: "https://www.reuters.com/world/canal-refloated",
        domain: "reuters.com",
        snippet: "Tugboats successfully refloated the stranded container vessel on Monday, clearing the shipping channel.",
        publishedAt: "2023-03-29T10:00:00Z",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
      },
      {
        id: "ev-syn",
        claimId: "c1",
        title: "Canal authority reopens shipping lane as vessel refloated",
        url: "https://www.localnews.com/wire/canal-refloated",
        domain: "localnews.com",
        snippet: "Tugboats successfully refloated the stranded container vessel on Monday, clearing the shipping channel.",
        publishedAt: "2023-03-29T10:30:00Z",
        sourceType: "regional_news",
        sourceRelationship: "syndicated",
        relationship: "unknown",
        evidenceQuality: "medium",
        relevance: "direct",
      },
    ];

    const prepared = prepareEvidenceForClaim("c1", evidence);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "supporting");
    assert.ok(evalResult.evidenceIds.includes("ev-wire"));

    const { scoreBreakdown } = calculateScore(claims, [evalResult], []);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, [evalResult], []);
    assert.ok(verdict === "verified_true" || verdict === "mostly_true");
  });

  // ── 4. Genuine event with blocked source pages ────────────────────────────
  await t.test("4. Genuine event with blocked source pages", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "European Central Bank raises benchmark interest rate by 25 basis points",
        importance: "high",
        claimType: "event",
      },
    ];

    // Scrape failed (e.g. paywall/403), but rich search snippet contains decisive facts
    const evidence: Evidence[] = [
      {
        id: "ev-ft",
        claimId: "c1",
        title: "ECB lifts interest rates by 25bp to fresh record high",
        url: "https://www.ft.com/content/ecb-rate-hike",
        domain: "ft.com",
        snippet: "The European Central Bank raised its key deposit rate by 25 basis points on Thursday, bringing borrowing costs to their highest level since the euro was launched.",
        publishedAt: "2023-09-14T12:45:00Z",
        sourceType: "international_news",
        sourceRelationship: "independent",
        relationship: "unknown",
        evidenceQuality: "medium",
        relevance: "direct",
        sourceContentStatus: "failed", // Scrape blocked/failed
        sourceContentExcerpt: null,
      },
    ];

    const prepared = prepareEvidenceForClaim("c1", evidence);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    // Failed page scrape must NOT prevent evaluation from valid search snippet
    assert.strictEqual(evalResult.verdict, "supporting", "Snippet alone must corroborate claim");
    assert.ok(evalResult.evidenceIds.includes("ev-ft"));

    const { scoreBreakdown } = calculateScore(claims, [evalResult], []);
    assert.ok(scoreBreakdown.finalScore >= 75);
  });

  // ── 5. Genuine event with different headline wording ──────────────────────
  await t.test("5. Genuine event with different headline wording", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Government approves $1.2 billion subsidy package for domestic semiconductor fabrication facilities",
        importance: "high",
        claimType: "event",
      },
    ];

    // Outlets use completely different journalistic headlines
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Cabinet greenlights landmark chip manufacturing incentive scheme",
        url: "https://www.bloomberg.com/news/chip-incentives",
        domain: "bloomberg.com",
        snippet: "Ministers cleared a $1.2 billion state support program aimed at attracting global semiconductor fabrication units.",
        publishedAt: "2023-06-15T09:00:00Z",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const prepared = prepareEvidenceForClaim("c1", evidence);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "supporting", "Should match despite different vocabulary");
    assert.ok(evalResult.evidenceIds.includes("ev1"));
  });

  // ── 6. False claim ────────────────────────────────────────────────────────
  await t.test("6. False claim directly refuted by credible evidence", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Health Ministry mandates microchip tracking in all pediatric vaccinations",
        importance: "high",
        claimType: "factual",
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev-debunk",
        claimId: "c1",
        title: "Fact Check: False claim circulates regarding vaccine microchip tracking",
        url: "https://www.reuters.com/fact-check/vaccine-microchip-hoax",
        domain: "reuters.com",
        snippet: "Health authorities and researchers have refuted the fabricated claim that vaccines contain tracking microchips. Official vaccine specifications confirm no electronic components.",
        publishedAt: "2023-08-20T11:00:00Z",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const prepared = prepareEvidenceForClaim("c1", evidence);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "contradicting", "Expected contradicting verdict");
    assert.strictEqual(evalResult.confidence, "high");

    const { scoreBreakdown } = calculateScore(claims, [evalResult], []);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, [evalResult], []);

    assert.ok(scoreBreakdown.finalScore <= 25, `Expected score <= 25, got ${scoreBreakdown.finalScore}`);
    assert.strictEqual(verdict, "false", `Expected false verdict, got ${verdict}`);
  });

  // ── 7. Misleading claim with missing context ──────────────────────────────
  await t.test("7. Misleading claim with missing context", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Income tax rates increased by 5 percent this fiscal year",
        importance: "high",
        claimType: "event",
      },
    ];

    // Technically a rate rose, but high-severity omission materially changes interpretation
    const evals: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Top marginal rate increased by 5%, which is accurate for that specific bracket.",
        evidenceIds: ["ev-tax"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [
      {
        id: "om1",
        claimId: "c1",
        type: "missing_context",
        severity: "high",
        confidence: "high",
        description: "The tax increase strictly applies to top earners above $10 million; rates for 98% of citizens decreased.",
        whyItMatters: "Omitting the bracket threshold creates the false impression that all taxpayers face tax increases.",
        evidenceIds: ["ev-tax"],
      },
    ];

    const { scoreBreakdown } = calculateScore(claims, evals, omissions);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evals, omissions);

    assert.strictEqual(verdict, "misleading", `Expected misleading verdict, got ${verdict}`);
    assert.ok(scoreBreakdown.contextPenalty > 0, "Omission penalty should be applied");
  });

  // ── 8. Breaking news with insufficient evidence ───────────────────────────
  await t.test("8. Breaking news with insufficient evidence", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Secret bilateral summit arranged between rival heads of state next week in Geneva",
        importance: "high",
        claimType: "event",
      },
    ];

    const prepared: any[] = []; // No relevant public evidence retrieved
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "insufficient");
    assert.strictEqual(evalResult.evidenceIds.length, 0);

    const { scoreBreakdown, confidence } = calculateScore(claims, [evalResult], []);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, [evalResult], []);

    assert.strictEqual(verdict, "unverified", "Zero evidence must result in unverified");
    assert.strictEqual(confidence, "low");
  });

  // ── 9. Conflicting credible sources ───────────────────────────────────────
  await t.test("9. Conflicting credible sources", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "Foreign minister tenders resignation amid coalition policy disagreements",
        importance: "high",
        claimType: "event",
      },
    ];

    // Source A claims resignation; Source B reports ministry official refutation
    const evidence: Evidence[] = [
      {
        id: "ev-a",
        claimId: "c1",
        title: "Foreign Minister submits resignation letter to premier",
        url: "https://www.newsoutlet1.com/resignation",
        domain: "newsoutlet1.com",
        snippet: "Sources confirm the foreign minister has submitted a formal resignation citing coalition disputes.",
        publishedAt: "2023-11-01T08:00:00Z",
        sourceType: "national_news",
        sourceRelationship: "independent",
        relationship: "unknown",
        evidenceQuality: "medium",
        relevance: "direct",
      },
      {
        id: "ev-b",
        claimId: "c1",
        title: "Ministry spokesperson denies that foreign minister is stepping down",
        url: "https://www.newsoutlet2.com/denial",
        domain: "newsoutlet2.com",
        snippet: "A spokesperson denied that the foreign minister tendered resignation, calling reports premature.",
        publishedAt: "2023-11-01T09:00:00Z",
        sourceType: "wire",
        sourceRelationship: "original",
        relationship: "unknown",
        evidenceQuality: "high",
        relevance: "direct",
      },
    ];

    const prepared = prepareEvidenceForClaim("c1", evidence);
    const evalResult = await evaluateSingleClaim(claims[0], prepared);

    assert.strictEqual(evalResult.verdict, "insufficient", "Unresolved conflict should produce insufficient");
    assert.strictEqual(evalResult.confidence, "low");
  });

  // ── 10. Long pasted news message containing multiple claims ───────────────
  await t.test("10. Long pasted news message containing multiple claims", async () => {
    const claims: ClaimInput[] = [
      {
        id: "c1",
        text: "AeroTech successfully completes first unmanned orbital test flight",
        importance: "high",
        claimType: "event",
      },
      {
        id: "c2",
        text: "The spacecraft maintained stable low Earth orbit for 72 hours",
        importance: "medium",
        claimType: "factual",
      },
      {
        id: "c3",
        text: "Commercial passenger services are slated to begin in Q3 2025",
        importance: "low",
        claimType: "projection",
      },
    ];

    const evals: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Space agency and flight telemetry records confirm orbital injection success.",
        evidenceIds: ["ev-orbit-1", "ev-orbit-2"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Flight duration of 72 hours verified in tracking logs.",
        evidenceIds: ["ev-orbit-1"],
        importantNotes: [],
      },
      {
        claimId: "c3",
        verdict: "qualifying",
        confidence: "medium",
        explanation: "Passenger service is dependent on pending regulatory license approvals.",
        evidenceIds: ["ev-orbit-3"],
        importantNotes: [],
      },
    ];

    const { scoreBreakdown } = calculateScore(claims, evals, []);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evals, []);

    assert.ok(scoreBreakdown.finalScore >= 80, `Expected score >= 80, got ${scoreBreakdown.finalScore}`);
    assert.ok(verdict === "mostly_true" || verdict === "verified_true", `Expected mostly_true or verified_true, got ${verdict}`);

    const report = await buildReport(
      { title: "AeroTech Orbital Flight Report", sourceDomain: "user-pasted-claim" },
      claims,
      evals,
      []
    );

    assert.strictEqual(report.claimSummary.supporting, 2);
    assert.strictEqual(report.claimSummary.qualifying, 1);
    assert.strictEqual(report.claimSummary.contradicting, 0);
  });
});

