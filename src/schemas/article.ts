import { z } from "zod";

/**
 * Strict Article schema representing normalized news article ingestion.
 * Rejects invalid, missing, or malformed data types.
 */
export const ArticleSchema = z
  .object({
    url: z.string().trim().url({ message: "Article URL must be a valid URL string" }),
    title: z.string().trim().min(1, { message: "Article title cannot be empty" }),
    description: z.string().nullable(),
    author: z.string().nullable(),
    publishedAt: z.string().nullable(),
    sourceDomain: z.string().trim().min(1, { message: "Source domain cannot be empty" }),
    featuredImage: z.string().nullable(),
    content: z.string().trim().min(1, { message: "Article content cannot be empty" }),
    wordCount: z.number().int().nonnegative({ message: "Word count must be a non-negative integer" }),
    sourceReadStatus: z.enum(["success", "partial", "failed", "insufficient", "readable", "unreadable", "could_not_read"]).optional(),
    headlineSource: z.enum(["metadata", "url_search", "url_slug"]).nullable().optional(),
    finalUrl: z.string().optional(),
    canonicalUrl: z.string().nullable().optional(),
    extractionReason: z.string().optional(),
  })
  .strict();

export type Article = z.infer<typeof ArticleSchema>;

/**
 * Input request validation schema for POST /api/article
 */
export const IngestArticleRequestSchema = z.object({
  url: z.string().trim().min(1, { message: "URL cannot be empty" }),
});

export type IngestArticleRequest = z.infer<typeof IngestArticleRequestSchema>;

/**
 * API Standard Error Response Structure
 */
export interface ArticleApiError {
  code: string;
  message: string;
}

export interface ArticleSuccessResponse {
  success: true;
  article: Article;
}

export interface ArticleErrorResponse {
  success: false;
  error: ArticleApiError;
}

export type ArticleApiResponse = ArticleSuccessResponse | ArticleErrorResponse;
