import { z } from "zod";

export const BENCHMARK_CATEGORIES = [
  "genuine",
  "false",
  "misleading",
  "partially_true",
  "missing_context",
  "conflicting_reports",
  "syndicated",
  "breaking_news",
  "genuine_quote",
  "wrong_attribution",
  "blocked_source",
  "short_text",
  "long_text",
] as const;

export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

export const BENCHMARK_INPUT_TYPES = [
  "url",
  "headline",
  "claim",
  "text",
] as const;

export type BenchmarkInputType = (typeof BENCHMARK_INPUT_TYPES)[number];

export const BenchmarkCaseSchema = z.object({
  id: z.string().min(1, "Case id must not be empty"),
  category: z.enum(BENCHMARK_CATEGORIES),
  inputType: z.enum(BENCHMARK_INPUT_TYPES),
  input: z.string(),
  acceptableVerdicts: z.array(z.string()),
  forbiddenVerdicts: z.array(z.string()),
  scoreRange: z
    .tuple([z.number().min(0).max(100), z.number().min(0).max(100)])
    .nullable(),
  notes: z.string(),
  labeledBy: z.string(),
  labeledOn: z.string(),
});

export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export const BenchmarkCasesSchema = z.array(BenchmarkCaseSchema);

