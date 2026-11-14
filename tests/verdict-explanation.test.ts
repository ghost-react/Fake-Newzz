import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VERDICT_EXPLANATION_CONFIG,
  generateContextualExplanation,
} from "../src/components/verification/VerdictExplanationCard";
import { VeracityVerdict } from "../src/schemas/verification";

describe("Unified Explanation System for All Verification Verdicts", () => {
  const allVerdicts: VeracityVerdict[] = [
    "verified_true",
    "mostly_true",
    "mixed",
    "misleading",
    "mostly_false",
    "false",
    "unverified",
  ];

  it("1. Baseline descriptions match required specification for all 7 verdicts", () => {
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.verified_true.baselineExplanation,
      "Strong evidence from credible sources supports the main factual claims in this report."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.mostly_true.baselineExplanation,
      "Most important claims are supported by credible evidence, although some details may need additional context."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.mixed.baselineExplanation,
      "The available evidence supports some claims but contradicts or leaves others unresolved."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.misleading.baselineExplanation,
      "Some information may be presented without important context, or the evidence suggests that the overall impression could be misleading."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.mostly_false.baselineExplanation,
      "Strong evidence contradicts most of the important factual claims, although some details may still be accurate."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.false.baselineExplanation,
      "Reliable evidence strongly contradicts the central factual claims in this report."
    );
    assert.strictEqual(
      VERDICT_EXPLANATION_CONFIG.unverified.baselineExplanation,
      "There is not enough reliable evidence to reach a confident conclusion. This does not mean the story is false."
    );
  });

  it("2. Status labels match user-facing names", () => {
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.verified_true.label, "Highly Trustworthy");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.mostly_true.label, "Mostly Trustworthy");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.mixed.label, "Mixed Evidence");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.misleading.label, "Potentially Misleading");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.mostly_false.label, "Mostly False");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.false.label, "False");
    assert.strictEqual(VERDICT_EXPLANATION_CONFIG.unverified.label, "Unable to Verify");
  });

  it("3. Contextual explanation generation derives strictly from real claim metrics", () => {
    // verified_true
    const exp1 = generateContextualExplanation(
      "verified_true",
      { total: 5, supporting: 5, contradicting: 0, qualifying: 0, insufficient: 0 },
      0,
      false
    );
    assert.match(exp1, /All 5 of 5 important factual claims are confirmed/);

    // mostly_true
    const exp2 = generateContextualExplanation(
      "mostly_true",
      { total: 5, supporting: 4, contradicting: 0, qualifying: 1, insufficient: 0 },
      0,
      false
    );
    assert.match(exp2, /4 of 5 important claims are supported/);

    // mixed
    const exp3 = generateContextualExplanation(
      "mixed",
      { total: 4, supporting: 2, contradicting: 1, qualifying: 0, insufficient: 1 },
      0,
      false
    );
    assert.match(exp3, /The evidence is divided: 2 claims are supported, and 1 conflicts with reliable evidence, and 1 remains unresolved/);

    // misleading
    const exp4 = generateContextualExplanation(
      "misleading",
      { total: 3, supporting: 2, contradicting: 0, qualifying: 1, insufficient: 0 },
      2,
      false
    );
    assert.match(exp4, /2 of 3 claims contain factual elements, but 2 material contextual omissions alter/);

    // mostly_false
    const exp5 = generateContextualExplanation(
      "mostly_false",
      { total: 4, supporting: 1, contradicting: 3, qualifying: 0, insufficient: 0 },
      0,
      false
    );
    assert.match(exp5, /3 of 4 claims conflict with reliable evidence or records, although 1 detail may be accurate/);

    // false
    const exp6 = generateContextualExplanation(
      "false",
      { total: 3, supporting: 0, contradicting: 3, qualifying: 0, insufficient: 0 },
      0,
      false
    );
    assert.match(exp6, /3 of 3 central claims conflict with verifiable evidence/);

    // unverified
    const exp7 = generateContextualExplanation(
      "unverified",
      { total: 2, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 2 },
      0,
      false
    );
    assert.match(exp7, /2 of 2 claims lack sufficient independent documentation to confirm or refute/);
  });

  it("4. Appends syndication warning when reporting relies on single wire", () => {
    const expSyndicated = generateContextualExplanation(
      "verified_true",
      { total: 3, supporting: 3, contradicting: 0, qualifying: 0, insufficient: 0 },
      0,
      true
    );
    assert.match(expSyndicated, /Several reporting outlets rely on the same original news wire/);
  });

  it("5. Handles zero claims safely without NaN or errors", () => {
    for (const v of allVerdicts) {
      const expZero = generateContextualExplanation(
        v,
        { total: 0, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 0 },
        0,
        false
      );
      assert.strictEqual(
        expZero,
        "No individual testable factual assertions were isolated from this submission."
      );
    }
  });
});

