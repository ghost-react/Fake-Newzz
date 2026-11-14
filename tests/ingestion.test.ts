import test from "node:test";
import assert from "node:assert/strict";

// Modules under test
import {
  validateSafeUrl,
  normalizeFirecrawlArticle,
} from "../src/lib/ingestion/article";
import { ArticleSchema } from "../src/schemas/article";
import { scrapeArticleWithFirecrawl } from "../src/lib/ingestion/firecrawl";

test("Phase 2 Article Ingestion Test Suite", async (t) => {
  // 1. VALID URL
  await t.test("1. valid URL - successfully validates standard public http and https URLs", () => {
    const validUrls = [
      "https://apnews.com/article/technology-ai-breakthrough",
      "http://reuters.com/investigates/special-report",
      "https://www.bbc.com/news/world-us-canada-12345678",
      "https://subdomain.news.example.org/path/to/story?utm_source=feed#section",
    ];

    for (const url of validUrls) {
      const result = validateSafeUrl(url);
      assert.strictEqual(result.isValid, true, `Expected ${url} to be valid`);
      assert.ok(result.sanitizedUrl, `Expected sanitizedUrl for ${url}`);
      assert.strictEqual(result.errorCode, undefined);
    }
  });

  // 2. INVALID URL & SSRF
  await t.test("2. invalid URL - blocks malformed protocols, local addresses, and private IP ranges (SSRF)", () => {
    const invalidUrls = [
      // Malformed / Non-HTTP protocols
      "not-a-valid-url",
      "javascript:alert(1)",
      "ftp://files.example.com/article",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",

      // Loopback / Localhost
      "http://localhost:3000/api",
      "http://127.0.0.1:8080/secret",
      "http://127.0.0.2/admin",
      "http://[::1]/internal",

      // RFC 1918 Private ranges
      "http://10.0.0.1/network-status",
      "http://192.168.1.1/router-login",
      "http://172.16.0.1/private",
      "http://172.31.255.255/confidential",

      // Cloud Metadata & Link-Local
      "http://169.254.169.254/latest/meta-data/",

      // Internal / Non-TLD domains
      "http://intranet/wiki",
      "http://dev-server.local/story",
      "http://backend.internal/",
    ];

    for (const url of invalidUrls) {
      const result = validateSafeUrl(url);
      assert.strictEqual(result.isValid, false, `Expected ${url} to be blocked`);
      assert.strictEqual(result.errorCode, "INVALID_URL", `Expected INVALID_URL code for ${url}`);
      assert.ok(result.errorMessage, "Expected user-friendly error message");
    }
  });

  // 3. MISSING URL
  await t.test("3. missing URL - rejects empty, blank, or non-string inputs", () => {
    const missingInputs = ["", "   ", "\t\n", null, undefined];

    for (const input of missingInputs) {
      const result = validateSafeUrl(input);
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errorCode, "MISSING_URL");
      assert.ok(result.errorMessage);
    }
  });

  // 4. SUCCESSFUL ARTICLE EXTRACTION
  await t.test("4. successful article extraction - correctly normalizes rich Firecrawl response", () => {
    const rawFirecrawl = {
      markdown: "## Landmark Accord\n\nGlobal envoys concluded marathon negotiations in Geneva today.",
      metadata: {
        title: "Global Accord Finalized on Clean Energy Transition",
        description: "Envoys from 140 countries signed the landmark Geneva framework.",
        author: "Sarah Jenkins, David Miller",
        published_time: "2026-03-12T14:30:00Z",
        ogImage: "https://example.com/media/accord-signing.jpg",
      },
    };

    const targetUrl = "https://globaldispatch.org/articles/energy-accord-geneva";
    const article = normalizeFirecrawlArticle(rawFirecrawl, targetUrl);

    assert.strictEqual(article.url, targetUrl);
    assert.strictEqual(article.title, "Global Accord Finalized on Clean Energy Transition");
    assert.strictEqual(article.description, "Envoys from 140 countries signed the landmark Geneva framework.");
    assert.strictEqual(article.author, "Sarah Jenkins, David Miller");
    assert.strictEqual(article.publishedAt, "2026-03-12T14:30:00.000Z");
    assert.strictEqual(article.sourceDomain, "globaldispatch.org");
    assert.strictEqual(article.featuredImage, "https://example.com/media/accord-signing.jpg");
    assert.strictEqual(article.content, "## Landmark Accord\n\nGlobal envoys concluded marathon negotiations in Geneva today.");
    assert.strictEqual(article.wordCount, 11);

    // Strict schema parse must succeed
    const schemaValidation = ArticleSchema.safeParse(article);
    assert.strictEqual(schemaValidation.success, true);
  });

  // 5. MISSING AUTHOR
  await t.test("5. missing author - normalizes to null and preserves schema validity without inventing values", () => {
    const rawFirecrawl = {
      markdown: "# Economic Outlook\n\nQuarterly productivity measures showed moderate gains across all sectors.",
      metadata: {
        title: "Quarterly Productivity Measures Up",
        description: "National statistics agency releases Q1 benchmark indicators.",
        author: null,
        byline: "",
        authors: [],
        published_time: "2026-04-01T08:00:00Z",
      },
    };

    const targetUrl = "https://financialwire.net/economy/q1-productivity";
    const article = normalizeFirecrawlArticle(rawFirecrawl, targetUrl);

    assert.strictEqual(article.author, null, "Missing author must strictly be null");
    assert.strictEqual(article.publishedAt, "2026-04-01T08:00:00.000Z");

    const schemaValidation = ArticleSchema.safeParse(article);
    assert.strictEqual(schemaValidation.success, true);
  });

  // 6. MISSING PUBLICATION DATE
  await t.test("6. missing publication date - normalizes to null and passes strict schema", () => {
    const rawFirecrawl = {
      markdown: "# Archive Feature\n\nAn investigative overview of historic municipal transit networks.",
      metadata: {
        title: "Historic Municipal Transit Networks",
        description: "An archival review of 20th-century metropolitan planning.",
        author: "Marcus Chen",
        published_time: null,
        date: undefined,
        publication_date: "",
      },
    };

    const targetUrl = "https://urbanaffairs.org/archive/transit-networks";
    const article = normalizeFirecrawlArticle(rawFirecrawl, targetUrl);

    assert.strictEqual(article.publishedAt, null, "Missing publication date must strictly be null");
    assert.strictEqual(article.author, "Marcus Chen");

    const schemaValidation = ArticleSchema.safeParse(article);
    assert.strictEqual(schemaValidation.success, true);
  });

  // 7. FIRECRAWL FAILURE
  await t.test("7. Firecrawl failure - handles API network errors gracefully without secret leakage", async () => {
    const originalKey = process.env.FIRECRAWL_API_KEY;
    try {
      process.env.FIRECRAWL_API_KEY = "";

      await assert.rejects(
        async () => {
          await scrapeArticleWithFirecrawl("https://example.com/test");
        },
        (err: any) => {
          assert.strictEqual(err.code, "CONFIG_ERROR");
          assert.strictEqual(err.message, "FIRECRAWL_API_KEY is not configured.");
          return true;
        }
      );
    } finally {
      process.env.FIRECRAWL_API_KEY = originalKey;
    }
  });

  // 8. EMPTY ARTICLE CONTENT
  await t.test("8. empty article content - rejects and throws ARTICLE_CONTENT_EMPTY", () => {
    const emptyCandidates = [
      { markdown: "", metadata: { title: "Empty Page" } },
      { markdown: "   \n\n\t  ", metadata: { title: "Whitespace Page" } },
      { markdown: undefined, metadata: { title: "No Markdown" } },
    ];

    for (const raw of emptyCandidates) {
      assert.throws(
        () => {
          normalizeFirecrawlArticle(raw as any, "https://example.com/empty-article");
        },
        (err: any) => {
          assert.strictEqual(err.code, "ARTICLE_CONTENT_EMPTY");
          assert.ok(err.message.includes("no readable content"));
          return true;
        }
      );
    }
  });

  // 9. MALFORMED FIRECRAWL RESPONSE
  await t.test("9. malformed Firecrawl response - strictly validates and rejects corrupt or invalid types", () => {
    const invalidTypes = [
      {
        url: "not-a-valid-url",
        title: "Test Title",
        description: null,
        author: null,
        publishedAt: null,
        sourceDomain: "example.com",
        featuredImage: null,
        content: "Valid content string",
        wordCount: 3,
      },
      {
        url: "https://example.com/article",
        title: "", // empty title
        description: null,
        author: null,
        publishedAt: null,
        sourceDomain: "example.com",
        featuredImage: null,
        content: "Valid content string",
        wordCount: 3,
      },
      {
        url: "https://example.com/article",
        title: "Test Title",
        description: null,
        author: null,
        publishedAt: null,
        sourceDomain: "", // empty source domain
        featuredImage: null,
        content: "Valid content string",
        wordCount: 3,
      },
      {
        url: "https://example.com/article",
        title: "Test Title",
        description: null,
        author: null,
        publishedAt: null,
        sourceDomain: "example.com",
        featuredImage: null,
        content: "Valid content string",
        wordCount: -5, // negative word count
      },
      {
        url: "https://example.com/article",
        title: "Test Title",
        description: 12345, // invalid type
        author: null,
        publishedAt: null,
        sourceDomain: "example.com",
        featuredImage: null,
        content: "Valid content string",
        wordCount: 3,
      },
    ];

    for (const candidate of invalidTypes) {
      const parsed = ArticleSchema.safeParse(candidate);
      assert.strictEqual(parsed.success, false, `Expected schema to reject ${JSON.stringify(candidate)}`);
    }
  });
});
