import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TraceRecorder,
  isTracingEnabled,
  withTrace,
  traceStage,
  traceError,
  getActiveTrace,
} from "../src/lib/debug/trace";

test("Opt-in Debug Trace Test Suite", async (t) => {
  await t.test("Tracing is disabled by default when env is unset", () => {
    delete process.env.FAKENEWZZ_TRACE;
    assert.strictEqual(isTracingEnabled(), false);
    assert.strictEqual(getActiveTrace(), undefined);
  });

  await t.test("Tracing is hard-disabled in production regardless of variable", () => {
    const oldEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    process.env.FAKENEWZZ_TRACE = "true";
    assert.strictEqual(isTracingEnabled(), false);
    (process.env as any).NODE_ENV = oldEnv;
    delete process.env.FAKENEWZZ_TRACE;
  });

  await t.test("TraceRecorder records stages, errors, sanitizes secrets, and flushes to disk", async () => {
    process.env.FAKENEWZZ_TRACE = "true";
    process.env.SERPER_API_KEY = "super_secret_serper_key_12345";

    const { result, tracePath } = await withTrace(async (recorder) => {
      traceStage("input", {
        inputType: "url",
        inputLength: 35,
        preview: "https://example.com/breaking-news",
      });

      traceStage("search", {
        claimId: "c1",
        queries: ["test query with secret super_secret_serper_key_12345"],
        results: [],
      });

      traceError("ingestion", new Error("Simulated scraping timeout"));

      return { status: "ok" };
    }, "unit-test-run-1");

    assert.strictEqual(result.status, "ok");
    assert.ok(tracePath);
    assert.ok(fs.existsSync(tracePath!));

    const raw = fs.readFileSync(tracePath!, "utf-8");
    const parsed = JSON.parse(raw);

    // Verify secrets are redacted
    assert.ok(!raw.includes("super_secret_serper_key_12345"));
    assert.ok(raw.includes("[REDACTED_API_KEY]"));

    // Verify stages recorded
    assert.strictEqual(parsed.runId, "unit-test-run-1");
    assert.strictEqual(parsed.stages.input.inputType, "url");
    assert.strictEqual(parsed.errors.ingestion, "Simulated scraping timeout");
    assert.ok(parsed.totalDurationMs >= 0);

    // Clean up
    delete process.env.FAKENEWZZ_TRACE;
    delete process.env.SERPER_API_KEY;
    if (fs.existsSync(tracePath!)) {
      fs.unlinkSync(tracePath!);
    }
  });

  await t.test("Trace calls never throw even when invalid data is provided", () => {
    process.env.FAKENEWZZ_TRACE = "true";
    const recorder = new TraceRecorder("safe-test");
    // Circular object
    const circular: any = { a: 1 };
    circular.self = circular;

    assert.doesNotThrow(() => {
      recorder.stage("circular", circular);
      recorder.error("err", null);
      recorder.flush();
    });

    delete process.env.FAKENEWZZ_TRACE;
  });
});

