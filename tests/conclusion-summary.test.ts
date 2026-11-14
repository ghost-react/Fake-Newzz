import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { determineConclusion } from "../src/lib/verification/conclusion";
import {
  generateSummary,
  generateTemplatedSummary,
  validateSummary,
} from "../src/lib/verification/generateSummary";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { ComparisonReport } from "../src/schemas/comparison";

describe("Story Summary and Conclusion Test Suite", () => {
  // ─── a. 100-gate pass gives True; one unresolved detail gives Mostly true ──────
  it("a. 100-gate pass gives True; one unresolved detail gives Mostly true", () => {
    // 1. 100-gate pass -> True
    const gate100PassInput = {
      veracityVerdict: "verified_true" as const,
      overallTrustScore: 100,
      gate100Result: {
        canReach100: true,
        failedConditions: [],
        allowedMaxScore: 100,
      },
      verifiedTrue: true,
      claims: [
        { id: "c1", text: "Parliament passed budget", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Official gazette",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      independentClustersCount: 3,
    };

    const conclusionTrue = determineConclusion(gate100PassInput);
    assert.strictEqual(conclusionTrue.label, "True");
    assert.ok(conclusionTrue.reasonCodes.includes("GATE_100_PASSED"));

    // 2. One unresolved detail -> Mostly true
    const oneUnresolvedDetailInput = {
      veracityVerdict: "verified_true" as const,
      overallTrustScore: 92,
      gate100Result: {
        canReach100: false,
        failedConditions: [
          {
            code: "NO_DETAIL_VARIATION",
            condition: "Zero variation",
            details: "1 casualty variation",
          },
        ],
        allowedMaxScore: 95,
      },
      comparison: {
        claims: [
          {
            claimId: "c1",
            independentClusterCount: 3,
            agreementSummary: "strong" as const,
            conflicts: [],
            dimensions: [
              {
                dimension: "numbers" as const,
                outcome: "detail_variation" as const,
                articleValue: "50",
                sourceValues: [{ clusterId: "cl-1", evidenceId: "ev-1", value: "48" }],
              },
            ],
          },
        ],
        totalIndependentClusters: 3,
        totalConflicts: 0,
        totalUnresolvedDimensions: 1,
        coverageLimited: false,
      },
      claims: [
        { id: "c1", text: "Bridge inaugurated with 50 guests", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Supported with minor count variation",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      independentClustersCount: 3,
    };

    const conclusionMostlyTrue = determineConclusion(oneUnresolvedDetailInput);
    assert.strictEqual(conclusionMostlyTrue.label, "Mostly true");
    assert.ok(conclusionMostlyTrue.reasonCodes.includes("ONE_UNRESOLVED_DETAIL"));
  });

  // ─── b. A rumour story with credible reports gives Unconfirmed, not False ─────
  it("b. A rumour story with credible reports gives Unconfirmed, not False", () => {
    const rumourInput = {
      veracityVerdict: "unverified" as const,
      overallTrustScore: 40,
      storyStatus: "unconfirmed_reports" as const,
      claims: [
        {
          id: "c1",
          text: "Social media rumours swirl that celebrity hospitalized",
          importance: "high" as const,
          certainty: "reported_claim" as const,
          layer: "statement_made" as const,
        },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "insufficient" as const,
          confidence: "low" as const,
          explanation: "Hospital spokesperson has not confirmed the rumour",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      comparison: {
        claims: [],
        totalIndependentClusters: 2,
        totalConflicts: 0,
        totalUnresolvedDimensions: 0,
        coverageLimited: false,
      },
      independentClustersCount: 2,
    };

    const conclusion = determineConclusion(rumourInput);
    assert.strictEqual(conclusion.label, "Unconfirmed");
    assert.notStrictEqual(conclusion.label, "False");
    assert.ok(conclusion.reasonCodes.includes("RUMOUR_WITH_CREDIBLE_REPORTS"));
  });

  // ─── c. A contradicted central claim gives False ─────────────────────────────
  it("c. A contradicted central claim gives False", () => {
    const centralContradictedInput = {
      veracityVerdict: "false" as const,
      overallTrustScore: 12,
      claims: [
        {
          id: "c1",
          text: "Finance minister resigns amid economic turmoil",
          importance: "high" as const,
          certainty: "asserted_fact" as const,
          layer: "event_occurred" as const,
        },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "contradicting" as const,
          confidence: "high" as const,
          explanation: "Prime minister office released official denial confirming minister in active office",
          evidenceIds: ["ev1", "ev2"],
          importantNotes: [],
        },
      ],
      independentClustersCount: 3,
    };

    const conclusion = determineConclusion(centralContradictedInput);
    assert.strictEqual(conclusion.label, "False");
    assert.ok(conclusion.reasonCodes.includes("HIGH_IMPORTANCE_CLAIM_CONTRADICTED"));
  });

  // ─── d. Summary never contains a number or name absent from the report data ───
  it("d. Summary never contains a number or name absent from the report data", () => {
    const baseInput = {
      article: {
        title: "Supreme Court Reviews Election Petition",
        sourceDomain: "reuters.com",
      },
      claims: [
        { id: "c1", text: "Supreme Court reviews election petition with 3 judges", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Bench of 3 judges heard arguments",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omissions: [],
      score: 90,
      veracityVerdict: "verified_true" as const,
      confidence: "high" as const,
      conclusion: {
        label: "Mostly true" as const,
        explanation: "Core hearing verified",
        reasonCodes: ["CORE_EVENT"],
      },
    };

    // 1. Hallucinated number (e.g. "99999") fails validation
    const invalidNumberSummary =
      "The Supreme Court reviewed the petition. Independent sources confirm 99999 attendees were present. In conclusion, mostly true.";
    const numValidation = validateSummary(invalidNumberSummary, baseInput);
    assert.strictEqual(numValidation.isValid, false);
    assert.ok(numValidation.reason?.includes("99999"));

    // 2. Hallucinated proper name (e.g. "Bartholomew") fails validation
    const invalidNameSummary =
      "The Supreme Court reviewed the petition. Bartholomew announced the verdict. In conclusion, mostly true.";
    const nameValidation = validateSummary(invalidNameSummary, baseInput);
    assert.strictEqual(nameValidation.isValid, false);
    assert.ok(nameValidation.reason?.includes("Bartholomew"));

    // 3. Deterministic templated summary passes validation cleanly
    const templated = generateTemplatedSummary(baseInput);
    const validCheck = validateSummary(templated, baseInput);
    assert.strictEqual(validCheck.isValid, true);
  });

  // ─── e. Summary and conclusion label never contradict ─────────────────────────
  it("e. Summary and conclusion label never contradict", () => {
    const falseInput = {
      article: {
        title: "False Medical Cure",
        sourceDomain: "fakenews.example",
      },
      claims: [
        { id: "c1", text: "Lemon juice cures acute illness", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "contradicting" as const,
          confidence: "high" as const,
          explanation: "Health agencies refute claim",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omissions: [],
      score: 10,
      veracityVerdict: "false" as const,
      confidence: "high" as const,
      conclusion: {
        label: "False" as const,
        explanation: "Refuted claim",
        reasonCodes: ["CONTRADICTED"],
      },
    };

    // Summary claiming it is true contradicts conclusion label "False"
    const contradictorySummary =
      "The story reports a medical cure. Independent evidence confirms all claims are true. It is fully accurate.";
    const val = validateSummary(contradictorySummary, falseInput);
    assert.strictEqual(val.isValid, false);
    assert.ok(val.reason?.includes("conclusion label"));

    // Templated summary strictly agrees with "False"
    const templated = generateTemplatedSummary(falseInput);
    assert.ok(templated.includes("false"));
    assert.strictEqual(validateSummary(templated, falseInput).isValid, true);
  });

  // ─── f. Unreadable-article summary includes the basis note ───────────────────
  it("f. Unreadable-article summary includes the basis note", () => {
    const unreadableInput = {
      article: {
        title: "Blocked Publisher Article",
        sourceDomain: "blocked.com",
      },
      claims: [
        { id: "c1", text: "Transit authority updates subway fares", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Corroborated by independent wires",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omissions: [],
      score: 85,
      veracityVerdict: "mostly_true" as const,
      confidence: "medium" as const,
      sourceReadStatus: "unreadable",
      isUnreadable: true,
      conclusion: {
        label: "Mostly true" as const,
        explanation: "Verified by independent reporting",
        reasonCodes: ["INDEPENDENT_EVIDENCE"],
      },
    };

    const summary = generateTemplatedSummary(unreadableInput);
    assert.ok(
      summary.includes("independent reporting of the same story"),
      "Must state that check is based on independent reporting of the same story"
    );
    const val = validateSummary(summary, unreadableInput);
    assert.strictEqual(val.isValid, true);
  });

  // ─── g. Fallback template is used when validation fails twice ─────────────────
  it("g. Fallback template is used when validation fails twice", async () => {
    const input = {
      article: {
        title: "City Council Passes Zoning Law",
        sourceDomain: "localnews.com",
      },
      claims: [
        { id: "c1", text: "City council approved zoning law yesterday", importance: "high" as const },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Official records match",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omissions: [],
      score: 95,
      veracityVerdict: "verified_true" as const,
      confidence: "high" as const,
      conclusion: {
        label: "Mostly true" as const,
        explanation: "Zoning law verified",
        reasonCodes: ["VERIFIED"],
      },
      // Generator intentionally outputs an invalid summary with a forbidden number
      customGenerator: async () =>
        "The city council passed the law. 888888 residents protested. Mostly true.",
    };

    const result = await generateSummary(input);
    // Because the custom generator introduced 888888 which fails validation,
    // generateSummary falls back to the deterministic templated summary
    assert.ok(!result.includes("888888"));
    assert.ok(result.includes("In conclusion, the story is mostly true"));
  });

  // ─── h. Existing scores and verdicts are unchanged ────────────────────────────
  it("h. Existing scores and verdicts are unchanged", async () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Cabinet approved defense purchase", importance: "high", layer: "event_occurred", claimType: "factual" },
      { id: "c2", text: "Budget allocation stands at standard limit", importance: "medium", layer: "underlying_fact", claimType: "factual" },
    ];

    const evaluations: ClaimEvaluation[] = [
      { claimId: "c1", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev1"], importantNotes: [] },
      { claimId: "c2", verdict: "supporting", confidence: "high", explanation: "Verified", evidenceIds: ["ev2"], importantNotes: [] },
    ];

    const report = await buildReport(
      {
        title: "Cabinet Approves Defense Budget",
        sourceDomain: "defensejournal.org",
      },
      claims,
      evaluations,
      []
    );

    assert.ok(report !== null);
    assert.strictEqual(typeof report.overallTrustScore, "number");
    assert.ok(report.overallTrustScore >= 0 && report.overallTrustScore <= 100);
    assert.strictEqual(report.veracityVerdict, "verified_true");
    assert.ok(report.conclusion !== undefined, "Report must store conclusion");
    assert.ok(report.conclusion.label.length > 0);
    assert.ok(Array.isArray(report.conclusion.reasonCodes));
  });

  // ─── i. Summary deduplicates sentence A and B and never repeats identical claim text ───
  it("i. Summary deduplicates sentence A and B and never repeats identical claim text", () => {
    const input = {
      article: {
        title: "PM Modi got my phone tapped: Rahul Gandhi",
        sourceDomain: "ndtv.com",
      },
      claims: [
        {
          id: "c1",
          text: 'Rahul Gandhi made the public statement: "PM Modi got my phone tapped"',
          importance: "high" as const,
          layer: "statement_made" as const,
          certainty: "reported_claim" as const,
        },
      ],
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Public statement verified by news reports",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omissions: [],
      score: 60,
      veracityVerdict: "mostly_true" as const,
      confidence: "medium" as const,
      conclusion: {
        label: "Unconfirmed" as const,
        explanation: "Statement corroborated, underlying wiretapping assertion unverified",
        reasonCodes: ["RUMOUR_WITH_CREDIBLE_REPORTS"],
      },
    };

    const summary = generateTemplatedSummary(input);
    // Must NOT repeat "PM Modi got my phone tapped: Rahul Gandhi" twice
    const occurrences = (summary.match(/PM Modi got my phone tapped/g) || []).length;
    assert.ok(occurrences <= 1, `Expected at most 1 occurrence of quote, found ${occurrences}`);
    assert.ok(
      summary.includes("public statement was made") ||
      summary.includes("corroborate these core assertions"),
      "Must generate natural non-duplicative confirmation phrasing"
    );
  });
});

