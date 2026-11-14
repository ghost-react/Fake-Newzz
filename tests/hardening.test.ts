import test from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import {
  checkRateLimit,
  checkDailyBudget,
  applyRouteGuard,
  sanitizeErrorMessage,
  getClientIp,
} from "../src/lib/ratelimit/limiter";

test("API Hardening & Public Readiness Suite", async (t) => {
  await t.test("1. Rate limiting allows requests within limit and rejects when exceeded", async () => {
    const testKey = `test-ip-${Date.now()}`;
    const config = { maxRequests: 3, windowSeconds: 2 };

    const r1 = await checkRateLimit(testKey, config);
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.remaining, 2);

    const r2 = await checkRateLimit(testKey, config);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r2.remaining, 1);

    const r3 = await checkRateLimit(testKey, config);
    assert.strictEqual(r3.allowed, true);
    assert.strictEqual(r3.remaining, 0);

    const r4 = await checkRateLimit(testKey, config);
    assert.strictEqual(r4.allowed, false);
    assert.strictEqual(r4.remaining, 0);
  });

  await t.test("2. Daily budget guard blocks when credit budget is exceeded", async () => {
    const origBudget = process.env.DAILY_BUDGET_CREDITS;
    process.env.DAILY_BUDGET_CREDITS = "5";

    const b1 = await checkDailyBudget(2);
    assert.strictEqual(b1.allowed, true);

    const b2 = await checkDailyBudget(3);
    assert.strictEqual(b2.allowed, true);

    const b3 = await checkDailyBudget(1);
    assert.strictEqual(b3.allowed, false);

    if (origBudget !== undefined) {
      process.env.DAILY_BUDGET_CREDITS = origBudget;
    } else {
      delete process.env.DAILY_BUDGET_CREDITS;
    }
  });

  await t.test("3. applyRouteGuard returns 429 when rate limit exceeded", async () => {
    const req = new NextRequest("http://localhost:3000/api/verify", {
      headers: { "x-forwarded-for": `99.99.99.${Date.now() % 250}` },
    });

    const config = { maxRequests: 1, windowSeconds: 5 };
    const guard1 = await applyRouteGuard(req, "test-route", config);
    assert.strictEqual(guard1, null);

    const guard2 = await applyRouteGuard(req, "test-route", config);
    assert.ok(guard2 !== null);
    assert.strictEqual(guard2.status, 429);

    const json = await guard2.json();
    assert.strictEqual(json.error.code, "RATE_LIMIT_EXCEEDED");
  });

  await t.test("4. applyRouteGuard returns 503 maintenance state when budget exceeded", async () => {
    const origBudget = process.env.DAILY_BUDGET_CREDITS;
    process.env.DAILY_BUDGET_CREDITS = "2";

    const req = new NextRequest("http://localhost:3000/api/search", {
      headers: { "x-forwarded-for": `88.88.88.${Date.now() % 250}` },
    });

    // Exceed budget with 5 credits
    const guard = await applyRouteGuard(
      req,
      "test-budget-route",
      { maxRequests: 100, windowSeconds: 60 },
      10
    );

    assert.ok(guard !== null);
    assert.strictEqual(guard.status, 503);
    const json = await guard.json();
    assert.strictEqual(json.error.code, "SERVICE_UNAVAILABLE");
    assert.ok(json.error.message.includes("temporarily unavailable"));

    if (origBudget !== undefined) {
      process.env.DAILY_BUDGET_CREDITS = origBudget;
    } else {
      delete process.env.DAILY_BUDGET_CREDITS;
    }
  });

  await t.test("5. sanitizeErrorMessage strips provider names, stack traces, and keys", () => {
    const defaultMsg = "An unexpected server error occurred.";

    const errWithFirecrawl = new Error(
      "Firecrawl scrape failed with key fc-dummy-mock-test-key-placeholder at node_modules/firecrawl/index.js:50"
    );
    assert.strictEqual(
      sanitizeErrorMessage(errWithFirecrawl, defaultMsg),
      defaultMsg
    );

    const errWithSerper = new Error("Serper API error 403 Forbidden with apiKey mock-serper-key-placeholder");
    assert.strictEqual(
      sanitizeErrorMessage(errWithSerper, defaultMsg),
      defaultMsg
    );

    const cleanErr = new Error("Article content exceeds maximum supported word count");
    assert.strictEqual(
      sanitizeErrorMessage(cleanErr, defaultMsg),
      "Article content exceeds maximum supported word count"
    );
  });

  await t.test("6. Client IP extraction handles forwarded and cloud headers", () => {
    const req1 = new NextRequest("http://localhost:3000", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
    });
    assert.strictEqual(getClientIp(req1), "203.0.113.195");

    const req2 = new NextRequest("http://localhost:3000", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    assert.strictEqual(getClientIp(req2), "198.51.100.1");

    const req3 = new NextRequest("http://localhost:3000", {});
    assert.strictEqual(getClientIp(req3), "127.0.0.1");
  });
});

