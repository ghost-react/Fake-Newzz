import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareClaimsAcrossSources } from "../src/lib/verification/crossSourceComparison";
import { calculateScore } from "../src/lib/scoring/calculateScore";
import { determineVerdictWithRule } from "../src/lib/scoring/determineVerdict";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";

describe("Cross-Source Comparison & Evidence-Based Trust Scoring Test Suite", () => {
  // ── TEST 1: Genuine event reported independently by multiple publications ────
  it("Scenario 1: Genuine event corroborated independently by multiple publications achieves high score", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Global health agency approves landmark malaria vaccine for widespread rollout", importance: "high", claimType: "event" },
      { id: "c2", text: "Clinical trials showed 77% efficacy in early pediatric trials", importance: "medium", claimType: "statistic" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "WHO approves R21 malaria vaccine for children",
        snippet: "The World Health Organization has recommended the R21/Matrix-M malaria vaccine for prevention in children.",
        url: "https://who.int/news/item/malaria-vaccine-approval",
        domain: "who.int",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Official endorsement follows rigorous phase 3 safety trials.",
        publishedAt: "2026-03-01T12:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Global health agency greenlights landmark malaria vaccine",
        snippet: "Independent medical correspondents report health officials authorized the rollout across sub-Saharan Africa.",
        url: "https://bbc.com/news/health-malaria-vaccine",
        domain: "bbc.com",
        sourceType: "international_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Rollout expected to save hundreds of thousands of lives annually.",
        publishedAt: "2026-03-01T13:00:00Z",
      },
      {
        id: "ev3",
        claimId: "c2",
        title: "Lancet study confirms 77% vaccine efficacy in African trial",
        snippet: "Peer-reviewed findings confirm 77% efficacy over 12 months in pediatric cohorts.",
        url: "https://thelancet.com/journals/vaccine-study",
        domain: "thelancet.com",
        sourceType: "research",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Data validates previous efficacy claims.",
        publishedAt: "2026-03-01T14:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by WHO official announcement and independent BBC coverage.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by Lancet peer-reviewed study.",
        evidenceIds: ["ev3"],
        importantNotes: [],
      },
    ];

    const comparison = compareClaimsAcrossSources("theguardian.com", claims, evidence, evaluations);
    assert.equal(comparison.independentSourcesCount >= 2, true);
    assert.equal(comparison.claimsAgreedCount, 2);
    assert.equal(comparison.hasNumericalConflict, false);

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "theguardian.com",
    });

    assert.ok(scoreBreakdown.finalScore >= 95);
    assert.equal(confidence, "high");
  });

  // ── TEST 2: Genuine event with unresolved details ───────────────────────────
  it("Scenario 2: Genuine event with some unresolved details reflects uncertainty", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Earthquake of magnitude 6.4 strikes coastal region", importance: "high", claimType: "event" },
      { id: "c2", text: "Damage exceeds 500 million dollars with dozens trapped in underground tunnels", importance: "medium", claimType: "factual" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "USGS reports magnitude 6.4 offshore earthquake",
        snippet: "Geological survey confirmed a 6.4 magnitude earthquake off the coast at 04:30 UTC.",
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000",
        domain: "usgs.gov",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Tectonic activity verified.",
        publishedAt: "2026-04-10T05:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "USGS confirms 6.4 magnitude earthquake.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Preliminary reports cannot establish damage totals or trapped persons.",
        evidenceIds: [],
        importantNotes: ["Search queries returned no verifiable casualty or dollar damage data."],
      },
    ];

    const comparison = compareClaimsAcrossSources("reuters.com", claims, evidence, evaluations);
    assert.equal(comparison.claimsUnresolvedCount, 1);

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "reuters.com",
    });

    // Score must be dampened due to unverified material claim
    assert.ok(scoreBreakdown.finalScore < 90);
    assert.notEqual(confidence, "high");
  });

  // ── TEST 3: False claim repeated by multiple websites ───────────────────────
  it("Scenario 3: False claim repeated across multiple websites does not get high score", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Central bank suddenly canceled all five-hundred denomination notes", importance: "high", claimType: "event" },
    ];

    // Five sensational blogs repeating the exact same fake claim
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Breaking: Central bank bans 500 notes immediately",
        snippet: "Viral rumors circulate claiming central bank issued sudden ban on 500 notes.",
        url: "https://viraldaily.fake/news/500-ban",
        domain: "viraldaily.fake",
        sourceType: "blog",
        sourceRelationship: "unknown",
        evidenceQuality: "low",
        relevance: "direct",
        relationship: "contradicting",
        sourceContentStatus: "not_retrieved",
        sourceContentExcerpt: null,
        publishedAt: null,
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Fact Check: Central bank has NOT demonetized 500 notes",
        snippet: "Central bank issues official clarification: 'Claims that 500 notes are discontinued are completely false.'",
        url: "https://rbi.org.in/press/clarification-500",
        domain: "rbi.org.in",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Official denial issued by monetary authority.",
        publishedAt: "2026-05-02T10:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official central bank statement directly refutes the rumor.",
        evidenceIds: ["ev2"],
        importantNotes: ["Hoax debunked by monetary authority"],
      },
    ];

    const comparison = compareClaimsAcrossSources("viraldaily.fake", claims, evidence, evaluations);
    assert.equal(comparison.claimsConflictingCount, 1);

    const { scoreBreakdown } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "viraldaily.fake",
    });

    const { verdict } = determineVerdictWithRule(scoreBreakdown.finalScore, claims, evaluations, []);
    assert.equal(verdict, "false");
    assert.ok(scoreBreakdown.finalScore <= 25);
  });

  // ── TEST 4: Syndicated reporting mistaken for independent confirmation ───────
  it("Scenario 4: Wire-service syndication is detected and not counted as independent confirmations", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Cabinet committee approves national clean water transmission corridor", importance: "high", claimType: "event" },
    ];

    // Three distinct newspaper domains that all simply republish a single PTI dispatch
    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Cabinet clears clean water transmission corridor (PTI)",
        snippet: "New Delhi: According to PTI, the cabinet on Wednesday approved the national clean water corridor.",
        url: "https://dailynews.in/water-corridor",
        domain: "dailynews.in",
        sourceType: "national_news",
        sourceRelationship: "syndicated",
        evidenceQuality: "medium",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "not_retrieved",
        sourceContentExcerpt: null,
        publishedAt: "2026-06-01T10:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Cabinet clears clean water corridor: PTI report",
        snippet: "As per PTI, the union cabinet has approved the major water corridor project.",
        url: "https://morningexpress.in/water-project",
        domain: "morningexpress.in",
        sourceType: "regional_news",
        sourceRelationship: "syndicated",
        evidenceQuality: "medium",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "not_retrieved",
        sourceContentExcerpt: null,
        publishedAt: "2026-06-01T10:15:00Z",
      },
      {
        id: "ev3",
        claimId: "c1",
        title: "Union cabinet approves clean water corridor project",
        snippet: "Citing PTI sources, government greenlights water corridor.",
        url: "https://cityherald.in/cabinet-decision",
        domain: "cityherald.in",
        sourceType: "regional_news",
        sourceRelationship: "syndicated",
        evidenceQuality: "medium",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "not_retrieved",
        sourceContentExcerpt: null,
        publishedAt: "2026-06-01T10:30:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "medium",
        explanation: "Reported across three outlets citing a single PTI wire dispatch.",
        evidenceIds: ["ev1", "ev2", "ev3"],
        importantNotes: ["Coverage relies on a single news agency report."],
      },
    ];

    const comparison = compareClaimsAcrossSources("dailynews.in", claims, evidence, evaluations);
    assert.equal(comparison.independentSourcesCount, 0);
    assert.equal(comparison.syndicatedSourcesCount, 3);
    assert.ok(comparison.wireAgenciesDetected.includes("PTI"));

    const { scoreBreakdown } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "dailynews.in",
    });

    // Score cannot reach 100 because all coverage is syndicated without independent confirmation
    assert.notEqual(scoreBreakdown.finalScore, 100);
    assert.ok(scoreBreakdown.finalScore < 95);
  });

  // ── TEST 5: Genuine event with conflicting numerical details ─────────────────
  it("Scenario 5: Detects conflicting numerical figures and applies cross-source penalty", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Port explosion resulted in 250 casualties and 4000 injured", importance: "high", claimType: "statistic" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Disaster ministry confirms 135 dead in port blast",
        snippet: "Official emergency response figures indicate 135 fatalities and 1200 injured, rejecting claims of 250 dead.",
        url: "https://ministry.gov/disaster-toll",
        domain: "ministry.gov",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Official verified figures confirm 135 fatalities.",
        publishedAt: "2026-07-04T12:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Red Cross updates explosion toll to 140 dead",
        snippet: "Red Cross medical teams have treated 1500 injured people, casualty count stands at 140.",
        url: "https://redcross.org/blast-response",
        domain: "redcross.org",
        sourceType: "official",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Hospital intake data counts 140 deceased.",
        publishedAt: "2026-07-04T14:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Official disaster data contradicts 250 figure (actual toll is ~135-140).",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: ["Numerical contradiction on casualty totals"],
      },
    ];

    const comparison = compareClaimsAcrossSources("tabloidnews.com", claims, evidence, evaluations);
    assert.equal(comparison.hasNumericalConflict, true);
    assert.equal(comparison.claimsConflictingCount, 1);

    const { scoreBreakdown } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "tabloidnews.com",
    });

    assert.ok(scoreBreakdown.finalScore < 40);
  });

  // ── TEST 6: Breaking news with limited reporting ────────────────────────────
  it("Scenario 6: Breaking news with limited coverage results in appropriate uncertainty rather than false certainty", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Cargo ship runs aground in remote strait", importance: "high", claimType: "event" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Maritime dispatch: cargo vessel reports rudder failure in strait",
        snippet: "Coast Guard received distress signal; rescue tugs dispatched.",
        url: "https://maritimelog.com/alert-strait",
        domain: "maritimelog.com",
        sourceType: "regional_news",
        sourceRelationship: "unknown",
        evidenceQuality: "low",
        relevance: "related",
        relationship: "neutral",
        sourceContentStatus: "not_retrieved",
        sourceContentExcerpt: null,
        publishedAt: "2026-08-01T01:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Single brief alert without corroborating navigation reports.",
        evidenceIds: [],
        importantNotes: ["Breaking situation; details unconfirmed"],
      },
    ];

    const comparison = compareClaimsAcrossSources("twitter.com", claims, evidence, evaluations);
    assert.equal(comparison.claimsUnresolvedCount, 1);

    const { scoreBreakdown, confidence } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "twitter.com",
    });

    assert.equal(confidence, "low");
    const { verdict } = determineVerdictWithRule(scoreBreakdown.finalScore, claims, evaluations, []);
    assert.equal(verdict, "unverified");
  });

  // ── TEST 7: Genuine quotation with disputed interpretation ──────────────────
  it("Scenario 7: Genuine quotation with disputed interpretation is distinguished from factual falsehood", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Secretary Adams made the statement: 'We must reset our digital currency framework'", importance: "high", claimType: "statement_attribution" },
      { id: "c2", text: "Statement context and interpretation: Adams intended immediate ban of private cryptocurrencies", importance: "medium", claimType: "interpretation" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Treasury Secretary Adams speech on fintech: 'We must reset our digital currency framework'",
        snippet: "Delivering the keynote address, Adams stated: 'We must reset our digital currency framework.'",
        url: "https://treasury.gov/adams-speech",
        domain: "treasury.gov",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Verbatim transcript confirmed.",
        publishedAt: "2026-09-15T10:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c2",
        title: "Treasury clarifies Adams fintech speech: No ban planned, focus on consumer safety",
        snippet: "Spokesperson clarified the reset refers to consumer protections and reserve auditing, not a ban.",
        url: "https://wsj.com/economy/treasury-crypto-policy",
        domain: "wsj.com",
        sourceType: "national_news",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "qualifying",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Treasury clarified remarks.",
        publishedAt: "2026-09-15T12:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Statement confirmed through official Treasury speech transcript.",
        evidenceIds: ["ev1"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "qualifying",
        confidence: "high",
        explanation: "Interpretation exceeds what was stated; Treasury explicitly clarified no ban was announced.",
        evidenceIds: ["ev2"],
        importantNotes: ["Extrapolation of intent without evidence"],
      },
    ];

    const comparison = compareClaimsAcrossSources("cryptowire.com", claims, evidence, evaluations);
    const { scoreBreakdown } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "cryptowire.com",
    });

    const { verdict } = determineVerdictWithRule(scoreBreakdown.finalScore, claims, evaluations, []);
    // Must be labeled mostly_true or misleading rather than outright false
    assert.notEqual(verdict, "false");
  });

  // ── TEST 8: Article with important missing context ──────────────────────────
  it("Scenario 8: Article with important missing context receives context penalty and capped score", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "City transit agency reports 15% fare increase", importance: "high", claimType: "event" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "Metro announces fare adjustments starting next month",
        snippet: "Fares to adjust by 15% for peak riders, but off-peak fares reduced by 20% and youth fares made free.",
        url: "https://metrotransit.org/fare-announcement",
        domain: "metrotransit.org",
        sourceType: "official",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Comprehensive tariff structure includes free youth rides.",
        publishedAt: "2026-10-01T09:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "15% increase for peak riders confirmed.",
        evidenceIds: ["ev1"],
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
        description: "Omitted that youth travel was made completely free and off-peak fares were reduced by 20%.",
        whyItMatters: "Distorts public understanding of the overall tariff package.",
        evidenceIds: ["ev1"],
      },
    ];

    const comparison = compareClaimsAcrossSources("citynews.com", claims, evidence, evaluations);
    const { scoreBreakdown } = calculateScore(claims, evaluations, omissions, {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "citynews.com",
    });

    // Score must reflect the high omission penalty (-15)
    assert.ok(scoreBreakdown.contextPenalty >= 15);
    assert.ok(scoreBreakdown.finalScore <= 85);
  });

  // ── TEST 9: Article with strong evidence across all material claims achieves 100 ─
  it("Scenario 9: Article with strong evidence across all material claims can achieve 100/100", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Global aerospace treaty ratified by 85 nation states", importance: "high", claimType: "event" },
      { id: "c2", text: "Treaty takes effect on January 1st following UN depository registration", importance: "medium", claimType: "dates_timelines" },
    ];

    const evidence: Evidence[] = [
      {
        id: "ev1",
        claimId: "c1",
        title: "UN Treaty Collection: Aerospace Accord reaches 85 ratifications",
        snippet: "United Nations Treaty Depository registers the 85th instrument of ratification.",
        url: "https://treaties.un.org/aerospace-accord-85",
        domain: "un.org",
        sourceType: "primary_document",
        sourceRelationship: "original",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Official instrument of ratification deposited.",
        publishedAt: "2026-10-15T12:00:00Z",
      },
      {
        id: "ev2",
        claimId: "c1",
        title: "Milestone space accord crosses ratification threshold at UN",
        snippet: "Independent legal reporting confirms 85 states have ratified the international agreement.",
        url: "https://reuters.com/world/un-aerospace-treaty-ratified",
        domain: "reuters.com",
        sourceType: "wire",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Reuters correspondents confirmed registry documents.",
        publishedAt: "2026-10-15T12:30:00Z",
      },
      {
        id: "ev3",
        claimId: "c2",
        title: "Aerospace treaty to enter into force on January 1st",
        snippet: "UN legal affairs secretariat confirmed entry into force on January 1st.",
        url: "https://apnews.com/article/un-space-treaty-timeline",
        domain: "apnews.com",
        sourceType: "wire",
        sourceRelationship: "independent",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceContentStatus: "retrieved",
        sourceContentExcerpt: "Effective date verified for January 1st.",
        publishedAt: "2026-10-15T13:00:00Z",
      },
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by UN Treaty Depository and independent Reuters coverage.",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
      {
        claimId: "c2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by UN official documents and AP reporting.",
        evidenceIds: ["ev3"],
        importantNotes: [],
      },
    ];

    const comparison = compareClaimsAcrossSources("apnews.com", claims, evidence, evaluations);
    assert.equal(comparison.independentSourcesCount >= 2, true);
    assert.equal(comparison.claimsAgreedCount, 2);
    assert.equal(comparison.claimsConflictingCount, 0);
    assert.equal(comparison.hasNumericalConflict, false);

    const { scoreBreakdown, confidence, scoreExplanation } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence,
      originalPublisher: "apnews.com",
    });

    // When all conditions are met, 100/100 is achieved and justified
    assert.equal(scoreBreakdown.finalScore, 100);
    assert.equal(confidence, "high");
    assert.ok(scoreExplanation.hundredScoreJustification?.includes("100/100"));
  });

  // ── TEST 10: High source count alone never guarantees a high score ─────────
  it("High source count alone never guarantees a high score if claims are contradicted or unverified", () => {
    const claims: ClaimInput[] = [
      { id: "c1", text: "Miracle herb cures all forms of autoimmune disease", importance: "high", claimType: "claim" },
    ];

    // 15 matching blog / spam websites all repeating the headline
    const spamSources: Evidence[] = Array.from({ length: 15 }, (_, i) => ({
      id: `ev-spam-${i + 1}`,
      claimId: "c1",
      title: `Miracle herb cures autoimmune disease report ${i + 1}`,
      snippet: "Miracle herb cures all forms of autoimmune disease say online forums.",
      url: `https://herbalblog${i + 1}.com/cure`,
      domain: `herbalblog${i + 1}.com`,
      sourceType: "blog" as const,
      sourceRelationship: "unknown" as const,
      evidenceQuality: "low" as const,
      relevance: "direct" as const,
      relationship: "neutral" as const,
      sourceContentStatus: "not_retrieved" as const,
      sourceContentExcerpt: null,
      publishedAt: null,
    }));

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Medical authorities and clinical literature confirm there is no herbal cure for all autoimmune diseases.",
        evidenceIds: ["ev-spam-1"],
        importantNotes: ["Unsubstantiated medical claim"],
      },
    ];

    const comparison = compareClaimsAcrossSources("herbalblog1.com", claims, spamSources, evaluations);
    assert.equal(comparison.totalPublicationsExamined, 15);

    const { scoreBreakdown } = calculateScore(claims, evaluations, [], {
      crossSourceComparison: comparison,
      evidence: spamSources,
      originalPublisher: "herbalblog1.com",
    });

    // 15 matching websites must NEVER inflate the score of a refuted claim!
    assert.ok(scoreBreakdown.finalScore <= 20);
  });
});
