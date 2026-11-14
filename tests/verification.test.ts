import test from "node:test";
import assert from "node:assert/strict";

import {
  VerificationReportSchema,
  VerifyArticleRequestSchema,
  VeracityVerdict,
} from "../src/schemas/verification";
import { ClaimInput } from "../src/schemas/evidence";
import { ClaimEvaluation } from "../src/schemas/evaluation";
import { Omission } from "../src/schemas/omission";
import { calculateScore } from "../src/lib/scoring/calculateScore";
import { determineVerdict } from "../src/lib/scoring/determineVerdict";
import { buildReport } from "../src/lib/verification/buildReport";

test("Phase 7 Verification Report & Schema Integrity Test Suite", async (t) => {
  // 1. VerificationReportSchema accepts strictly valid object
  await t.test("1. VerificationReportSchema - strictly validates valid report", () => {
    const validReport = {
      articleTitle: "Economic Growth Surpasses Forecasts",
      sourceDomain: "reuters.com",
      overallTrustScore: 84,
      veracityVerdict: "mostly_true" as const,
      confidence: "high" as const,
      summary: "The article is mostly true. Core claims are verified by independent and official reporting, with minor context omitted.",
      claimSummary: {
        total: 3,
        supporting: 2,
        contradicting: 0,
        qualifying: 1,
        insufficient: 0,
      },
      evaluations: [
        {
          claimId: "c1",
          verdict: "supporting" as const,
          confidence: "high" as const,
          explanation: "Confirmed by BEA data.",
          evidenceIds: ["ev1"],
          importantNotes: [],
        },
      ],
      omittedContext: [],
      scoreBreakdown: {
        claimScore: 90,
        contextPenalty: 6,
        confidenceAdjustment: 0,
        finalScore: 84,
      },
    };

    const parsed = VerificationReportSchema.parse(validReport);
    assert.strictEqual(parsed.overallTrustScore, 84);
    assert.strictEqual(parsed.veracityVerdict, "mostly_true");
  });

  // 2. VerificationReportSchema rejects invalid types
  await t.test("2. VerificationReportSchema - rejects invalid verdicts or out-of-range scores", () => {
    const invalidReport = {
      articleTitle: "Some Title",
      sourceDomain: "example.com",
      overallTrustScore: 105, // Out of range!
      veracityVerdict: "totally_fake", // Invalid enum!
      confidence: "extreme", // Invalid enum!
      summary: "Invalid",
      claimSummary: { total: 1, supporting: 1, contradicting: 0, qualifying: 0, insufficient: 0 },
      evaluations: [],
      omittedContext: [],
      scoreBreakdown: { claimScore: 100, contextPenalty: 0, confidenceAdjustment: 0, finalScore: 105 },
    };

    assert.throws(() => {
      VerificationReportSchema.parse(invalidReport);
    });
  });

  // 3. VerifyArticleRequestSchema validates input URL
  await t.test("3. VerifyArticleRequestSchema - validates URL string", () => {
    assert.doesNotThrow(() => {
      VerifyArticleRequestSchema.parse({ url: "https://apnews.com/article/12345" });
    });

    assert.throws(() => {
      VerifyArticleRequestSchema.parse({ url: "not-a-url" });
    });

    assert.throws(() => {
      VerifyArticleRequestSchema.parse({ url: "" });
    });
  });

  // 4. Traceability: every claim verdict references evidence
  await t.test("4. Traceability - verified claim evaluations reference valid evidence IDs", async () => {
    const article = { title: "Test Article", sourceDomain: "test.com" };
    const claims: ClaimInput[] = [
      { id: "c1", text: "Factual claim", importance: "high", claimType: "factual" },
    ];
    const evaluations: ClaimEvaluation[] = [
      {
        claimId: "c1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Verified by public record",
        evidenceIds: ["ev_record_1"],
        importantNotes: [],
      },
    ];

    const report = await buildReport(article, claims, evaluations, []);
    assert.strictEqual(report.evaluations[0].evidenceIds.includes("ev_record_1"), true);
  });
});

