import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decomposeLayeredClaims } from "../src/lib/verification/claimExtractor";
import { deterministicEvaluateClaim } from "../src/lib/verification/evaluateClaim";
import { PreparedEvidenceItem } from "../src/lib/verification/prepareEvidence";
import { ClaimInput } from "../src/schemas/evidence";
import { VerificationReportSchema } from "../src/schemas/verification";
import { ClaimEvaluationSchema } from "../src/schemas/evaluation";
import { calculateScore } from "../src/lib/scoring/calculateScore";
import { determineVerdictWithRule } from "../src/lib/scoring/determineVerdict";

describe("Assertion Layers Claim Extraction and Evaluation", () => {
  // ── TEST 6a: Allegation split and independent verification ─────────────────
  it("6a: Sentence with allegation, hearing event, and underlying assertion splits into distinct layers", async () => {
    const sentence = "Petitioner alleges airfares rose 700%; judge said X";

    // 1. Decompose into layered claims
    const claims = decomposeLayeredClaims(sentence, "claim-6a");
    assert.strictEqual(claims.length, 3, "Should emit 3 claims for allegation, underlying fact, and event");

    const statementClaim = claims.find((c) => c.layer === "statement_made");
    const underlyingFactClaim = claims.find((c) => c.layer === "underlying_fact");
    const eventClaim = claims.find((c) => c.layer === "event_occurred");

    assert.ok(statementClaim, "Must have a statement_made claim");
    assert.ok(underlyingFactClaim, "Must have an underlying_fact claim");
    assert.ok(eventClaim, "Must have an event_occurred claim");

    assert.strictEqual(underlyingFactClaim?.linkedClaimId, statementClaim?.id);

    // 2. Mock evidence confirming petition filing and court hearing remarks,
    // but the 700% fare rise claim is unproven and disputed
    const courtEvidence: PreparedEvidenceItem = {
      evidenceId: "ev-court-hearing",
      url: "https://court-daily.in/aviation-hearing",
      title: "Court hears plea on airfares; petitioner alleges 700% surge",
      domain: "court-daily.in",
      sourceType: "national_news",
      sourceRelationship: "independent",
      evidenceQuality: "high",
      relevance: "direct",
      publishedAt: "2026-06-12T10:00:00Z",
      snippet: "During hearing, petitioner alleges airfares rose 700%; judge said X to counsel. Airlines denied allegations and charges remain unproven pending DGCA report.",
      sourceContentExcerpt: "The petitioner submitted documents alleging fare surges. The judge said X during oral observations. Airlines submitted fare caps were maintained and allegations are unproven.",
    };

    // 3. Evaluate each claim independently
    const statementEval = deterministicEvaluateClaim(statementClaim!, [courtEvidence]);
    const eventEval = deterministicEvaluateClaim(eventClaim!, [courtEvidence]);
    const underlyingFactEval = deterministicEvaluateClaim(underlyingFactClaim!, [courtEvidence]);

    // Verifying statement_made and event_occurred should be supported
    assert.strictEqual(
      statementEval.verdict,
      "supporting",
      "Statement claim should be supported (the petitioner did make this allegation in court)"
    );

    // Underlying fact must NOT be marked supporting merely because the allegation was made
    assert.notStrictEqual(
      underlyingFactEval.verdict,
      "supporting",
      "The underlying factual proposition (700% fare surge) must NOT evaluate as supporting"
    );
    assert.ok(
      underlyingFactEval.verdict === "insufficient" || underlyingFactEval.verdict === "qualifying",
      `Expected insufficient or qualifying for unproven underlying fact, got ${underlyingFactEval.verdict}`
    );
  });

  // ── TEST 6b: Direct quote from a named public figure ───────────────────────
  it("6b: Direct quote from a named public figure yields statement_made and quote_wording layers", () => {
    const input = '"We will reduce municipal emissions by 40% before 2030" — Mayor Sarah Lin';

    const claims = decomposeLayeredClaims(input, "quote-claim");
    assert.ok(claims.length >= 2, "Must produce at least statement_made and quote_wording claims");

    const statementClaim = claims.find((c) => c.layer === "statement_made");
    const quoteWordingClaim = claims.find((c) => c.layer === "quote_wording");

    assert.ok(statementClaim, "Must contain statement_made claim");
    assert.ok(quoteWordingClaim, "Must contain quote_wording claim");
    assert.strictEqual(quoteWordingClaim?.linkedClaimId, statementClaim?.id);

    // Mock evidence confirming quote
    const mockEvidence: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-quote-news",
        url: "https://citypress.org/mayor-speech",
        title: "Mayor Sarah Lin speaks at climate summit",
        domain: "citypress.org",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: "2026-04-15T10:00:00Z",
        snippet: 'Mayor Sarah Lin said: "We will reduce municipal emissions by 40% before 2030" during the summit.',
        sourceContentExcerpt: 'Addressing delegates, Mayor Sarah Lin said: "We will reduce municipal emissions by 40% before 2030". The speech was broadcast live.',
      },
    ];

    const statementEval = deterministicEvaluateClaim(statementClaim!, mockEvidence);
    const quoteEval = deterministicEvaluateClaim(quoteWordingClaim!, mockEvidence);

    assert.strictEqual(statementEval.verdict, "supporting");
    assert.strictEqual(quoteEval.verdict, "supporting");

    // Quote authenticity alone should not be marked misleading
    const { scoreBreakdown } = calculateScore(
      [statementClaim!, quoteWordingClaim!],
      [statementEval, quoteEval],
      []
    );
    const { verdict } = determineVerdictWithRule(
      scoreBreakdown.finalScore,
      [statementClaim!, quoteWordingClaim!],
      [statementEval, quoteEval],
      []
    );

    assert.notStrictEqual(verdict, "misleading", "Genuine quote must not be marked misleading");
    assert.notStrictEqual(verdict, "false", "Genuine quote must not be marked false");
  });

  // ── TEST 6c: Police investigation and arrest ───────────────────────────────
  it("6c: 'Police arrested two people; motive is under investigation' yields event_occurred and underlying_fact", () => {
    const input = "Police arrested two people; motive is under investigation";

    const claims = decomposeLayeredClaims(input, "arrest-claim");
    assert.strictEqual(claims.length, 2);

    const eventClaim = claims.find((c) => c.layer === "event_occurred");
    const motiveClaim = claims.find((c) => c.layer === "underlying_fact");

    assert.ok(eventClaim, "Must emit an event_occurred claim for the arrest");
    assert.ok(motiveClaim, "Must emit an underlying_fact claim for the motive under investigation");
    assert.ok(eventClaim!.text.toLowerCase().includes("arrested"));
    assert.ok(motiveClaim!.text.toLowerCase().includes("investigation"));
  });

  // ── TEST 6d: Simple one-fact sentence is not split ─────────────────────────
  it("6d: Simple one-fact sentence is NOT split into multiple claims", () => {
    const input = "The Reserve Bank of India raised the benchmark repo rate by 25 basis points.";

    const claims = decomposeLayeredClaims(input, "simple-claim");
    assert.strictEqual(claims.length, 1, "Simple single-fact sentence should remain exactly 1 claim");
    assert.strictEqual(claims[0].layer, "event_occurred");
  });

  // ── TEST 6e: Backward compatibility for old stored reports without layer ───
  it("6e: Old stored reports without a layer field still parse and render cleanly", () => {
    // Legacy evaluation object without 'layer' field
    const legacyEvaluation = {
      claimId: "claim-legacy-1",
      verdict: "supporting",
      confidence: "high",
      explanation: "Official gazette confirms the regulatory amendment.",
      evidenceIds: ["ev-legacy-1"],
      importantNotes: [],
    };

    // Parse with ClaimEvaluationSchema
    const parsedEval = ClaimEvaluationSchema.parse(legacyEvaluation);
    assert.strictEqual(parsedEval.layer, "underlying_fact", "Default layer must be underlying_fact");

    // Full legacy VerificationReport without layer field
    const legacyReport = {
      articleTitle: "Cabinet approves urban transit expansion",
      sourceDomain: "nationaldaily.in",
      articleUrl: "https://nationaldaily.in/transit",
      overallTrustScore: 88,
      veracityVerdict: "verified_true",
      confidence: "high",
      summary: "All major claims are corroborated by primary government gazettes.",
      claimSummary: {
        total: 1,
        supporting: 1,
        contradicting: 0,
        qualifying: 0,
        insufficient: 0,
      },
      evaluations: [legacyEvaluation],
      omittedContext: [],
      scoreBreakdown: {
        claimScore: 90,
        contextPenalty: 0,
        confidenceAdjustment: 0,
        finalScore: 88,
      },
    };

    const parsedReport = VerificationReportSchema.parse(legacyReport);
    assert.ok(parsedReport, "Legacy report must parse cleanly");
    assert.strictEqual(
      parsedReport.evaluations[0].layer,
      "underlying_fact",
      "Legacy evaluation without layer should default to underlying_fact"
    );
  });
});

