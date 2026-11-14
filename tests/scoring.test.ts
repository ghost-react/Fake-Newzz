import test from "node:test";
import assert from "node:assert/strict";

import { ClaimInput } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import {
  calculateScore,
  calculateOverallConfidence,
} from "../src/lib/scoring/calculateScore";
import { determineVerdict } from "../src/lib/scoring/determineVerdict";
import { buildReport } from "../src/lib/verification/buildReport";
import {
  VerificationReportSchema,
  VeracityVerdict,
} from "../src/schemas/verification";

test("Phase 7 Deterministic Scoring & Verdict Mapping Test Suite", async (t) => {
  // 1. All major claims supported -> high score, verified_true / mostly_true
  await t.test("1. All major claims supported - produces high score and verified_true", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "GDP grew 3.2% in Q4", importance: "high", claimType: "statistic" },
      { id: "c2", text: "Inflation slowed to 2.1%", importance: "high", claimType: "statistic" },
      { id: "c3", text: "Unemployment held at 3.9%", importance: "medium", claimType: "statistic" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Official BEA quarterly report confirms 3.2% growth.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Labor Department CPI report confirms 2.1%.",
        evidenceIds: ["ev2"],
        importantNotes: [],
      },
      {
        claimId: "c3",
        verdict: "supporting",
        confidence: "high",
        explanation: "BLS monthly jobs report confirms 3.9%.",
        evidenceIds: ["ev3"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [];

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, omissions);
    assert.strictEqual(scoreBreakdown.claimScore, 100);
    assert.strictEqual(scoreBreakdown.contextPenalty, 0);
    assert.strictEqual(scoreBreakdown.confidenceAdjustment, 0);
    assert.strictEqual(scoreBreakdown.finalScore, 100);
    assert.strictEqual(confidence, "high");

    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);
    assert.strictEqual(verdict, "verified_true");
  });

  // 2. Major claim contradicted -> false / mostly_false depending on remaining claims
  await t.test("2. Major central claim contradicted with high confidence -> false", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "City council voted to abolish all municipal property taxes", importance: "high", claimType: "event" },
      { id: "c2", text: "Council met on Tuesday afternoon", importance: "low", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official council voting records and transcripts demonstrate council voted to study tax exemptions, not abolish property taxes.",
        evidenceIds: ["ev1"],
        importantNotes: ["Direct contradiction on core premise"],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Public calendar confirms council met on Tuesday.",
        evidenceIds: ["ev2"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);

    // Minor supported claim (#2) must not prevent the central false assertion from being labeled false
    assert.strictEqual(verdict, "false");
  });

  // 3. Supported claims + important omission -> mostly_true or misleading depending on severity
  await t.test("3. Supported claims + high-severity omission -> misleading", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "State tax revenue reached record $40 billion", importance: "high", claimType: "statistic" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Official comptroller report confirms $40B raw collection.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [
      {
        id: "om1",
        claimId: "c1",
        type: "missing_qualification",
        severity: "high",
        description: "The $40 billion includes a one-time federal COVID infrastructure transfer of $15 billion.",
        whyItMatters: "Without noting the non-recurring federal grant, readers believe recurring state tax collection expanded by 60%.",
        evidenceIds: ["ev1"],
        confidence: "high",
      },
    ];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    // high omission (15 * 1.0 = 15 penalty) -> claim score 100 - 15 = 85
    assert.strictEqual(scoreBreakdown.contextPenalty, 15);
    assert.strictEqual(scoreBreakdown.finalScore, 85);

    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);
    assert.strictEqual(verdict, "misleading");
  });

  // 4. Supported claims + medium omission -> mostly_true (not false, not misleading)
  await t.test("4. Supported claims + medium omission -> mostly_true", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "New transit line opened on Friday", importance: "high", claimType: "event" },
      { id: "c2", text: "Over 50,000 passengers rode opening weekend", importance: "medium", claimType: "statistic" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Official transit authority announcement confirms opening.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Turnstile counts verify 52,000 riders.",
        evidenceIds: ["ev2"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [
      {
        id: "om1",
        claimId: null,
        type: "missing_context",
        severity: "medium",
        description: "Fares were free during opening weekend, which temporarily boosted ridership.",
        whyItMatters: "Opening promotions typically produce larger crowds than standard fare service.",
        evidenceIds: ["ev1"],
        confidence: "high",
      },
    ];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    // Medium penalty: 8 * 1.0 = 8. Score 100 - 8 = 92
    assert.strictEqual(scoreBreakdown.contextPenalty, 8);

    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);
    assert.strictEqual(verdict, "mostly_true");
  });

  // 5. Major qualifying context -> misleading
  await t.test("5. Major qualifying context -> misleading", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Appellate court struck down the federal clean water regulation", importance: "high", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "qualifying",
        confidence: "high",
        explanation: "The court issued a temporary stay pending administrative review, but did not rule on the substantive merits or permanently invalidate the regulation.",
        evidenceIds: ["ev_court"],
        importantNotes: ["Procedural stay framed as permanent substantive invalidation"],
      },
    ];

    const omissions: Omission[] = [
      {
        id: "om_court",
        claimId: "c1",
        type: "misleading_framing",
        severity: "high",
        description: "Article frames an administrative stay as a permanent constitutional overturning.",
        whyItMatters: "Substantive legality remains undecided.",
        evidenceIds: ["ev_court"],
        confidence: "high",
      },
    ];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);
    assert.strictEqual(verdict, "misleading");
  });

  // 6. All major claims insufficient -> unverified
  await t.test("6. All major claims insufficient -> unverified with low/medium confidence", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Company secretly plans to relocate headquarters to Tokyo", importance: "high", claimType: "event" },
      { id: "c2", text: "CEO signed preliminary lease agreement last month", importance: "high", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "No regulatory filings, press statements, or corporate documents corroborate the rumor.",
        evidenceIds: ["ev_rumor"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Commercial registry searches yield no verified lease records.",
        evidenceIds: ["ev_rumor"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [];

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, omissions);
    // Insufficient evidence yields score 50 (neutral), with low confidence adjustment (-7) -> 43
    assert.strictEqual(confidence, "low");

    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);
    // Insufficient evidence must NOT be labeled "false" or "mostly_false"!
    assert.strictEqual(verdict, "unverified");
  });

  // 7. Minor contradiction should not automatically make article false
  await t.test("7. Minor peripheral contradiction - article remains mostly_true", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "NASA Rover discovered organic carbon molecules on Mars", importance: "high", claimType: "event" },
      { id: "c2", text: "Discovery was announced at 9:00 AM EST", importance: "low", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Science journal paper and NASA press release confirm the discovery.",
        evidenceIds: ["ev_nasa"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "contradicting",
        confidence: "high",
        explanation: "The press briefing occurred at 1:00 PM EST, not 9:00 AM.",
        evidenceIds: ["ev_briefing"],
        importantNotes: [],
      },
    ];

    const omissions: Omission[] = [];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);

    // Minor timing error does not make major scientific discovery article false
    assert.strictEqual(verdict, "mostly_true");
  });

  // 8. High-confidence contradiction must influence verdict strongly
  await t.test("8. High-confidence contradiction prevents contradiction hiding", () => {
    // 6 minor claims supported, but 1 major central claim contradicted
    const claims: ClaimInput[] = [
      { id: "major_1", text: "Federal bank collapsed and entered FDIC receivership", importance: "high", claimType: "event" },
      { id: "minor_1", text: "Bank was founded in 1982", importance: "low", claimType: "factual" },
      { id: "minor_2", text: "Bank operates 45 branches", importance: "low", claimType: "factual" },
      { id: "minor_3", text: "Bank headquarters are in Ohio", importance: "low", claimType: "factual" },
      { id: "minor_4", text: "Stock was halted on Friday", importance: "low", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "major_1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "FDIC and OCC statements confirm bank remains open, solvent, and NOT in receivership.",
        evidenceIds: ["ev_fdic"],
        importantNotes: ["Direct contradiction on primary assertion"],
      },
      { claimId: "minor_1", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev1"], importantNotes: [] },
      { claimId: "minor_2", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev2"], importantNotes: [] },
      { claimId: "minor_3", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev3"], importantNotes: [] },
      { claimId: "minor_4", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev4"], importantNotes: [] },
    ];

    const omissions: Omission[] = [];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, omissions);

    // The major contradiction must override minor supporting claims
    assert.notStrictEqual(verdict, "verified_true");
    assert.notStrictEqual(verdict, "mostly_true");
    assert.strictEqual(verdict === "mostly_false" || verdict === "false", true);
  });

  // 9. Duplicate omissions must not stack unlimited penalties (capped at 25)
  await t.test("9. Duplicate / many omissions - penalty strictly capped at 25", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Hospital opened new surgical wing", importance: "high", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Verified by official hospital records.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    // 5 high-severity omissions (5 * 15 = 75 raw points)
    const omissions: Omission[] = [
      { id: "o1", claimId: null, type: "missing_context", severity: "high", description: "Omission 1", whyItMatters: "Impact 1", evidenceIds: ["ev1"], confidence: "high" },
      { id: "o2", claimId: null, type: "missing_context", severity: "high", description: "Omission 2", whyItMatters: "Impact 2", evidenceIds: ["ev1"], confidence: "high" },
      { id: "o3", claimId: null, type: "missing_context", severity: "high", description: "Omission 3", whyItMatters: "Impact 3", evidenceIds: ["ev1"], confidence: "high" },
      { id: "o4", claimId: null, type: "missing_context", severity: "high", description: "Omission 4", whyItMatters: "Impact 4", evidenceIds: ["ev1"], confidence: "high" },
      { id: "o5", claimId: null, type: "missing_context", severity: "high", description: "Omission 5", whyItMatters: "Impact 5", evidenceIds: ["ev1"], confidence: "high" },
    ];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    // Context penalty must be capped at 25
    assert.strictEqual(scoreBreakdown.contextPenalty, 25);
    assert.strictEqual(scoreBreakdown.claimScore, 100);
    assert.strictEqual(scoreBreakdown.finalScore, 75); // 100 - 25 + 0
  });

  // 10. Score bounds: always 0 <= score <= 100
  await t.test("10. Score bounds - always clamped between 0 and 100", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Fabricated disaster claim", importance: "high", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Completely false",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
    ];

    // Claim score = 0, penalty = 25, adjustment = -7 -> raw = -32 -> clamped to 0
    const omissions: Omission[] = [
      { id: "o1", claimId: null, type: "missing_counter_evidence", severity: "high", description: "Omitted", whyItMatters: "Impact", evidenceIds: ["ev1"], confidence: "high" },
      { id: "o2", claimId: null, type: "missing_counter_evidence", severity: "high", description: "Omitted", whyItMatters: "Impact", evidenceIds: ["ev1"], confidence: "high" },
    ];

    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions);
    assert.strictEqual(scoreBreakdown.claimScore, 0);
    assert.strictEqual(scoreBreakdown.finalScore, 0);
    assert.strictEqual(scoreBreakdown.finalScore >= 0 && scoreBreakdown.finalScore <= 100, true);
  });

  // 11. Zero claims: no divide-by-zero
  await t.test("11. Zero claims - handled safely without NaN or divide-by-zero", () => {
    const { scoreBreakdown, confidence } = calculateScore([], [], []);
    assert.strictEqual(scoreBreakdown.claimScore, 50);
    assert.strictEqual(scoreBreakdown.contextPenalty, 0);
    assert.strictEqual(scoreBreakdown.confidenceAdjustment, -7);
    assert.strictEqual(scoreBreakdown.finalScore, 43);
    assert.strictEqual(confidence, "low");

    const verdict = determineVerdict(scoreBreakdown.finalScore, [], [], []);
    assert.strictEqual(verdict, "unverified");
  });

  // 12. No evidence: score = 50, verdict = unverified, confidence = low
  await t.test("12. No evidence - score=50 (before low adjustment), verdict=unverified, confidence=low", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Rumor with no citations", importance: "high", claimType: "event" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "No evidence found",
        evidenceIds: [], // Empty citations
        importantNotes: [],
      },
    ];

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, []);
    assert.strictEqual(confidence, "low");
    assert.strictEqual(scoreBreakdown.claimScore, 50);

    const verdict = determineVerdict(scoreBreakdown.finalScore, claims, evaluations, []);
    assert.strictEqual(verdict, "unverified");
  });

  // 13. End-to-end report generation with buildReport and Zod validation
  await t.test("13. buildReport generates strictly valid VerificationReport", async () => {
    const article = {
      title: "City Extends Electric Bus Network by 20 Miles",
      sourceDomain: "metrotransitnews.com",
    };

    const claims: ClaimInput[] = [
      { id: "c1", text: "Electric bus route expanded by 20 miles", importance: "high", claimType: "event" },
      { id: "c2", text: "15 new zero-emission buses deployed", importance: "medium", claimType: "factual" },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Department of Transportation press release confirms 20 route miles added.",
        evidenceIds: ["ev_dot"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Fleet registry shows 15 battery-electric buses delivered.",
        evidenceIds: ["ev_fleet"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(article, claims, evaluations, []);

    // Validate with Zod
    const parsed = VerificationReportSchema.parse(report);
    assert.strictEqual(parsed.articleTitle, article.title);
    assert.strictEqual(parsed.sourceDomain, article.sourceDomain);
    assert.strictEqual(parsed.overallTrustScore, 100);
    assert.strictEqual(parsed.veracityVerdict, "verified_true");
    assert.strictEqual(parsed.confidence, "high");
    assert.strictEqual(parsed.claimSummary.total, 2);
    assert.strictEqual(parsed.claimSummary.supporting, 2);
    assert.strictEqual(parsed.claimSummary.contradicting, 0);
    assert.strictEqual(parsed.summary.length > 10, true);
  });
});

