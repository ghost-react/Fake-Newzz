import fs from "node:fs";
import path from "node:path";
import { TraceRecord } from "../src/lib/debug/trace";

function findLatestTraceFile(): string | null {
  const traceDir = path.join(process.cwd(), ".trace");
  if (!fs.existsSync(traceDir)) return null;

  const files = fs
    .readdirSync(traceDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) return null;
  return path.join(traceDir, files[files.length - 1]);
}

function printSectionHeader(title: string): void {
  console.log("\n" + "=".repeat(80));
  console.log(` ${title.toUpperCase()}`);
  console.log("=".repeat(80));
}

function printSubHeader(title: string): void {
  console.log("\n" + "-".repeat(80));
  console.log(` ${title}`);
  console.log("-".repeat(80));
}

function main() {
  let traceFilePath = process.argv[2];

  if (!traceFilePath) {
    const latest = findLatestTraceFile();
    if (!latest) {
      console.log("No trace file specified and no existing traces found in .trace/");
      console.log("Usage: npx tsx scripts/summarizeTrace.ts <path-to-trace.json>");
      process.exit(0);
    }
    traceFilePath = latest;
    console.log(`No trace file argument provided. Defaulting to most recent: ${traceFilePath}`);
  }

  const resolvedPath = path.resolve(process.cwd(), traceFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Trace file not found at: ${resolvedPath}`);
    process.exit(1);
  }

  let trace: TraceRecord;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    trace = JSON.parse(raw);
  } catch (err: any) {
    console.error(`Error parsing trace JSON: ${err.message}`);
    process.exit(1);
  }

  printSectionHeader(`Verification Pipeline Trace Summary: ${trace.runId}`);
  console.log(`File:           ${resolvedPath}`);
  console.log(`Start Time:     ${trace.startTime}`);
  console.log(`End Time:       ${trace.endTime}`);
  console.log(`Total Duration: ${trace.totalDurationMs} ms`);

  // Stage Timings
  printSubHeader("Stage Execution Timings");
  if (trace.stageTimings && Object.keys(trace.stageTimings).length > 0) {
    for (const [stg, ms] of Object.entries(trace.stageTimings)) {
      const bar = "█".repeat(Math.min(40, Math.max(1, Math.round(ms / 50))));
      console.log(`  ${stg.padEnd(25)} : ${String(ms).padStart(6)} ms  ${bar}`);
    }
  } else {
    console.log("  No detailed stage timings recorded.");
  }

  const stages = trace.stages || {};

  // 1. Input Stage
  printSubHeader("1. Input");
  if (stages.input) {
    console.log(`  Type:    ${stages.input.inputType}`);
    console.log(`  Length:  ${stages.input.inputLength} characters`);
    console.log(`  Preview: "${stages.input.preview}"`);
  } else {
    console.log("  (Input stage not captured)");
  }

  // 2. Ingestion Stage
  printSubHeader("2. Article Ingestion");
  if (stages.ingestion) {
    console.log(`  Success:    ${stages.ingestion.success ? "YES" : "NO"}`);
    if (stages.ingestion.success) {
      console.log(`  Title:      ${stages.ingestion.title}`);
      console.log(`  Domain:     ${stages.ingestion.sourceDomain}`);
      console.log(`  Word Count: ${stages.ingestion.wordCount}`);
      console.log(`  Image:      ${stages.ingestion.hasFeaturedImage ? "Present" : "None"}`);
    } else {
      console.log(`  Error:      ${stages.ingestion.error}`);
    }
  } else {
    console.log("  (Ingestion stage not captured or skipped for direct text input)");
  }

  // 3. Claims Stage
  printSubHeader("3. Extracted Claims");
  if (Array.isArray(stages.claims)) {
    console.log(`  Total Claims: ${stages.claims.length}`);
    for (const c of stages.claims) {
      console.log(`  - [${c.id}] (${c.importance}, ${c.claimType}): "${c.text}"`);
    }
  } else {
    console.log("  (Claims stage not captured)");
  }

  // 4. Search Stage
  printSubHeader("4. Search Queries & Results");
  if (Array.isArray(stages.search)) {
    for (const sr of stages.search) {
      console.log(`  Claim [${sr.claimId}]:`);
      console.log(`    Queries Sent (${(sr.queries || []).length}):`);
      for (const q of sr.queries || []) {
        console.log(`      • "${q}"`);
      }
      console.log(`    Results Found: ${(sr.results || []).length}`);
      for (const r of (sr.results || []).slice(0, 5)) {
        console.log(`      → ${r.domain} | "${r.title}" (snippet: ${r.snippetLength} chars)`);
      }
      if ((sr.results || []).length > 5) {
        console.log(`      ... and ${(sr.results || []).length - 5} more results`);
      }
    }
  } else {
    console.log("  (Search stage not captured)");
  }

  // 5. Dedupe & Ranking
  printSubHeader("5. Deduplication & Ranking");
  const dedupeList = Array.isArray(stages.dedupe_ranking)
    ? stages.dedupe_ranking
    : stages.dedupe_ranking
    ? [stages.dedupe_ranking]
    : [];

  if (dedupeList.length > 0) {
    for (const dr of dedupeList) {
      console.log(`  Claim [${dr.claimId}]:`);
      console.log(`    Ranked Items Retained: ${(dr.rankedOrder || []).length}`);
      console.log(`    URLs Dropped: ${(dr.droppedUrls || []).length}`);
      for (const du of (dr.droppedUrls || []).slice(0, 3)) {
        console.log(`      ✖ ${du.url} (${du.reason})`);
      }
    }
  } else {
    console.log("  (Dedupe & ranking stage not captured)");
  }

  // 6. Source Fetch
  printSubHeader("6. Source Content Fetch");
  const fetchList = Array.isArray(stages.source_fetch)
    ? stages.source_fetch
    : stages.source_fetch
    ? [stages.source_fetch]
    : [];

  if (fetchList.length > 0) {
    for (const sf of fetchList) {
      console.log(`  Claim [${sf.claimId}]:`);
      for (const rec of sf.records || []) {
        const status = rec.attempted
          ? rec.success
            ? `FETCHED (${rec.contentLength} chars)`
            : `FAILED (${rec.errorReason})`
          : "NOT ATTEMPTED";
        console.log(`    - ${rec.url} [${status}] -> Used: ${rec.contentUsed}`);
      }
    }
  } else {
    console.log("  (Source fetch stage not captured)");
  }

  // 7. Evidence Preparation
  printSubHeader("7. Evidence Handed to Evaluator");
  const prepList = Array.isArray(stages.evidence_preparation)
    ? stages.evidence_preparation
    : stages.evidence_preparation
    ? [stages.evidence_preparation]
    : [];

  if (prepList.length > 0) {
    for (const ep of prepList) {
      console.log(`  Claim [${ep.claimId}] received ${(ep.evidence || []).length} evidence item(s):`);
      for (const item of ep.evidence || []) {
        console.log(`    • [${item.evidenceId}] ${item.domain} (${item.relationship}) - text length: ${item.textLength} chars`);
      }
    }
  } else {
    console.log("  (Evidence preparation stage not captured)");
  }

  // 8. Evaluation
  printSubHeader("8. Claim Evaluations");
  const evalList = Array.isArray(stages.evaluation)
    ? stages.evaluation
    : stages.evaluation
    ? [stages.evaluation]
    : [];

  if (evalList.length > 0) {
    for (const ev of evalList) {
      console.log(`  Claim [${ev.claimId}]:`);
      console.log(`    Verdict:    ${ev.verdict.toUpperCase()}`);
      console.log(`    Confidence: ${ev.confidence}`);
      console.log(`    Citations:  [${(ev.evidenceIds || []).join(", ")}]`);
      if (ev.importantNotes && ev.importantNotes.length > 0) {
        console.log(`    Notes:      ${ev.importantNotes.join(" | ")}`);
      }
    }
  } else {
    console.log("  (Evaluation stage not captured)");
  }

  // 9. Omissions
  printSubHeader("9. Context & Omissions");
  if (stages.omissions) {
    const detected = stages.omissions.detected || [];
    const discarded = stages.omissions.discarded || [];
    console.log(`  Material Omissions Detected: ${detected.length}`);
    for (const o of detected) {
      console.log(`    • [${o.id}] (${o.severity}): ${o.description}`);
    }
    console.log(`  Omission Candidates Discarded: ${discarded.length}`);
    for (const d of discarded) {
      console.log(`    ✖ Discarded: ${d.reason}`);
    }
  } else {
    console.log("  (Omissions stage not captured or none detected)");
  }

  // 10. Scoring
  printSubHeader("10. Deterministic Scoring & Verdict");
  if (stages.scoring) {
    console.log(`  Final Score:   ${stages.scoring.finalScore} / 100`);
    console.log(`  Final Verdict: ${stages.scoring.verdict}`);
    console.log(`  Omission Pen:  -${stages.scoring.omissionPenalty} points`);
    console.log(`  Conf Adjust:   ${stages.scoring.confidenceAdjustment} points`);
    const overrides = stages.scoring.overridesFired || [];
    console.log(`  Overrides (${overrides.length}):`);
    if (overrides.length > 0) {
      for (const ov of overrides) {
        console.log(`    ⚠️ [${ov.name}] ${ov.reason}`);
      }
    } else {
      console.log("    None (Baseline score mapping applied)");
    }
  } else {
    console.log("  (Scoring stage not captured)");
  }

  // ── 11. SUSPICIOUS PATTERNS ANALYSIS ───────────────────────────────────────
  printSectionHeader("Suspicious Patterns & Diagnostic Flags");

  const suspiciousPatterns: Array<{ category: string; description: string }> = [];

  // Pattern A: Searches that returned zero results
  if (Array.isArray(stages.search)) {
    for (const sr of stages.search) {
      if (!sr.results || sr.results.length === 0) {
        suspiciousPatterns.push({
          category: "SEARCH_ZERO_RESULTS",
          description: `Search returned 0 results for claim [${sr.claimId}] (Queries: "${(sr.queries || []).join('", "')}")`,
        });
      }
    }
  }

  // Pattern B: Claims whose evaluator received zero evidence
  if (prepList.length > 0) {
    for (const ep of prepList) {
      if (!ep.evidence || ep.evidence.length === 0) {
        suspiciousPatterns.push({
          category: "EVALUATOR_ZERO_EVIDENCE",
          description: `Evaluator for claim [${ep.claimId}] received 0 evidence items`,
        });
      }
    }
  }

  // Pattern C: Fetch failures
  if (fetchList.length > 0) {
    for (const sf of fetchList) {
      for (const rec of sf.records || []) {
        if (rec.attempted && !rec.success) {
          suspiciousPatterns.push({
            category: "FETCH_FAILURE",
            description: `Full source content retrieval failed for: ${rec.url} (${rec.errorReason || "Network/scraper error"})`,
          });
        }
      }
    }
  }

  // Pattern D: Evidence where only snippets were used
  if (fetchList.length > 0) {
    const snippetOnly = fetchList.flatMap((sf) =>
      (sf.records || []).filter((r: any) => r.contentUsed === "snippet")
    );
    if (snippetOnly.length > 0) {
      suspiciousPatterns.push({
        category: "SNIPPET_ONLY_USED",
        description: `${snippetOnly.length} evidence item(s) fell back to search snippet only (no full content)`,
      });
    }
  }

  // Pattern E: A score override that fired
  if (stages.scoring?.overridesFired && stages.scoring.overridesFired.length > 0) {
    for (const ov of stages.scoring.overridesFired) {
      suspiciousPatterns.push({
        category: "SCORE_OVERRIDE_FIRED",
        description: `Override fired: [${ov.name}] ${ov.reason}`,
      });
    }
  }

  // Pattern F: Claims evaluated "insufficient" while search results existed
  if (evalList.length > 0 && Array.isArray(stages.search)) {
    for (const ev of evalList) {
      if (ev.verdict === "insufficient") {
        const matchingSearch = stages.search.find((s: any) => s.claimId === ev.claimId);
        if (matchingSearch && matchingSearch.results && matchingSearch.results.length > 0) {
          suspiciousPatterns.push({
            category: "INSUFFICIENT_DESPITE_SEARCH_RESULTS",
            description: `Claim [${ev.claimId}] evaluated as "insufficient" despite ${matchingSearch.results.length} search results returned by provider`,
          });
        }
      }
    }
  }

  if (suspiciousPatterns.length === 0) {
    console.log("  ✅ No suspicious patterns detected! All stages executed within normal parameters.\n");
  } else {
    console.log(`  ⚠️ ${suspiciousPatterns.length} potential issue(s) or diagnostic pattern(s) identified:\n`);
    for (let i = 0; i < suspiciousPatterns.length; i++) {
      const p = suspiciousPatterns[i];
      console.log(`  ${i + 1}. [${p.category}]`);
      console.log(`     ${p.description}`);
    }
    console.log("");
  }

  console.log("=".repeat(80) + "\n");
}

main();

