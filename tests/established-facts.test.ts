import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyClaimKind } from "../src/lib/verification/claimKind";
import { isNavOrSectionUrl, gateEvidenceSpecifics } from "../src/lib/search/relevanceGate";
import { rankEvidenceForClaim } from "../src/lib/search/rankEvidence";
import { buildReport } from "../src/lib/verification/buildReport";
import { ClaimInput, Evidence } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";

function makeEvidence(e: Partial<Evidence> & { id: string; claimId: string; url: string; domain: string }): Evidence {
  return {
    title: "Test Evidence Title",
    snippet: "Test evidence snippet confirming facts.",
    sourceRelationship: "independent",
    relationship: "supporting",
    sourceType: "international_news",
    evidenceQuality: "high",
    relevance: "direct",
    publishedAt: "2024-01-01T00:00:00Z",
    sourceContentStatus: "snippet_only",
    ...e,
  } as Evidence;
}

describe("Established Facts, Relevance Gate & Consistency Tests", () => {
  // ─── A. Claim classification ───────────────────────────────────────────────
  it("A1. Correctly classifies science, history, geography, and definitions as established_fact", () => {
    assert.strictEqual(classifyClaimKind("The Sun revolves around the Earth."), "established_fact");
    assert.strictEqual(classifyClaimKind("Water boils at 100°C at sea level."), "established_fact");
    assert.strictEqual(classifyClaimKind("India became independent in 1947."), "established_fact");
    assert.strictEqual(classifyClaimKind("India became independent in 1950."), "established_fact");
    assert.strictEqual(classifyClaimKind("Photosynthesis converts sunlight into chemical energy."), "established_fact");
  });

  it("A2. Classifies regular breaking news and political statements as news_event", () => {
    assert.strictEqual(classifyClaimKind("Prime Minister announced a new economic relief package today."), "news_event");
    assert.strictEqual(classifyClaimKind("Supreme Court bench issued a fine of ₹10 lakh on Company X."), "news_event");
  });

  // ─── B. Relevance gate rejects nav/section pages & topic-only matches ───────
  it("B1. Rejects homepage, section, tag, search, and category URLs", () => {
    assert.strictEqual(isNavOrSectionUrl("https://example.com/").isNav, true);
    assert.strictEqual(isNavOrSectionUrl("https://news.com/politics").isNav, true);
    assert.strictEqual(isNavOrSectionUrl("https://bbc.com/news/world/tag/india").isNav, true);
    assert.strictEqual(isNavOrSectionUrl("https://cnn.com/search?q=space").isNav, true);
    assert.strictEqual(isNavOrSectionUrl("https://nasa.gov/news/latest").isNav, true);
    // Deep article URL should not be rejected
    assert.strictEqual(isNavOrSectionUrl("https://nasa.gov/missions/solar-system-dynamics-earth-orbit-study").isNav, false);
  });

  it("B2. Rejects topic-only matches where key specifics are missing", () => {
    const claim: ClaimInput = {
      id: "c1",
      text: "Water boils at 100°C at sea level.",
      claimKind: "established_fact",
      importance: "high",
      claimType: "event",
    };

    // Topic only (water, sea) without boiling or 100C
    const topicOnly = gateEvidenceSpecifics(claim, {
      title: "Summer Vacation Guide",
      snippet: "Enjoy swimming in ocean water at sea level during the summer holidays.",
      url: "https://travel.org/guides/beach-vacations",
    });
    assert.strictEqual(topicOnly.passed, false);
    assert.ok(topicOnly.reason);

    // Matching specifics (water, boils, 100)
    const specificMatch = gateEvidenceSpecifics(claim, {
      title: "Physical properties of water",
      snippet: "Under standard atmospheric conditions, water boils at 100°C at sea level.",
      url: "https://science-reference.org/properties/water-boiling",
    });
    assert.strictEqual(specificMatch.passed, true);
  });

  // ─── C. Regression Case 1: "The Sun revolves around the Earth." -> False ──
  it("C1. Regression Case 1: 'The Sun revolves around the Earth.' produces False", async () => {
    const claim: ClaimInput = {
      id: "c-sun",
      text: "The Sun revolves around the Earth.",
      claimKind: "established_fact",
      importance: "high",
      claimType: "event",
      certainty: "asserted_fact",
    };

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c-sun",
        url: "https://nasa.gov/solar-system-orbit-facts",
        domain: "nasa.gov",
        relationship: "contradicting",
        snippet: "In our solar system, the Earth revolves around the Sun in an elliptical orbit.",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c-sun",
        url: "https://britannica.com/science/heliocentrism",
        domain: "britannica.com",
        relationship: "contradicting",
        snippet: "Copernicus established that the Earth revolves around the Sun, disproving the geocentric claim.",
      }),
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c-sun",
        claimKind: "established_fact",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Multiple scientific authorities confirm the Earth revolves around the Sun.",
        citedPassage: "the earth revolves around the sun",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "The Sun revolves around the Earth.",
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      evaluations,
      [],
      { evidence }
    );

    assert.strictEqual(report.veracityVerdict, "false");
    assert.strictEqual(report.conclusion?.label, "False");
    assert.ok(report.overallTrustScore <= 20, "Trust score must be low for refuted claim");
    assert.ok((report.crossSourceComparison?.independentSourcesCount ?? 0) >= 2);
  });

  // ─── C. Regression Case 2: "Water boils at 100°C at sea level." -> True ───
  it("C2. Regression Case 2: 'Water boils at 100°C at sea level.' produces True", async () => {
    const claim: ClaimInput = {
      id: "c-water",
      text: "Water boils at 100°C at sea level.",
      claimKind: "established_fact",
      importance: "high",
      claimType: "event",
      certainty: "asserted_fact",
    };

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c-water",
        url: "https://usgs.gov/water-science-school/boiling-point-of-water",
        domain: "usgs.gov",
        relationship: "supporting",
        snippet: "Under 1 atmosphere of pressure at sea level, pure water boils at 100°C (212°F).",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c-water",
        url: "https://nist.gov/properties-of-water-boiling",
        domain: "nist.gov",
        relationship: "supporting",
        snippet: "Standard reference data confirms that at sea level water boils at 100°C.",
      }),
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c-water",
        claimKind: "established_fact",
        verdict: "supporting",
        confidence: "high",
        explanation: "Scientific standards verify that water boils at 100°C at sea level.",
        citedPassage: "water boils at 100°c",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "Water boils at 100°C at sea level.",
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      evaluations,
      [],
      { evidence }
    );

    assert.ok(
      report.conclusion?.label === "True" || report.conclusion?.label === "Mostly true",
      `Expected True or Mostly true, got ${report.conclusion?.label}`
    );
    assert.ok(report.overallTrustScore >= 80);
  });

  // ─── C. Regression Case 3: "India became independent in 1947." -> True ─────
  it("C3. Regression Case 3: 'India became independent in 1947.' produces True", async () => {
    const claim: ClaimInput = {
      id: "c-india-1947",
      text: "India became independent in 1947.",
      claimKind: "established_fact",
      importance: "high",
      claimType: "event",
      certainty: "asserted_fact",
    };

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c-india-1947",
        url: "https://nationalarchives.gov.uk/indian-independence-1947",
        domain: "nationalarchives.gov.uk",
        relationship: "supporting",
        snippet: "India became independent in 1947 when the British partitioned the subcontinent into two dominions.",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c-india-1947",
        url: "https://britannica.com/place/India/Independence-1947",
        domain: "britannica.com",
        relationship: "supporting",
        snippet: "India achieved full independence on August 15, 1947, ending British colonial rule.",
      }),
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c-india-1947",
        claimKind: "established_fact",
        verdict: "supporting",
        confidence: "high",
        explanation: "Historical records confirm India gained independence in 1947.",
        citedPassage: "india became independent in 1947",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "India became independent in 1947.",
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      evaluations,
      [],
      { evidence }
    );

    assert.ok(
      report.conclusion?.label === "True" || report.conclusion?.label === "Mostly true",
      `Expected True or Mostly true, got ${report.conclusion?.label}`
    );
    assert.ok(report.overallTrustScore >= 80);
  });

  // ─── C. Regression Case 4: "India became independent in 1950." -> False ────
  it("C4. Regression Case 4: 'India became independent in 1950.' produces False", async () => {
    const claim: ClaimInput = {
      id: "c-india-1950",
      text: "India became independent in 1950.",
      claimKind: "established_fact",
      importance: "high",
      claimType: "event",
      certainty: "asserted_fact",
    };

    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c-india-1950",
        url: "https://britannica.com/place/India/Republic-Day-1950",
        domain: "britannica.com",
        relationship: "contradicting",
        snippet: "India became independent in 1947, whereas in 1950 it adopted its constitution and became a republic.",
      }),
      makeEvidence({
        id: "ev2",
        claimId: "c-india-1950",
        url: "https://india.gov.in/history-independence-constitution",
        domain: "india.gov.in",
        relationship: "contradicting",
        snippet: "While India gained independence in 1947, 1950 marked the transition to a constitutional republic.",
      }),
    ];

    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c-india-1950",
        claimKind: "established_fact",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Historical records show India became independent in 1947, not 1950.",
        citedPassage: "india became independent in 1947",
        evidenceIds: ["ev1", "ev2"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(
      {
        title: "India became independent in 1950.",
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      evaluations,
      [],
      { evidence }
    );

    assert.strictEqual(report.veracityVerdict, "false");
    assert.strictEqual(report.conclusion?.label, "False");
    assert.ok(report.overallTrustScore <= 20);
  });

  // ─── D. Topic-only search matches yield 0 outlets and Can't verify ───────────
  it("D1. Topic-only matches yield 0 gated outlets, 'Can't verify', and hasGatedEvidence=false", async () => {
    const claim: ClaimInput = {
      id: "c-quantum",
      text: "Quantum teleportation transmitted mass between laboratories.",
      importance: "high",
      claimType: "event",
    };

    // Raw search results that are topic matches or homepage/nav pages
    const rawItems: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: claim.id,
        title: "Quantum Physics News - Homepage",
        url: "https://quantumphysics.org/",
        domain: "quantumphysics.org",
        snippet: "Read the latest news and research updates in quantum physics.",
      }),
      makeEvidence({
        id: "ev2",
        claimId: claim.id,
        title: "General Physics Category",
        url: "https://physicsworld.com/category/quantum/",
        domain: "physicsworld.com",
        snippet: "Browse physics articles, opinions, and educational resources.",
      }),
    ];

    const ranked = rankEvidenceForClaim(claim, rawItems);
    assert.strictEqual(ranked.length, 0, "No raw items should pass the relevance gate");

    // Report built when 0 evidence passed the gate
    const report = await buildReport(
      {
        title: claim.text,
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      [
        {
          claimId: claim.id,
          verdict: "insufficient",
          confidence: "low",
          explanation: "No reliable gated evidence found.",
          evidenceIds: [],
          importantNotes: [],
        },
      ],
      [],
      { evidence: [] }
    );

    assert.strictEqual(report.hasGatedEvidence, false);
    assert.strictEqual(report.crossSourceComparison?.independentSourcesCount ?? 0, 0);
    assert.strictEqual(report.conclusion?.label, "Can't verify");
  });

  // ─── E. Agreement, Outlets, and Confidence Consistency ─────────────────────
  it("E1. Low confidence cannot coexist with Strong agreement; High confidence requires 2+ independent clusters", async () => {
    const claim: ClaimInput = {
      id: "c1",
      text: "Tech firm announces quarterly revenue growth.",
      importance: "high",
      claimType: "event",
    };

    // Only 1 source -> cannot have high confidence
    const evidence: Evidence[] = [
      makeEvidence({
        id: "ev1",
        claimId: "c1",
        url: "https://techreport.com/news/revenue-growth-report",
        domain: "techreport.com",
        relationship: "supporting",
        snippet: "Tech firm announces quarterly revenue growth of 12%.",
      }),
    ];

    const report = await buildReport(
      {
        title: claim.text,
        sourceDomain: "Independent Claim",
        url: "",
      },
      [claim],
      [
        {
          claimId: "c1",
          verdict: "supporting",
          confidence: "high", // LLM claims high, but only 1 outlet
          explanation: "Report states 12% revenue growth.",
          citedPassage: "revenue growth of 12%",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      [],
      { evidence }
    );

    // Consistency check: With only 1 outlet, confidence cannot be high
    assert.notStrictEqual(report.confidence, "high");
  });
});
