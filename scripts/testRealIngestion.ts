import fs from "fs";
import path from "path";
import { scrapeArticleWithFirecrawl } from "../src/lib/ingestion/firecrawl";
import { ingestArticle } from "../src/lib/ingestion/article";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const testUrls = [
    // 1. BBC News article
    "https://www.bbc.com/news/articles/c4gzx8vv2ygo",
    // 2. Associated Press
    "https://apnews.com/article/biden-trump-transition-white-house-meeting-a3a0e665bf6dcb4948705b630dc630c7",
    // 3. Indian news outlet (The Hindu)
    "https://www.thehindu.com/news/national/supreme-court-verdict-on-aligarh-muslim-university-minority-status/article68843236.ece",
  ];

  for (const url of testUrls) {
    console.log("\n==================================================");
    console.log("TESTING URL:", url);
    console.log("==================================================");
    try {
      console.log("Step 1: scrapeArticleWithFirecrawl...");
      const raw = await scrapeArticleWithFirecrawl(url);
      console.log("Raw scrape status:", raw.statusCode);
      console.log("Markdown length:", raw.markdown?.length);
      console.log("Metadata keys:", Object.keys(raw.metadata || {}));
      console.log("Metadata title:", raw.metadata?.title);

      console.log("Step 2: ingestArticle...");
      const article = await ingestArticle(url);
      console.log("SUCCESS! Article Title:", article.title);
      console.log("Article sourceDomain:", article.sourceDomain);
      console.log("Article wordCount:", article.wordCount);
      console.log("Article author:", article.author);
      console.log("Article publishedAt:", article.publishedAt);
      console.log("Article featuredImage:", article.featuredImage);
      console.log("Article sourceReadStatus:", article.sourceReadStatus);
      console.log("Content preview (first 200 chars):", article.content.slice(0, 200));
    } catch (err: any) {
      console.error("FAILED! Error message:", err.message);
      console.error("Error code:", err.code);
      console.error("Error statusCode:", err.statusCode);
      console.error("Full error:", err);
    }
  }
}

main().catch(console.error);

