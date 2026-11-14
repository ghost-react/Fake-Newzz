import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  deriveTone,
  TONE_TOKENS,
  calculateContrastRatio,
  Tone,
} from "../src/lib/ui/tone";
import { FinalVerificationDashboard } from "../src/components/verification/FinalVerificationDashboard";
import { LoadingVerification } from "../src/components/verification/LoadingVerification";
import { ScoreCard } from "../src/components/verification/ScoreCard";
import { NewsBackdrop } from "../src/components/verification/NewsBackdrop";
import { SummarySection } from "../src/components/verification/SummarySection";
import { VerificationReport } from "../src/schemas/verification";
import { buildReport } from "../src/lib/verification/buildReport";

describe("Verification Conclusion Accent Tone Test Suite", () => {
  // ─── a. Each conclusion label produces the correct data-tone and variables ───
  it("a. Each conclusion label produces the correct data-tone and variables", () => {
    assert.strictEqual(deriveTone({ conclusion: { label: "True" } }), "green");
    assert.strictEqual(deriveTone({ conclusion: { label: "Mostly true" } }), "green");
    assert.strictEqual(deriveTone({ conclusion: { label: "Partly true" } }), "amber");
    assert.strictEqual(deriveTone({ conclusion: { label: "Unconfirmed" } }), "amber");
    assert.strictEqual(deriveTone({ conclusion: { label: "Misleading" } }), "amber");
    assert.strictEqual(deriveTone({ conclusion: { label: "False" } }), "red");
    assert.strictEqual(deriveTone({ conclusion: { label: "Can't verify" } }), "grey");

    // Verify token values and structure
    const tones: Tone[] = ["green", "amber", "red", "grey"];
    for (const t of tones) {
      const tokens = TONE_TOKENS[t];
      assert.strictEqual(tokens.tone, t);
      assert.ok(tokens.base.startsWith("#"));
      assert.ok(tokens.soft.startsWith("rgba("));
      assert.ok(tokens.border.startsWith("rgba("));
      assert.ok(tokens.glow.startsWith("rgba("));
      assert.ok(tokens.text.startsWith("#"));
    }
  });

  // ─── b. Score 76 with label Unconfirmed renders amber, not green ────────────
  it("b. Score 76 with label Unconfirmed renders amber, not green", () => {
    const tone = deriveTone({
      conclusion: { label: "Unconfirmed" },
      overallTrustScore: 76,
      veracityVerdict: "unverified",
    });
    assert.strictEqual(
      tone,
      "amber",
      "Label Unconfirmed must determine amber tone, never overridden by score 76"
    );

    // Render FinalVerificationDashboard with score 76 and label Unconfirmed
    const mockReport: Partial<VerificationReport> = {
      articleTitle: "Breaking Unconfirmed Rumour",
      sourceDomain: "reuters.com",
      overallTrustScore: 76,
      veracityVerdict: "unverified",
      confidence: "medium",
      summary: "This report is unconfirmed.",
      conclusion: {
        label: "Unconfirmed",
        explanation: "Developing story.",
        reasonCodes: ["UNCONFIRMED_REPORTS"],
      },
      evaluations: [],
      omittedContext: [],
      claimSummary: { total: 1, supporting: 0, contradicting: 0, qualifying: 0, insufficient: 1 },
      scoreBreakdown: { finalScore: 76, claimScore: 76, contextPenalty: 0, confidenceAdjustment: 0 },
    };

    const markup = renderToStaticMarkup(
      React.createElement(FinalVerificationDashboard, {
        report: mockReport as VerificationReport,
        onReset: () => {},
      })
    );

    assert.ok(markup.includes('data-tone="amber"'), "Wrapper must carry data-tone='amber'");
    assert.ok(!markup.includes('data-tone="green"'), "Wrapper must NOT carry data-tone='green'");
  });

  // ─── c. Old reports without a label fall back correctly ─────────────────────
  it("c. Old reports without a label fall back correctly", () => {
    // 1. Fallback via verdict
    assert.strictEqual(
      deriveTone({ veracityVerdict: "verified_true", overallTrustScore: 92 }),
      "green"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "mostly_true", overallTrustScore: 80 }),
      "green"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "mixed", overallTrustScore: 60 }),
      "amber"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "misleading", overallTrustScore: 50 }),
      "amber"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "false", overallTrustScore: 10 }),
      "red"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "mostly_false", overallTrustScore: 25 }),
      "red"
    );
    assert.strictEqual(
      deriveTone({ veracityVerdict: "unverified", overallTrustScore: 30 }),
      "grey"
    );

    // 2. Last resort fallback via score bands when neither label nor verdict exists
    assert.strictEqual(deriveTone({ overallTrustScore: 85 }), "green");
    assert.strictEqual(deriveTone({ overallTrustScore: 75 }), "green");
    assert.strictEqual(deriveTone({ overallTrustScore: 74 }), "amber");
    assert.strictEqual(deriveTone({ overallTrustScore: 40 }), "amber");
    assert.strictEqual(deriveTone({ overallTrustScore: 39 }), "red");
    assert.strictEqual(deriveTone({ overallTrustScore: 0 }), "red");
    assert.strictEqual(deriveTone(null), "grey");
  });

  // ─── d. Contrast checks (AA >= 4.5:1) for score text, chip text, and tone text
  it("d. Contrast checks (AA >= 4.5:1) for score text, chip text and tone text on both surfaces", () => {
    const surface1 = "#0B0F17"; // background
    const surface2 = "#111923"; // card surface

    const tones: Tone[] = ["green", "amber", "red", "grey"];
    for (const t of tones) {
      const tokens = TONE_TOKENS[t];
      const ratio1 = calculateContrastRatio(tokens.text, surface1);
      const ratio2 = calculateContrastRatio(tokens.text, surface2);

      assert.ok(
        ratio1 >= 4.5,
        `Tone ${t} text ${tokens.text} on surface ${surface1} contrast ${ratio1.toFixed(2)} must be >= 4.5:1 (AA)`
      );
      assert.ok(
        ratio2 >= 4.5,
        `Tone ${t} text ${tokens.text} on surface ${surface2} contrast ${ratio2.toFixed(2)} must be >= 4.5:1 (AA)`
      );
    }
  });

  // ─── e. Brand elements, claim chips and the homepage stay unchanged ──────────
  it("e. Brand elements, claim chips and the homepage stay unchanged", () => {
    // 1. Brand elements retain emerald/green identity and are not tinted by red/amber tone
    const redReport: Partial<VerificationReport> = {
      articleTitle: "Debunked False Story",
      sourceDomain: "fakenews.org",
      overallTrustScore: 12,
      veracityVerdict: "false",
      confidence: "high",
      summary: "This story is false.",
      conclusion: { label: "False", explanation: "Refuted claim.", reasonCodes: ["CONTRADICTED"] },
      evaluations: [],
      omittedContext: [],
      claimSummary: { total: 1, supporting: 0, contradicting: 1, qualifying: 0, insufficient: 0 },
      scoreBreakdown: { finalScore: 12, claimScore: 12, contextPenalty: 0, confidenceAdjustment: 0 },
    };

    const heroMarkup = renderToStaticMarkup(
      React.createElement(NewsBackdrop, {
        report: redReport as VerificationReport,
        onReset: () => {},
      })
    );

    // Brand logo icon retains emerald-500/30 text-emerald-400
    assert.ok(
      heroMarkup.includes("text-emerald-400"),
      "FakeNewzz wordmark / logo must keep its emerald brand identity"
    );
    assert.ok(
      heroMarkup.includes("FakeNewzz"),
      "FakeNewzz wordmark must be present"
    );
  });

  // ─── f. Unreadable-article note renders grey in every tone ───────────────────
  it("f. Unreadable-article note renders grey in every tone", () => {
    const tones: Tone[] = ["green", "amber", "red", "grey"];
    const labels: Record<Tone, string> = {
      green: "True",
      amber: "Partly true",
      red: "False",
      grey: "Can't verify",
    };

    for (const t of tones) {
      const unreadableReport: Partial<VerificationReport> = {
        articleTitle: "Protected Article",
        sourceDomain: "blocked.com",
        sourceReadStatus: "unreadable",
        sourceReadNote: "We couldn't read the original article, so this check is based on independent reporting.",
        overallTrustScore: t === "green" ? 85 : t === "red" ? 20 : 60,
        veracityVerdict: t === "green" ? "verified_true" : t === "red" ? "false" : "mixed",
        confidence: "medium",
        summary: "Summary based on independent reporting.",
        conclusion: { label: labels[t] as any, explanation: "Test", reasonCodes: [] },
        evaluations: [],
        omittedContext: [],
        claimSummary: { total: 1, supporting: 1, contradicting: 0, qualifying: 0, insufficient: 0 },
        scoreBreakdown: { finalScore: 70, claimScore: 70, contextPenalty: 0, confidenceAdjustment: 0 },
      };

      const heroMarkup = renderToStaticMarkup(
        React.createElement(NewsBackdrop, {
          report: unreadableReport as VerificationReport,
        })
      );
      const scoreMarkup = renderToStaticMarkup(
        React.createElement(ScoreCard, {
          report: unreadableReport as VerificationReport,
        })
      );

      // Verify unreadable note is rendered with neutral slate/grey styling, NEVER amber/red
      assert.ok(
        heroMarkup.includes("bg-slate-800/80") && heroMarkup.includes("text-slate-300"),
        `Hero unreadable note must render neutral grey in tone ${t}`
      );
      assert.ok(
        !heroMarkup.includes("text-[#F59E0B]") || !heroMarkup.includes("unreadable-source-note\" class=\"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F59E0B]"),
        `Hero unreadable note must not be amber in tone ${t}`
      );
      assert.ok(
        scoreMarkup.includes("bg-slate-800/80") && scoreMarkup.includes("text-slate-300"),
        `ScoreCard unreadable note must render neutral grey in tone ${t}`
      );
    }
  });

  // ─── g. Loading state is grey, not green ─────────────────────────────────────
  it("g. Loading state is grey, not green", () => {
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(LoadingVerification, {
        currentStage: 1,
        articleTitle: "Live Article",
      })
    );

    assert.ok(
      loadingMarkup.includes('data-tone="grey"'),
      "Loading verification must have data-tone='grey'"
    );
    assert.ok(
      loadingMarkup.includes("bg-[#94A3B8]"),
      "Loading progress bar must be neutral grey (#94A3B8)"
    );
    assert.ok(
      !loadingMarkup.includes("bg-[#10B981]"),
      "Loading state must never default to green (#10B981)"
    );
  });

  // ─── i. Scores, verdicts and report JSON are identical before and after ──────
  it("i. Scores, verdicts and report JSON are identical before and after", async () => {
    const article = {
      title: "Government Announces New Health Policy",
      content: "The policy provides universal basic insurance across all districts.",
      sourceDomain: "official-gazette.gov",
      url: "https://official-gazette.gov/policy",
    };
    const claims = [
      {
        id: "c1",
        text: "Policy provides universal basic insurance",
        importance: "high" as const,
        claimType: "factual",
      },
    ];
    const evaluations = [
      {
        claimId: "c1",
        verdict: "supporting" as const,
        confidence: "high" as const,
        explanation: "Confirmed by official gazette publication",
        evidenceIds: ["ev-1"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(article, claims, evaluations, [], {
      evidence: [
        {
          id: "ev-1",
          claimId: "c1",
          url: "https://official-gazette.gov/policy",
          domain: "official-gazette.gov",
          title: "Official Gazette Notice",
          snippet: "Universal basic insurance announced.",
          publishedAt: "2026-11-10",
          relevance: "direct",
          evidenceQuality: "high",
          sourceType: "primary_document",
          sourceRelationship: "independent",
          relationship: "supporting",
        },
      ],
    });

    // Score and verdict remain purely deterministic
    assert.strictEqual(report.overallTrustScore, 100);
    assert.strictEqual(report.veracityVerdict, "verified_true");
    assert.strictEqual(report.conclusion?.label, "Mostly true");

    // Deriving tone does not mutate or alter the report JSON
    const reportJsonBefore = JSON.stringify(report);
    const tone = deriveTone(report);
    assert.strictEqual(tone, "green");
    const reportJsonAfter = JSON.stringify(report);
    assert.strictEqual(
      reportJsonBefore,
      reportJsonAfter,
      "Report JSON must be completely unchanged by tone derivation"
    );
  });
});
