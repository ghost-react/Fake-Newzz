import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectStatementIntent,
  decomposeStatementClaims,
} from "../src/lib/verification/statementIntent";
import { generateSearchQueries } from "../src/lib/search/searchClaims";
import { deterministicEvaluateClaim } from "../src/lib/verification/evaluateClaim";
import { determineVerdictWithRule } from "../src/lib/scoring/determineVerdict";
import { PreparedEvidenceItem } from "../src/lib/verification/prepareEvidence";
import { ClaimInput } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";

describe("Statement Attribution & Quoted Speech Verification", () => {
  // ── TEST 1: Primary Regression Test (Samrat Choudhary Quote) ─────────────────
  it("Regression: 'Humare yaha apraadh nhi h crime h' — Samrat Choudhary is recognized and evaluated faithfully", () => {
    const input = '"Humare yaha apraadh nhi h crime h" — Samrat Choudhary';

    // 1. Detect Statement Intent
    const intent = detectStatementIntent(input);
    assert.equal(intent.isAttributedStatement, true);
    assert.equal(intent.speaker, "Samrat Choudhary");
    assert.equal(intent.quote, "Humare yaha apraadh nhi h crime h");
    assert.equal(intent.isExactQuote, true);
    assert.equal(intent.hasTransliteration, true);

    // 2. Decompose into distinct claims
    const claims = decomposeStatementClaims(input, "sc-claim");
    assert.equal(claims.length, 3);

    const [attrClaim, factualClaim, interpClaim] = claims;
    assert.equal(attrClaim.claimType, "statement_attribution");
    assert.equal(attrClaim.importance, "high");
    assert.ok(attrClaim.text.includes("Samrat Choudhary"));
    assert.ok(attrClaim.text.includes("Humare yaha apraadh nhi h crime h"));

    assert.equal(factualClaim.claimType, "factual_proposition");
    assert.equal(interpClaim.claimType, "quotation_accuracy");

    // 3. Search query generation includes speaker and distinctive quote tokens
    const queries = generateSearchQueries(attrClaim);
    assert.ok(queries.some((q) => q.includes("Samrat Choudhary") && q.includes("apraadh")));

    // 4. Mock evidence from credible news reports confirming the remark was made on Nov 3, 2026
    const mockEvidence: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-news-1",
        url: "https://www.ndtv.com/india-news/samrat-choudhary-crime-remark",
        title: "Samrat Choudhary remarks on crime in Bihar: 'Humare yaha apraadh nhi h crime h'",
        snippet: "Bihar Deputy CM Samrat Choudhary on November 3 said during an event: Humare yaha apraadh nhi h crime h, sparking reactions across political parties.",
        domain: "ndtv.com",
        sourceType: "national_news",
        sourceRelationship: "independent",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: "2026-11-03T10:00:00Z",
      },
      {
        evidenceId: "ev-news-2",
        url: "https://timesofindia.indiatimes.com/india/samrat-choudhary-speech",
        title: "Humare yaha apraadh nahi hai crime hai: Samrat Choudhary video goes viral",
        snippet: "In a video statement from Nov 3, 2026, BJP leader Samrat Choudhary uttered the controversial phrase about Bihar law and order.",
        domain: "timesofindia.indiatimes.com",
        sourceType: "national_news",
        sourceRelationship: "independent",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: "2026-11-03T11:00:00Z",
      },
    ];

    // 5. Evaluate attribution
    const evalAttr = deterministicEvaluateClaim(attrClaim, mockEvidence);
    assert.equal(evalAttr.verdict, "supporting");
    assert.ok(evalAttr.explanation.includes("The available reporting corroborates that this statement was made"));
    assert.ok(evalAttr.evidenceIds.includes("ev-news-1"));

    // 6. Evaluate factual proposition independently
    // Suppose crime data in Bihar is contested or has official statistics
    const crimeEvidence: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-ncrb-1",
        url: "https://ncrb.gov.in/bihar-crime-data",
        title: "NCRB Bihar Crime Statistics Report",
        snippet: "National Crime Records Bureau published official crime numbers for Bihar registered cases under Indian Penal Code.",
        domain: "ncrb.gov.in",
        sourceType: "official",
        sourceRelationship: "original",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: null,
      },
    ];
    const evalFactual = deterministicEvaluateClaim(factualClaim, crimeEvidence);
    assert.notEqual(evalFactual.verdict, "contradicting");

    // 7. Ensure verdict does NOT trigger false misleading override for the authentic statement
    const { verdict } = determineVerdictWithRule(
      78,
      claims,
      [
        evalAttr,
        evalFactual,
        {
          claimId: interpClaim.id,
          verdict: "supporting",
          confidence: "medium",
          explanation: "Quotation reflects reported speech in context.",
          evidenceIds: ["ev-news-1"],
          importantNotes: [],
        },
      ],
      []
    );

    // Authentic statement must NOT be marked "misleading" merely due to paradoxical literal words
    assert.notEqual(verdict, "misleading");
    assert.ok(verdict === "mostly_true" || verdict === "verified_true");
  });

  // ── TEST 2: Generic Quote by Another Public Figure ────────────────────────────
  it("Generic: Correctly parses and evaluates an official policy quote by a different public figure", () => {
    const input = 'Elena Rostova: "We will allocate 40% of renewable funding to grid storage."';

    const intent = detectStatementIntent(input);
    assert.equal(intent.isAttributedStatement, true);
    assert.equal(intent.speaker, "Elena Rostova");
    assert.ok(intent.quote?.includes("40% of renewable funding"));

    const claims = decomposeStatementClaims(input, "gen-claim");
    assert.equal(claims[0].claimType, "statement_attribution");
    assert.equal(claims[1].claimType, "factual_proposition");

    const mockEv: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-press-1",
        url: "https://energy.gov/news/rostova-announcement",
        title: "Minister Elena Rostova announces 40% renewable funding for grid storage",
        snippet: "At the summit, Elena Rostova confirmed: 'We will allocate 40% of renewable funding to grid storage.'",
        domain: "energy.gov",
        sourceType: "official",
        sourceRelationship: "original",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: null,
      },
    ];

    const evalRes = deterministicEvaluateClaim(claims[0], mockEv);
    assert.equal(evalRes.verdict, "supporting");
    assert.equal(evalRes.confidence, "high");
    assert.ok(evalRes.explanation.includes("corroborates that this statement was made"));
  });

  // ── TEST 3: Paraphrased Speech Attribution ──────────────────────────────────
  it("Paraphrase: Detects and decomposes an attributed paraphrase without quotation marks", () => {
    const input = "Governor Hayes stated that flood defense barriers had exceeded design thresholds";

    const intent = detectStatementIntent(input);
    assert.equal(intent.isAttributedStatement, true);
    assert.equal(intent.speaker, "Governor Hayes");
    assert.equal(intent.isParaphrase, true);
    assert.equal(intent.isExactQuote, false);

    const claims = decomposeStatementClaims(input, "para-claim");
    assert.equal(claims.length, 3);
    assert.equal(claims[0].claimType, "statement_attribution");
    assert.equal(claims[2].claimType, "interpretation");
  });

  // ── TEST 4: Falsely Attributed Quote (Contradicted Attribution) ──────────────
  it("Falsely Attributed Quote: Contradicts attribution when fact-checkers report false attribution", () => {
    const input = '"I never supported expanding nuclear energy in 2024" — Senator Marcus Vance';

    const claims = decomposeStatementClaims(input, "fake-attr");
    const attrClaim = claims[0];

    const mockEvidence: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-fc-1",
        url: "https://factcheck.afp.com/fake-quote-marcus-vance",
        title: "Fabricated quote falsely attributed to Senator Marcus Vance",
        snippet: "A viral post claims Marcus Vance said he never supported nuclear expansion. This is a fabricated quote; transcripts show he repeatedly voted for it.",
        domain: "factcheck.afp.com",
        sourceType: "fact_check",
        sourceRelationship: "independent",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: null,
      },
    ];

    const evalRes = deterministicEvaluateClaim(attrClaim, mockEvidence);
    assert.equal(evalRes.verdict, "contradicting");
    assert.equal(evalRes.confidence, "high");
    assert.ok(evalRes.explanation.includes("refute this quotation as falsely attributed"));
  });

  // ── TEST 5: Genuine Quote with False Factual Claim ──────────────────────────
  it("Genuine Quote with False Claim: Confirms statement authenticity while independently refuting factual content", () => {
    const input = '"Inflation in our country is currently zero percent" — President Donald Smith';

    const claims = decomposeStatementClaims(input, "auth-false");
    const [attrClaim, factualClaim] = claims;

    // 1. Evidence that the president genuinely uttered the quote during a speech
    const speechEv: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-whitehouse-1",
        url: "https://reuters.com/world/president-donald-smith-inflation-remark",
        title: "President Donald Smith remarks on economy: 'Inflation is currently zero percent'",
        snippet: "In his address to business leaders, President Donald Smith said: 'Inflation in our country is currently zero percent.'",
        domain: "reuters.com",
        sourceType: "wire",
        sourceRelationship: "original",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: null,
      },
    ];

    const evalAttr = deterministicEvaluateClaim(attrClaim, speechEv);
    assert.equal(evalAttr.verdict, "supporting");
    assert.ok(evalAttr.explanation.includes("corroborates that this statement was made"));

    // 2. Official economic data refuting the 0% claim (factual proposition is false)
    const econEv: PreparedEvidenceItem[] = [
      {
        evidenceId: "ev-stat-1",
        url: "https://bls.gov/cpi-latest",
        title: "Bureau of Labor Statistics: Consumer Price Index",
        snippet: "The Consumer Price Index increased by 3.2% year-over-year. Claims that inflation is at zero percent are disproven by official monthly figures.",
        domain: "bls.gov",
        sourceType: "official",
        sourceRelationship: "original",
        sourceContentExcerpt: null,
        relevance: "direct",
        evidenceQuality: "high",
        publishedAt: null,
      },
    ];

    const evalFactual = deterministicEvaluateClaim(factualClaim, econEv);
    assert.equal(evalFactual.verdict, "contradicting");

    // 3. Overall verdict: Because central factual claim is contradicted, system should NOT assign "verified_true"
    const { verdict } = determineVerdictWithRule(
      45,
      claims,
      [evalAttr, evalFactual],
      []
    );

    // The fact that the quote was authentically spoken does NOT make the false factual claim true!
    assert.notEqual(verdict, "verified_true");
    assert.ok(verdict === "mostly_false" || verdict === "mixed" || verdict === "misleading");
  });

  // ── TEST 6: Non-Statement Input Preserved Unchanged ──────────────────────────
  it("Preserves regular news input without altering single-claim behavior", () => {
    const standardInput = "Ministry of Health announces new vaccination guidelines for rural clinics";

    const intent = detectStatementIntent(standardInput);
    assert.equal(intent.isAttributedStatement, false);
    assert.equal(intent.speaker, null);

    const claims = decomposeStatementClaims(standardInput, "std-claim");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].claimType, "factual");
    assert.equal(claims[0].text, standardInput);
  });

  // ── TEST 7: Bidirectional Colon Attribution (Quote: Speaker & Speaker: Quote) ──
  it("Bidirectional colon attribution correctly parses 'Quote: Speaker' and 'Speaker: Quote'", () => {
    // 1. Quote: Speaker (e.g. "PM Modi got my phone tapped: Rahul Gandhi")
    const quoteFirst = "PM Modi got my phone tapped: Rahul Gandhi";
    const intent1 = detectStatementIntent(quoteFirst);
    assert.equal(intent1.isAttributedStatement, true);
    assert.equal(intent1.speaker, "Rahul Gandhi");
    assert.equal(intent1.quote, "PM Modi got my phone tapped");

    const claims1 = decomposeStatementClaims(quoteFirst, "q1");
    assert.equal(claims1[0].claimType, "statement_attribution");
    assert.equal(claims1[0].layer, "statement_made");
    assert.ok(claims1[0].text.includes("Rahul Gandhi made the public statement: \"PM Modi got my phone tapped\""));
    assert.equal(claims1[1].layer, "underlying_fact");
    assert.ok(claims1[1].text.includes("PM Modi got my phone tapped"));

    // 2. Speaker: Quote (e.g. "Rahul Gandhi: PM Modi got my phone tapped")
    const speakerFirst = "Rahul Gandhi: PM Modi got my phone tapped";
    const intent2 = detectStatementIntent(speakerFirst);
    assert.equal(intent2.isAttributedStatement, true);
    assert.equal(intent2.speaker, "Rahul Gandhi");
    assert.equal(intent2.quote, "PM Modi got my phone tapped");

    // 3. Quoted variants
    const quotedFirst = '"Truth has won": Arvind Kejriwal';
    const intent3 = detectStatementIntent(quotedFirst);
    assert.equal(intent3.isAttributedStatement, true);
    assert.equal(intent3.speaker, "Arvind Kejriwal");
    assert.equal(intent3.quote, "Truth has won");
    assert.equal(intent3.isExactQuote, true);
  });
});

