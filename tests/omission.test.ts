import test from "node:test";
import assert from "node:assert/strict";

import {
  Omission,
  OmissionSchema,
  OmissionResultSchema,
  AnalyzeContextRequestSchema,
} from "../src/schemas/omission";
import { Article } from "../src/schemas/article";
import { Evidence, ClaimInput } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import {
  validateSingleOmission,
  deduplicateOmissions,
} from "../src/lib/verification/validateOmissions";
import {
  analyzeArticleContext,
  prioritizeClaimsForOmissionAnalysis,
} from "../src/lib/verification/contextAnalysis";

test("Phase 6 Material Context & Omission Analysis Test Suite", async (t) => {
  // Shared mock article
  const mockArticle: Article = {
    url: "https://example.com/reports/crime-economic-analysis",
    sourceDomain: "example.com",
    title: "City Crime Spikes 40% Under New Administration",
    description: null,
    author: "Staff Reporter",
    publishedAt: "2026-03-10T12:00:00Z",
    featuredImage: null,
    content:
      "A new municipal report shows city crime increased by 40% over the last calendar year. Officials celebrate progress in other areas, but the 40% jump has sparked public outcry. Court rulings have also gone against major tech companies in the region.",
    wordCount: 42,
  };

  // 1. Omission Schema Validation: Valid types
  await t.test("1. Omission schema validation - valid types accepted", () => {
    const validOmission: Omission = {
      id: "omission_1",
      claimId: "claim_101",
      type: "missing_context",
      severity: "high",
      description: "The 40% crime increase is calculated from an abnormally low lockdown baseline period.",
      whyItMatters: "Without the baseline period, readers assume crime surged beyond historical norms when it remains below pre-pandemic levels.",
      evidenceIds: ["ev_101"],
      confidence: "high",
    };

    const parsed = OmissionSchema.parse(validOmission);
    assert.strictEqual(parsed.type, "missing_context");
    assert.strictEqual(parsed.severity, "high");
    assert.strictEqual(parsed.confidence, "high");
    assert.strictEqual(parsed.evidenceIds.length, 1);
  });

  // 2. Omission Schema: Reject invalid types
  await t.test("2. Omission schema validation - invalid types rejected", () => {
    const invalidOmission = {
      id: "omission_invalid",
      claimId: "claim_1",
      type: "political_bias", // Invalid type
      severity: "high",
      description: "Biased reporting",
      whyItMatters: "Biased",
      evidenceIds: ["ev_1"],
      confidence: "high",
    };

    assert.throws(() => {
      OmissionSchema.parse(invalidOmission);
    });
  });

  // 3. Omission Schema: Empty evidenceIds rejected
  await t.test("3. Omission schema validation - empty evidenceIds rejected", () => {
    const missingEvidenceOmission = {
      id: "omission_no_ev",
      claimId: "claim_1",
      type: "missing_context",
      severity: "medium",
      description: "Missing context",
      whyItMatters: "Matters",
      evidenceIds: [], // Empty evidenceIds must be rejected
      confidence: "medium",
    };

    assert.throws(() => {
      OmissionSchema.parse(missingEvidenceOmission);
    });
  });

  // 4. Traceability: Non-existent evidence ID rejected
  await t.test("4. Traceability validation - rejects non-existent evidence IDs", () => {
    const validEvMap = new Map<string, Evidence>();
    validEvMap.set("ev_real_1", {
      id: "ev_real_1",
      claimId: "claim_1",
      title: "Official Baseline Statistics",
      url: "https://stats.gov/crime-baseline",
      domain: "stats.gov",
      snippet: "2020 lockdowns created an abnormal 50-year low comparison baseline.",
      sourceRelationship: "original",
      relationship: "qualifying",
      sourceType: "official",
      evidenceQuality: "high",
      relevance: "direct",
      publishedAt: null
    });

    const validClaimMap = new Map<string, ClaimInput>();
    validClaimMap.set("claim_1", {
      id: "claim_1",
      text: "City crime increased by 40%",
      importance: "high",
      claimType: "statistic",
      layer: "event_occurred",
      certainty: "asserted_fact"
    });

    const omissionWithFabricatedEv: Omission = {
      id: "om_fab",
      claimId: "claim_1",
      type: "missing_context",
      severity: "high",
      description: "Missing baseline context",
      whyItMatters: "Changes statistical interpretation",
      evidenceIds: ["ev_fabricated_999"],
      confidence: "high",
    };

    const result = validateSingleOmission(omissionWithFabricatedEv, new Set(validEvMap.keys()), new Set(validClaimMap.keys()));
    assert.strictEqual(result.isValid, false, "Omission with fabricated evidence ID must be rejected");
  });

  // 5. Traceability: Valid evidence ID accepted and filtered
  await t.test("5. Traceability validation - accepts verified evidence IDs and drops unknown ones", () => {
    const validEvMap = new Map<string, Evidence>();
    validEvMap.set("ev_real_1", {
      id: "ev_real_1",
      claimId: "claim_1",
      title: "Official Baseline Statistics",
      url: "https://stats.gov/crime-baseline",
      domain: "stats.gov",
      snippet: "2020 lockdowns created an abnormal low baseline.",
      sourceRelationship: "original",
      relationship: "qualifying",
      sourceType: "official",
      evidenceQuality: "high",
      relevance: "direct",
      publishedAt: null
    });

    const validClaimMap = new Map<string, ClaimInput>();
    validClaimMap.set("claim_1", {
      id: "claim_1",
      text: "City crime increased by 40%",
      importance: "high",
      claimType: "statistic",
      layer: "event_occurred",
      certainty: "asserted_fact"
    });

    // validateSingleOmission rejects outright if ANY evidenceId is invalid,
    // so test with only the valid ID
    const omissionWithValidEv: Omission = {
      id: "om_valid",
      claimId: "claim_1",
      type: "missing_context",
      severity: "high",
      description: "The 40% increase is calculated from a pandemic lockdown baseline.",
      whyItMatters: "Changes statistical interpretation",
      evidenceIds: ["ev_real_1"],
      confidence: "high",
    };

    const result = validateSingleOmission(omissionWithValidEv, new Set(validEvMap.keys()), new Set(validClaimMap.keys()));
    assert.strictEqual(result.isValid, true);
    assert.ok(result.isValid && result.omission.evidenceIds.includes("ev_real_1"));
  });

  // 6. Deduplication: Merges identical omissions and combines evidence IDs
  await t.test("6. Deduplication - combines duplicate omissions and merges evidence IDs", () => {
    const omissions: Omission[] = [
      {
        id: "om_1",
        claimId: "claim_1",
        type: "missing_context",
        severity: "high",
        description: "The reported crime increase omits the lockdown baseline period.",
        whyItMatters: "Readers cannot accurately assess whether crime is historically elevated.",
        evidenceIds: ["ev_1"],
        confidence: "high",
      },
      {
        id: "om_2",
        claimId: "claim_1",
        type: "missing_context",
        severity: "high",
        description: "The reported crime increase omits the lockdown baseline period.",
        whyItMatters: "Readers cannot accurately assess whether crime is historically elevated.",
        evidenceIds: ["ev_2"],
        confidence: "high",
      },
    ];

    const deduplicated = deduplicateOmissions(omissions);
    assert.strictEqual(deduplicated.length, 1);
    assert.deepStrictEqual(deduplicated[0].evidenceIds.sort(), ["ev_1", "ev_2"]);
  });

  // 7. Claim Prioritization: Contradicting & qualifying claims prioritized first
  await t.test("7. Claim prioritization - prioritizes contradicting/qualifying over supporting claims", () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_sup", text: "Mayor held a press conference", importance: "medium", claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
      {
        id: "claim_contra", text: "Crime increased by 40%", importance: "high", claimType: "statistic",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
      {
        id: "claim_qual", text: "Court ruled against Company X", importance: "high", claimType: "legal",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_sup",
        verdict: "supporting",
        confidence: "high",
        explanation: "Press conference confirmed",
        evidenceIds: ["ev_1"],
        importantNotes: [],
        layer: "event_occurred"
      },
      {
        claimId: "claim_contra",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Calculated from invalid baseline",
        evidenceIds: ["ev_2"],
        importantNotes: ["Baseline anomaly"],
        layer: "event_occurred"
      },
      {
        claimId: "claim_qual",
        verdict: "qualifying",
        confidence: "high",
        explanation: "Procedural ruling only",
        evidenceIds: ["ev_3"],
        importantNotes: [],
        layer: "event_occurred"
      },
    ];

    const prioritized = prioritizeClaimsForOmissionAnalysis(claims, evaluations);
    assert.strictEqual(prioritized[0].claim.id, "claim_contra");
    assert.strictEqual(prioritized[1].claim.id, "claim_qual");
    assert.strictEqual(prioritized[2].claim.id, "claim_sup");
  });

  // 8. Scenario: Valid baseline omission (missing_context, high severity)
  await t.test("8. Context Analysis - detects statistical baseline omission (missing_context)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_crime", text: "Crime increased 40%", importance: "high", claimType: "statistic",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_crime_baseline",
        claimId: "claim_crime",
        title: "Bureau of Justice Statistics Annual Report",
        url: "https://bjs.gov/annual-crime-report",
        domain: "bjs.gov",
        snippet: "The 40% single-year rise was measured from 2020 pandemic restrictions when overall crime fell to a 60-year low.",
        sourceRelationship: "original",
        relationship: "qualifying",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: null
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_crime",
        verdict: "qualifying",
        confidence: "high",
        explanation: "The statistic is accurate on paper but measures against an anomalous lockdown trough.",
        evidenceIds: ["ev_crime_baseline"],
        importantNotes: ["Lockdown baseline comparison artificially inflates trend"],
        layer: "event_occurred"
      },
    ];

    // Mock detector simulating LLM identifying missing baseline context
    const mockDetector = async () => [
      {
        id: "om_crime_1",
        claimId: "claim_crime",
        type: "missing_context" as const,
        severity: "high" as const,
        description: "The article presents a 40% crime surge without mentioning that the baseline period was an anomalous lockdown trough.",
        whyItMatters: "The comparison baseline fundamentally alters whether this represents a historic crime wave or a partial return to pre-pandemic averages.",
        evidenceIds: ["ev_crime_baseline"],
        confidence: "high" as const,
      },
    ];

    const omissions = await analyzeArticleContext(
      mockArticle,
      claims,
      evidence,
      evaluations,
      { customDetector: mockDetector }
    );

    assert.strictEqual(omissions.length, 1);
    assert.strictEqual(omissions[0].type, "missing_context");
    assert.strictEqual(omissions[0].severity, "high");
    assert.strictEqual(omissions[0].evidenceIds[0], "ev_crime_baseline");
  });

  // 9. Scenario: Valid procedural vs substantive ruling omission (missing_qualification)
  await t.test("9. Context Analysis - detects procedural court ruling omission (missing_qualification)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_court", text: "Court ruled against Company X", importance: "high", claimType: "legal",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_court_ruling",
        claimId: "claim_court",
        title: "Appeals Court Order 24-1092",
        url: "https://courts.gov/orders/24-1092",
        domain: "courts.gov",
        snippet: "The motion to dismiss on venue grounds is denied without prejudice; the court does not reach the merits of underlying antitrust allegations.",
        sourceRelationship: "original",
        relationship: "qualifying",
        sourceType: "primary_document",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: null
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_court",
        verdict: "qualifying",
        confidence: "high",
        explanation: "Ruling was limited to a venue motion, not the underlying allegations.",
        evidenceIds: ["ev_court_ruling"],
        importantNotes: ["Narrow procedural ruling"],
        layer: "event_occurred"
      },
    ];

    const mockDetector = async () => [
      {
        id: "om_court_1",
        claimId: "claim_court",
        type: "missing_qualification" as const,
        severity: "high" as const,
        description: "The article states the court ruled against Company X without noting that the decision was solely on a venue motion and made no finding on liability.",
        whyItMatters: "Readers will believe Company X was found guilty of substantive wrongdoing when no merit determination occurred.",
        evidenceIds: ["ev_court_ruling"],
        confidence: "high" as const,
      },
    ];

    const omissions = await analyzeArticleContext(
      mockArticle,
      claims,
      evidence,
      evaluations,
      { customDetector: mockDetector }
    );

    assert.strictEqual(omissions.length, 1);
    assert.strictEqual(omissions[0].type, "missing_qualification");
    assert.strictEqual(omissions[0].severity, "high");
  });

  // 10. Scenario: Correlation presented as causation (misleading_framing)
  await t.test("10. Context Analysis - detects correlation framed as causation (misleading_framing)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_study", text: "Study proves coffee consumption causes longevity", importance: "high", claimType: "scientific",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_coffee_study",
        claimId: "claim_study",
        title: "Journal of Epidemiological Studies",
        url: "https://journal.example/coffee-longevity",
        domain: "journal.example",
        snippet: "Observational study finds an association between coffee intake and lifespan; authors emphasize observational data cannot establish causality.",
        sourceRelationship: "original",
        relationship: "qualifying",
        sourceType: "research",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: null,
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_study",
        verdict: "qualifying",
        confidence: "high",
        explanation: "The study is observational and explicit about unproven causality.",
        evidenceIds: ["ev_coffee_study"],
        importantNotes: ["Correlation vs causation distinction"],
        layer: "event_occurred"
      },
    ];

    const mockDetector = async () => [
      {
        id: "om_study_1",
        claimId: "claim_study",
        type: "misleading_framing" as const,
        severity: "medium" as const,
        description: "The article frames the research as proving causation, whereas the underlying paper explicitly states it is an observational correlation.",
        whyItMatters: "Readers are led to believe a direct causal medical effect was established.",
        evidenceIds: ["ev_coffee_study"],
        confidence: "high" as const,
      },
    ];

    const omissions = await analyzeArticleContext(
      mockArticle,
      claims,
      evidence,
      evaluations,
      { customDetector: mockDetector }
    );

    assert.strictEqual(omissions.length, 1);
    assert.strictEqual(omissions[0].type, "misleading_framing");
  });

  // 11. Scenario: Missing strong counter-evidence (missing_counter_evidence)
  await t.test("11. Context Analysis - detects missing counter-evidence (missing_counter_evidence)", async () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_counter", text: "Chemical X has no recorded side effects", importance: "high", claimType: "factual",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_fda_warning",
        claimId: "claim_counter",
        title: "FDA Black Box Safety Advisory",
        url: "https://fda.gov/safety/chemical-x",
        domain: "fda.gov",
        snippet: "FDA documented 142 severe adverse cardiovascular events directly linked to Chemical X.",
        sourceRelationship: "original",
        relationship: "contradicting",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: null
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_counter",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official regulatory database documents severe documented side effects.",
        evidenceIds: ["ev_fda_warning"],
        importantNotes: ["FDA black box warning active"],
        layer: "event_occurred"
      },
    ];

    const mockDetector = async () => [
      {
        id: "om_counter_1",
        claimId: "claim_counter",
        type: "missing_counter_evidence" as const,
        severity: "high" as const,
        description: "The article omits the FDA black box warning and 142 documented adverse cardiovascular events.",
        whyItMatters: "Material safety records directly contradict the claim of zero side effects.",
        evidenceIds: ["ev_fda_warning"],
        confidence: "high" as const,
      },
    ];

    const omissions = await analyzeArticleContext(
      mockArticle,
      claims,
      evidence,
      evaluations,
      { customDetector: mockDetector }
    );

    assert.strictEqual(omissions.length, 1);
    assert.strictEqual(omissions[0].type, "missing_counter_evidence");
  });

  // 12. Invalid omissions rejected (no material impact, mere disagreement)
  await t.test("12. Context Analysis - filters out ungrounded or non-existent evidence omissions", async () => {
    const claims: ClaimInput[] = [
      {
        id: "claim_simple", text: "Company announced new CEO", importance: "low", claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact"
      },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev_ceo",
        claimId: "claim_simple",
        title: "Company Press Release",
        url: "https://company.example/news/ceo",
        domain: "company.example",
        snippet: "Jane Doe appointed as new Chief Executive Officer.",
        sourceRelationship: "original",
        relationship: "supporting",
        sourceType: "other",
        evidenceQuality: "high",
        relevance: "direct",
        publishedAt: null,
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "claim_simple",
        verdict: "supporting",
        confidence: "high",
        explanation: "CEO announcement verified directly by press release.",
        evidenceIds: ["ev_ceo"],
        importantNotes: [],
        layer: "event_occurred"
      },
    ];

    // Detector returns an omission referencing an evidence ID that doesn't exist
    const mockDetector = async () => [
      {
        id: "om_ungrounded",
        claimId: "claim_simple",
        type: "missing_context" as const,
        severity: "low" as const,
        description: "The article does not mention the CEO's favorite hobby.",
        whyItMatters: "Readers would like to know.",
        evidenceIds: ["ev_nonexistent_999"],
        confidence: "low" as const,
      },
    ];

    const omissions = await analyzeArticleContext(
      mockArticle,
      claims,
      evidence,
      evaluations,
      { customDetector: mockDetector }
    );

    assert.strictEqual(omissions.length, 0, "Ungrounded omission with nonexistent evidence ID must be rejected");
  });

  // 13. AnalyzeContextRequestSchema rejects invalid input
  await t.test("13. API Request Schema - rejects incomplete payloads", () => {
    // Missing evaluations
    const invalidPayload = {
      article: mockArticle,
      claims: [],
      evidence: [],
    };

    const parsed = AnalyzeContextRequestSchema.safeParse(invalidPayload);
    assert.strictEqual(parsed.success, false);
  });
});
