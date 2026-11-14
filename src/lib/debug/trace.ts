import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Checks whether tracing is currently enabled.
 * Default is OFF.
 * Hard-disabled when NODE_ENV === "production" regardless of FAKENEWZZ_TRACE.
 */
export function isTracingEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.FAKENEWZZ_TRACE === "true";
}

/**
 * Generates runId = timestamp + short random id.
 */
function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

/**
 * Sanitizes data for tracing:
 * - Redacts API keys and sensitive credentials
 * - Truncates any text field to max 2,000 characters
 * - Omits headers, cookies, auth tokens, and full article bodies
 */
export function sanitizeForTrace(val: any, depth = 0): any {
  if (depth > 7) return "[MaxDepth]";
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    let s = val;
    // Strip known secrets
    const secrets = [
      process.env.SERPER_API_KEY,
      process.env.Serper_API_Key,
      process.env.FIRECRAWL_API_KEY,
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      process.env.ANTHROPIC_API_KEY,
    ].filter((k): k is string => Boolean(k && k.length > 5));

    for (const secret of secrets) {
      s = s.split(secret).join("[REDACTED_API_KEY]");
    }

    if (s.length > 2000) {
      return s.slice(0, 2000) + "... [TRUNCATED_2000]";
    }
    return s;
  }

  if (typeof val === "number" || typeof val === "boolean") return val;

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForTrace(item, depth + 1));
  }

  if (typeof val === "object") {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lowerKey = k.toLowerCase();
      // Drop headers, auth, cookies, and large article bodies
      if (
        lowerKey.includes("auth") ||
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey === "headers" ||
        lowerKey === "cookie" ||
        lowerKey === "cookies" ||
        (lowerKey === "content" && typeof v === "string" && v.length > 500) ||
        (lowerKey === "body" && typeof v === "string" && v.length > 500)
      ) {
        continue;
      }
      res[k] = sanitizeForTrace(v, depth + 1);
    }
    return res;
  }

  return String(val);
}

export interface TraceRecord {
  runId: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  stageTimings: Record<string, number>;
  stages: Record<string, any>;
  errors: Record<string, string>;
  timeline: Array<{
    name: string;
    timestamp: string;
    durationMs?: number;
    data?: any;
    error?: string;
  }>;
}

/**
 * Opt-in TraceRecorder created once per verification run.
 */
export class TraceRecorder {
  public readonly runId: string;
  public readonly startTime: number;
  public readonly stages: Record<string, any> = {};
  public readonly stageTimings: Record<string, number> = {};
  public readonly stageErrors: Record<string, string> = {};
  public readonly timeline: Array<{
    name: string;
    timestamp: string;
    durationMs?: number;
    data?: any;
    error?: string;
  }> = [];

  private lastStageTime: number;

  constructor(runId?: string) {
    this.runId = runId || generateRunId();
    this.startTime = performance.now();
    this.lastStageTime = this.startTime;
  }

  /**
   * Records a pipeline stage with data.
   */
  stage(name: string, data: any): void {
    try {
      if (!isTracingEnabled()) return;
      const now = performance.now();
      const stageDuration = Math.round(now - this.lastStageTime);
      this.lastStageTime = now;
      this.stageTimings[name] = (this.stageTimings[name] || 0) + stageDuration;

      const sanitizedData = sanitizeForTrace(data);

      // If a stage is called multiple times (e.g. per-claim ranking), store as array
      if (this.stages[name] !== undefined) {
        if (!Array.isArray(this.stages[name])) {
          this.stages[name] = [this.stages[name]];
        }
        this.stages[name].push(sanitizedData);
      } else {
        this.stages[name] = sanitizedData;
      }

      this.timeline.push({
        name,
        timestamp: new Date().toISOString(),
        durationMs: stageDuration,
        data: sanitizedData,
      });
    } catch {
      // Tracing failure must NEVER throw or impact verification
    }
  }

  /**
   * Records a stage error.
   */
  error(stageName: string, err: any): void {
    try {
      if (!isTracingEnabled()) return;
      const errMsg = sanitizeForTrace(
        err instanceof Error ? err.message : String(err)
      );
      this.stageErrors[stageName] = errMsg;
      this.timeline.push({
        name: `${stageName}:error`,
        timestamp: new Date().toISOString(),
        error: errMsg,
      });
    } catch {
      // Tracing failure must NEVER throw
    }
  }

  /**
   * Writes the trace record to /.trace/<runId>.json and returns the written file path.
   */
  flush(): string | null {
    try {
      if (!isTracingEnabled()) return null;
      const totalDurationMs = Math.round(performance.now() - this.startTime);
      const traceDir = path.join(process.cwd(), ".trace");
      if (!fs.existsSync(traceDir)) {
        fs.mkdirSync(traceDir, { recursive: true });
      }

      const filePath = path.join(traceDir, `${this.runId}.json`);
      const record: TraceRecord = {
        runId: this.runId,
        startTime: new Date(Date.now() - totalDurationMs).toISOString(),
        endTime: new Date().toISOString(),
        totalDurationMs,
        stageTimings: this.stageTimings,
        stages: this.stages,
        errors: this.stageErrors,
        timeline: this.timeline,
      };

      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
      return filePath;
    } catch {
      return null;
    }
  }
}

/**
 * AsyncLocalStorage context for holding the active run's TraceRecorder.
 */
export const traceStorage = new AsyncLocalStorage<TraceRecorder>();

/**
 * Returns the active TraceRecorder if tracing is enabled and active.
 */
export function getActiveTrace(): TraceRecorder | undefined {
  try {
    if (!isTracingEnabled()) return undefined;
    return traceStorage.getStore();
  } catch {
    return undefined;
  }
}

/**
 * Helper to record a stage in the active trace.
 */
export function traceStage(name: string, data: any): void {
  try {
    getActiveTrace()?.stage(name, data);
  } catch {}
}

/**
 * Helper to record an error in the active trace.
 */
export function traceError(stageName: string, err: any): void {
  try {
    getActiveTrace()?.error(stageName, err);
  } catch {}
}

/**
 * Runs an asynchronous operation within a TraceRecorder AsyncLocalStorage context.
 */
export async function withTrace<T>(
  fn: (recorder: TraceRecorder) => Promise<T>,
  customRunId?: string
): Promise<{ result: T; tracePath: string | null }> {
  if (!isTracingEnabled()) {
    const dummy = new TraceRecorder("disabled");
    const result = await fn(dummy);
    return { result, tracePath: null };
  }

  const recorder = new TraceRecorder(customRunId);
  return traceStorage.run(recorder, async () => {
    try {
      const result = await fn(recorder);
      const tracePath = recorder.flush();
      return { result, tracePath };
    } catch (err) {
      recorder.error("pipeline_fatal", err);
      const tracePath = recorder.flush();
      throw err;
    }
  });
}

