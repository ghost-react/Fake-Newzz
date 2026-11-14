import Firecrawl from "@mendable/firecrawl-js";

export interface RawFirecrawlScrapeResult {
  markdown?: string;
  metadata?: Record<string, unknown>;
  statusCode?: number;
}

/**
 * Server-side Firecrawl scrape execution.
 * Reads FIRECRAWL_API_KEY strictly from server process.env.
 * Never exposes the key or internal stack traces to the client.
 */
export async function scrapeArticleWithFirecrawl(
  targetUrl: string
): Promise<RawFirecrawlScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "fc-YOUR_API_KEY_HERE") {
    const error = new Error("FIRECRAWL_API_KEY is not configured.");
    (error as any).code = "CONFIG_ERROR";
    throw error;
  }

  const firecrawl = new Firecrawl({ apiKey });

  try {
    // 25 second timeout guard for Firecrawl web request
    const scrapePromise = firecrawl.scrape(targetUrl, {
      formats: ["markdown"],
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        const timeoutErr = new Error("Firecrawl request timed out after 25s.");
        (timeoutErr as any).code = "TIMEOUT";
        reject(timeoutErr);
      }, 25000);

      // Unref timer if supported to allow clean process termination
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    });

    const result = await Promise.race([scrapePromise, timeoutPromise]);

    if (!result || typeof result !== "object") {
      const malformedErr = new Error("Malformed Firecrawl response received.");
      (malformedErr as any).code = "MALFORMED_RESPONSE";
      throw malformedErr;
    }

    const resObj = result as Record<string, any>;

    const markdown =
      typeof resObj.markdown === "string"
        ? resObj.markdown
        : typeof resObj.data?.markdown === "string"
        ? resObj.data.markdown
        : undefined;

    const metadata =
      resObj.metadata && typeof resObj.metadata === "object"
        ? (resObj.metadata as Record<string, unknown>)
        : resObj.data?.metadata && typeof resObj.data.metadata === "object"
        ? (resObj.data.metadata as Record<string, unknown>)
        : {};

    return {
      markdown,
      metadata,
      statusCode: resObj.metadata?.statusCode ?? resObj.statusCode ?? 200,
    };
  } catch (err: any) {
    console.error("[Firecrawl Debug] Caught raw error:", err);
    if (err?.code === "TIMEOUT") {
      throw err;
    }
    if (err?.code === "MALFORMED_RESPONSE") {
      throw err;
    }

    const message = String(err?.message || "").toLowerCase();
    const statusCode = err?.statusCode || err?.status;

    if (
      statusCode === 404 ||
      message.includes("404") ||
      message.includes("not found") ||
      message.includes("err_empty_response") ||
      message.includes("err_name_not_resolved")
    ) {
      const notFoundErr = new Error("The target article was not found or unreachable.");
      (notFoundErr as any).code = "ARTICLE_NOT_FOUND";
      throw notFoundErr;
    }

    const failureErr = new Error("Firecrawl API failed to scrape article.");
    (failureErr as any).code = "FIRECRAWL_FAILED";
    throw failureErr;
  }
}
