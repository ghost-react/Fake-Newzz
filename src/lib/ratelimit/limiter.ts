import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// In-memory sliding window fallback when Upstash Redis is not configured (e.g. local dev / tests)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token && !url.includes("your-database") && !token.includes("your_upstash")) {
    try {
      return new Redis({ url, token });
    } catch {
      return null;
    }
  }
  return null;
}

export function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "127.0.0.1";
}

/**
 * Checks per-IP rate limit.
 * Returns { allowed: boolean, remaining: number, resetSeconds: number }
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const redisKey = `ratelimit:${key}`;
      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, config.windowSeconds);
      }
      const ttl = await redis.ttl(redisKey);
      const remaining = Math.max(0, config.maxRequests - current);
      return {
        allowed: current <= config.maxRequests,
        remaining,
        resetSeconds: ttl > 0 ? ttl : config.windowSeconds,
      };
    } catch {
      // Graceful fallback to memory store if Redis call fails
    }
  }

  // In-memory fallback
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || now > record.resetAt) {
    inMemoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetSeconds: config.windowSeconds,
    };
  }

  record.count += 1;
  const allowed = record.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - record.count);
  const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

  return { allowed, remaining, resetSeconds };
}

/**
 * Daily credit budget guard to prevent unexpected infrastructure cost spikes.
 * Returns true if budget is available, false if daily limit exceeded.
 */
export async function checkDailyBudget(
  creditsCost: number = 1
): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
  const defaultLimit = 500;
  const limitEnv = process.env.DAILY_BUDGET_CREDITS;
  const limit = limitEnv ? parseInt(limitEnv, 10) || defaultLimit : defaultLimit;

  const today = new Date().toISOString().slice(0, 10);
  const budgetKey = `budget:daily:${today}`;

  const redis = getRedisClient();
  if (redis) {
    try {
      const current = await redis.incrby(budgetKey, creditsCost);
      if (current === creditsCost) {
        // Set 48h expiration so old days expire automatically
        await redis.expire(budgetKey, 172800);
      }
      return {
        allowed: current <= limit,
        currentUsage: current,
        limit,
      };
    } catch {
      // If Redis unavailable, allow request
      return { allowed: true, currentUsage: 0, limit };
    }
  }

  // In-memory fallback
  const now = Date.now();
  const record = inMemoryStore.get(budgetKey);
  if (!record) {
    inMemoryStore.set(budgetKey, {
      count: creditsCost,
      resetAt: now + 86400 * 1000,
    });
    return { allowed: creditsCost <= limit, currentUsage: creditsCost, limit };
  }

  record.count += creditsCost;
  return {
    allowed: record.count <= limit,
    currentUsage: record.count,
    limit,
  };
}

/**
 * Enforces per-IP rate limiting and daily budget check for an API route.
 * Returns null if allowed, or NextResponse with appropriate error and headers.
 */
export async function applyRouteGuard(
  request: NextRequest,
  routeKey: string,
  rateConfig: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 },
  budgetCost: number = 0
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const rateLimitKey = `${routeKey}:${ip}`;

  // 1. Check Rate Limit
  const rateResult = await checkRateLimit(rateLimitKey, rateConfig);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please wait before attempting another verification.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateResult.resetSeconds.toString(),
          "X-RateLimit-Limit": rateConfig.maxRequests.toString(),
          "X-RateLimit-Remaining": rateResult.remaining.toString(),
          "X-RateLimit-Reset": rateResult.resetSeconds.toString(),
        },
      }
    );
  }

  // 2. Check Daily Budget if cost > 0
  if (budgetCost > 0) {
    const budgetResult = await checkDailyBudget(budgetCost);
    if (!budgetResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "FakeNewzz is temporarily unavailable due to daily capacity limits. Please try again tomorrow.",
          },
        },
        {
          status: 503,
          headers: {
            "Retry-After": "86400",
          },
        }
      );
    }
  }

  return null;
}

/**
 * Strips internal stack traces, paths, and provider names from error messages.
 */
export function sanitizeErrorMessage(err: unknown, defaultMsg: string): string {
  if (!err) return defaultMsg;
  const msg = typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : String(err);

  // If error mentions internal secrets, tokens, or network paths, sanitize completely
  if (
    /firecrawl|serper|gemini|anthropic|redis|upstash|bearer|secret|key|node_modules|at\s+\w+/i.test(
      msg
    )
  ) {
    return defaultMsg;
  }

  // Strip file paths if any leaked
  const cleaned = msg.replace(/([a-zA-Z]:|\/)[^\s:]+/g, "").trim();
  return cleaned.length > 5 ? cleaned : defaultMsg;
}

