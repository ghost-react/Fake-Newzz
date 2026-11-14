import * as cheerio from "cheerio";

export interface DirectExtractionResult {
  title: string;
  content: string;
  wordCount: number;
  author: string | null;
  publishedAt: string | null;
  featuredImage: string | null;
  canonicalUrl: string | null;
  finalUrl: string;
  sourceDomain: string;
  extractionState: "success" | "partial" | "insufficient" | "failed";
  reason?: string;
}

export async function extractArticleDirectly(
  targetUrl: string,
  timeoutMs: number = 15000
): Promise<DirectExtractionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timer);

    const finalUrl = res.url || targetUrl;
    let sourceDomain = "";
    try {
      sourceDomain = new URL(finalUrl).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      sourceDomain = "unknown";
    }

    if (!res.ok) {
      return {
        title: "",
        content: "",
        wordCount: 0,
        author: null,
        publishedAt: null,
        featuredImage: null,
        canonicalUrl: null,
        finalUrl,
        sourceDomain,
        extractionState: "failed",
        reason: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. Remove non-content elements
    $("script, style, noscript, iframe, svg, nav, footer, header, aside").remove();
    $(
      ".ad, .ads, .advertisement, .cookie-banner, .consent-banner, .social-share, .newsletter-signup, .related-articles, #comments, .comments"
    ).remove();

    // 2. Extract Canonical URL
    const canonicalUrl = $('link[rel="canonical"]').attr("href") || null;

    // 3. Extract JSON-LD metadata if present
    let jsonLdTitle: string | null = null;
    let jsonLdBody: string | null = null;
    let jsonLdAuthor: string | null = null;
    let jsonLdDate: string | null = null;
    let jsonLdImage: string | null = null;

    const ldScriptElements = $('script[type="application/ld+json"]').toArray();
    for (const elem of ldScriptElements) {
      try {
        const text = $(elem).text().trim();
        if (!text) continue;
        const parsed = JSON.parse(text);
        const candidates = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];

        for (const item of candidates) {
          if (
            item["@type"] === "NewsArticle" ||
            item["@type"] === "Article" ||
            item["@type"] === "BlogPosting" ||
            item["@type"] === "Report"
          ) {
            if (!jsonLdTitle && item.headline) jsonLdTitle = String(item.headline).trim();
            if (!jsonLdBody && item.articleBody) jsonLdBody = String(item.articleBody).trim();
            if (!jsonLdDate && (item.datePublished || item.dateCreated)) {
              jsonLdDate = String(item.datePublished || item.dateCreated).trim();
            }
            if (!jsonLdAuthor) {
              if (typeof item.author === "string") jsonLdAuthor = item.author.trim();
              else if (Array.isArray(item.author) && item.author[0]?.name) jsonLdAuthor = item.author[0].name.trim();
              else if (item.author?.name) jsonLdAuthor = item.author.name.trim();
            }
            if (!jsonLdImage) {
              if (typeof item.image === "string") jsonLdImage = item.image.trim();
              else if (Array.isArray(item.image) && typeof item.image[0] === "string") jsonLdImage = item.image[0].trim();
              else if (item.image?.url) jsonLdImage = item.image.url.trim();
            }
          }
        }
      } catch {}
    }

    // 4. Extract OpenGraph and Twitter Metadata
    const ogTitle = $('meta[property="og:title"]').attr("content") || $('meta[name="twitter:title"]').attr("content");
    const docTitle = $("title").text().trim();
    const h1Title = $("h1").first().text().trim();

    const title = (jsonLdTitle || ogTitle || h1Title || docTitle || "").replace(/\s+/g, " ").trim();

    const ogAuthor =
      $('meta[name="author"]').attr("content") ||
      $('meta[property="article:author"]').attr("content") ||
      $('meta[name="twitter:creator"]').attr("content");
    const author = (jsonLdAuthor || ogAuthor || null)?.replace(/\s+/g, " ").trim() || null;

    const ogDate =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="publication_date"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $("time").attr("datetime");
    const publishedAt = jsonLdDate || ogDate || null;

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href");
    let featuredImage = jsonLdImage || ogImage || null;
    if (featuredImage && !featuredImage.startsWith("http")) {
      try {
        featuredImage = new URL(featuredImage, finalUrl).toString();
      } catch {
        featuredImage = null;
      }
    }

    // 5. Extract Article Body
    let articleText = "";

    // If JSON-LD provided a rich articleBody (at least 60 words), prefer it
    const bodyCandidate: string | null = jsonLdBody;
    if (typeof bodyCandidate === "string" && bodyCandidate.split(/\s+/).filter(Boolean).length >= 60) {
      articleText = bodyCandidate;
    } else {
      // Look for semantic article containers
      const articleContainers = [
        "article",
        '[itemprop="articleBody"]',
        "main",
        ".article-body",
        ".story-body",
        ".article__content",
        ".article-content",
        ".entry-content",
        ".post-content",
        "#article-body",
      ];

      let bestContainer: any = null;
      for (const selector of articleContainers) {
        const el = $(selector);
        if (el.length > 0) {
          bestContainer = el.first();
          break;
        }
      }

      const scope = bestContainer && bestContainer.length > 0 ? bestContainer : $("body");
      const paragraphs: string[] = [];

      const pElements = scope.find("p").toArray();
      for (const p of pElements) {
        const pText = $(p).text().replace(/\s+/g, " ").trim();
        // Ignore tiny snippets like "Advertisement", copyright lines, or 1-word captions
        if (pText.length > 30 && !/^(advertisement|read also|subscribe|share this|copyright)/i.test(pText)) {
          paragraphs.push(pText);
        }
      }

      articleText = paragraphs.join("\n\n");
    }

    const wordCount = articleText.split(/\s+/).filter(Boolean).length;

    // 6. Determine extraction state
    if (wordCount < 40) {
      return {
        title,
        content: articleText,
        wordCount,
        author,
        publishedAt,
        featuredImage,
        canonicalUrl,
        finalUrl,
        sourceDomain,
        extractionState: wordCount === 0 ? "failed" : "insufficient",
        reason: wordCount === 0 ? "No article text found in page body." : `Only ${wordCount} words extracted.`,
      };
    }

    const isPartial = !title || !author || !publishedAt;

    return {
      title: title || "Untitled Article",
      content: articleText,
      wordCount,
      author,
      publishedAt,
      featuredImage,
      canonicalUrl,
      finalUrl,
      sourceDomain,
      extractionState: isPartial ? "partial" : "success",
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      title: "",
      content: "",
      wordCount: 0,
      author: null,
      publishedAt: null,
      featuredImage: null,
      canonicalUrl: null,
      finalUrl: targetUrl,
      sourceDomain: "",
      extractionState: "failed",
      reason: err?.message || String(err),
    };
  }
}

