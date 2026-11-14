import { SourceType } from "@/schemas/evidence";

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN REGISTRY
// A maintainable, centrally configurable list of known domains.
// Add new entries here without rewriting any classification logic.
// ─────────────────────────────────────────────────────────────────────────────

type MatchMode = "exact" | "suffix" | "contains";

interface DomainEntry {
  pattern: string;
  matchMode: MatchMode;
  type: SourceType;
}

/**
 * Ordered registry of known domains.
 * Priority: exact > suffix > contains
 * Entries checked in order for the same matchMode.
 */
const DOMAIN_REGISTRY: DomainEntry[] = [
  // ── Official: International Organizations ────────────────────────────────
  { pattern: "who.int",        matchMode: "exact",   type: "official" },
  { pattern: "un.org",         matchMode: "exact",   type: "official" },
  { pattern: "worldbank.org",  matchMode: "exact",   type: "official" },
  { pattern: "imf.org",        matchMode: "exact",   type: "official" },
  { pattern: "oecd.org",       matchMode: "exact",   type: "official" },
  { pattern: "wto.org",        matchMode: "exact",   type: "official" },
  { pattern: "nato.int",       matchMode: "exact",   type: "official" },
  { pattern: "europa.eu",      matchMode: "suffix",  type: "official" },

  // ── Official: Government TLD patterns ────────────────────────────────────
  { pattern: ".gov",           matchMode: "suffix",  type: "official" },
  { pattern: ".gov.in",        matchMode: "suffix",  type: "official" },
  { pattern: ".gov.uk",        matchMode: "suffix",  type: "official" },
  { pattern: ".gov.au",        matchMode: "suffix",  type: "official" },
  { pattern: ".gov.ca",        matchMode: "suffix",  type: "official" },
  { pattern: ".gov.sg",        matchMode: "suffix",  type: "official" },
  { pattern: ".gov.nz",        matchMode: "suffix",  type: "official" },
  { pattern: ".nic.in",        matchMode: "suffix",  type: "official" },
  { pattern: ".mil",           matchMode: "suffix",  type: "official" },
  { pattern: ".parliament.uk", matchMode: "suffix",  type: "official" },

  // ── Official: Specific Indian Government portals ──────────────────────────
  { pattern: "pib.gov.in",     matchMode: "exact",   type: "official" },
  { pattern: "mea.gov.in",     matchMode: "exact",   type: "official" },
  { pattern: "sansad.in",      matchMode: "exact",   type: "official" },
  { pattern: "indiabudget.gov.in", matchMode: "exact", type: "official" },
  { pattern: "sebi.gov.in",    matchMode: "exact",   type: "official" },
  { pattern: "rbi.org.in",     matchMode: "exact",   type: "official" },

  // ── Wire Services ─────────────────────────────────────────────────────────
  { pattern: "reuters.com",    matchMode: "exact",   type: "wire" },
  { pattern: "apnews.com",     matchMode: "exact",   type: "wire" },
  { pattern: "afp.com",        matchMode: "exact",   type: "wire" },
  { pattern: "bloomberg.com",  matchMode: "exact",   type: "wire" },
  { pattern: "pti.in",         matchMode: "exact",   type: "wire" },
  { pattern: "ptinews.com",    matchMode: "exact",   type: "wire" },
  { pattern: "ani.in",         matchMode: "exact",   type: "wire" },
  { pattern: "aninews.in",     matchMode: "exact",   type: "wire" },
  { pattern: "ians.in",        matchMode: "exact",   type: "wire" },
  { pattern: "uniindia.com",   matchMode: "exact",   type: "wire" },

  // ── Research / Academic / Science ──────────────────────────────────────────
  { pattern: "nature.com",           matchMode: "exact",   type: "research" },
  { pattern: "sciencedirect.com",    matchMode: "exact",   type: "research" },
  { pattern: "arxiv.org",            matchMode: "exact",   type: "research" },
  { pattern: "space.com",            matchMode: "exact",   type: "research" },
  { pattern: "scientificamerican.com", matchMode: "exact", type: "research" },
  { pattern: "sciencedaily.com",     matchMode: "exact",   type: "research" },
  { pattern: "phys.org",             matchMode: "exact",   type: "research" },
  { pattern: "newscientist.com",     matchMode: "exact",   type: "research" },
  { pattern: "sciencenews.org",      matchMode: "exact",   type: "research" },
  { pattern: "ncbi.nlm.nih.gov",     matchMode: "exact",   type: "research" },
  { pattern: "nih.gov",              matchMode: "suffix",  type: "research" },
  { pattern: "thelancet.com",        matchMode: "exact",   type: "research" },
  { pattern: "cell.com",             matchMode: "exact",   type: "research" },
  { pattern: "biorxiv.org",          matchMode: "exact",   type: "research" },
  { pattern: "medrxiv.org",          matchMode: "exact",   type: "research" },
  { pattern: "jstor.org",            matchMode: "exact",   type: "research" },
  { pattern: "springer.com",         matchMode: "exact",   type: "research" },
  { pattern: "wiley.com",            matchMode: "exact",   type: "research" },
  { pattern: "tandfonline.com",      matchMode: "exact",   type: "research" },
  { pattern: ".edu",                 matchMode: "suffix",  type: "research" },
  { pattern: ".ac.in",               matchMode: "suffix",  type: "research" },
  { pattern: ".ac.uk",               matchMode: "suffix",  type: "research" },
  { pattern: ".ac.nz",               matchMode: "suffix",  type: "research" },
  { pattern: ".ac.au",               matchMode: "suffix",  type: "research" },
  { pattern: ".ac.za",               matchMode: "suffix",  type: "research" },

  // ── Fact-checking Organizations ───────────────────────────────────────────
  { pattern: "snopes.com",          matchMode: "exact",   type: "fact_check" },
  { pattern: "altnews.in",          matchMode: "exact",   type: "fact_check" },
  { pattern: "boomlive.in",         matchMode: "exact",   type: "fact_check" },
  { pattern: "politifact.com",      matchMode: "exact",   type: "fact_check" },
  { pattern: "factcheck.org",       matchMode: "exact",   type: "fact_check" },
  { pattern: "fullfact.org",        matchMode: "exact",   type: "fact_check" },
  { pattern: "vishvasnews.com",     matchMode: "exact",   type: "fact_check" },
  { pattern: "factchecker.in",      matchMode: "exact",   type: "fact_check" },
  { pattern: "logicallyai.com",     matchMode: "exact",   type: "fact_check" },
  { pattern: "checkyourfact.com",   matchMode: "exact",   type: "fact_check" },
  { pattern: "leadstories.com",     matchMode: "exact",   type: "fact_check" },
  { pattern: "africacheck.org",     matchMode: "exact",   type: "fact_check" },

  // ── Social Media ──────────────────────────────────────────────────────────
  { pattern: "twitter.com",    matchMode: "exact",   type: "social" },
  { pattern: "x.com",          matchMode: "exact",   type: "social" },
  { pattern: "facebook.com",   matchMode: "exact",   type: "social" },
  { pattern: "instagram.com",  matchMode: "exact",   type: "social" },
  { pattern: "reddit.com",     matchMode: "exact",   type: "social" },
  { pattern: "youtube.com",    matchMode: "exact",   type: "social" },
  { pattern: "tiktok.com",     matchMode: "exact",   type: "social" },
  { pattern: "linkedin.com",   matchMode: "exact",   type: "social" },
  { pattern: "t.me",           matchMode: "exact",   type: "social" },
  { pattern: "telegram.org",   matchMode: "exact",   type: "social" },
  { pattern: "vk.com",         matchMode: "exact",   type: "social" },

  // ── Blogs / Opinion Platforms ─────────────────────────────────────────────
  { pattern: "medium.com",     matchMode: "exact",   type: "blog" },
  { pattern: "substack.com",   matchMode: "exact",   type: "blog" },
  { pattern: "wordpress.com",  matchMode: "exact",   type: "blog" },
  { pattern: "blogspot.com",   matchMode: "exact",   type: "blog" },
  { pattern: "tumblr.com",     matchMode: "exact",   type: "blog" },
  { pattern: "ghost.io",       matchMode: "suffix",  type: "blog" },

  // ── International News ────────────────────────────────────────────────────
  { pattern: "bbc.com",              matchMode: "exact",   type: "international_news" },
  { pattern: "bbc.co.uk",            matchMode: "exact",   type: "international_news" },
  { pattern: "cnn.com",              matchMode: "exact",   type: "international_news" },
  { pattern: "nytimes.com",          matchMode: "exact",   type: "international_news" },
  { pattern: "theguardian.com",      matchMode: "exact",   type: "international_news" },
  { pattern: "aljazeera.com",        matchMode: "exact",   type: "international_news" },
  { pattern: "aljazeera.net",        matchMode: "exact",   type: "international_news" },
  { pattern: "wsj.com",              matchMode: "exact",   type: "international_news" },
  { pattern: "washingtonpost.com",   matchMode: "exact",   type: "international_news" },
  { pattern: "dw.com",               matchMode: "exact",   type: "international_news" },
  { pattern: "france24.com",         matchMode: "exact",   type: "international_news" },
  { pattern: "ft.com",               matchMode: "exact",   type: "international_news" },
  { pattern: "economist.com",        matchMode: "exact",   type: "international_news" },
  { pattern: "foreignpolicy.com",    matchMode: "exact",   type: "international_news" },
  { pattern: "npr.org",              matchMode: "exact",   type: "international_news" },
  { pattern: "time.com",             matchMode: "exact",   type: "international_news" },
  { pattern: "abc.net.au",           matchMode: "exact",   type: "international_news" },
  { pattern: "scmp.com",             matchMode: "exact",   type: "international_news" },
  { pattern: "channelnewsasia.com",  matchMode: "exact",   type: "international_news" },
  { pattern: "independent.co.uk",    matchMode: "exact",   type: "international_news" },
  { pattern: "telegraph.co.uk",      matchMode: "exact",   type: "international_news" },
  { pattern: "sky.com",              matchMode: "exact",   type: "international_news" },
  { pattern: "euronews.com",         matchMode: "exact",   type: "international_news" },
  { pattern: "japantimes.co.jp",     matchMode: "exact",   type: "international_news" },

  // ── National News (Global & Regional Major Outlets) ───────────────────────
  { pattern: "cbsnews.com",          matchMode: "exact",   type: "national_news" },
  { pattern: "nbcnews.com",          matchMode: "exact",   type: "national_news" },
  { pattern: "abcnews.go.com",       matchMode: "exact",   type: "national_news" },
  { pattern: "usatoday.com",         matchMode: "exact",   type: "national_news" },
  { pattern: "politico.com",         matchMode: "exact",   type: "national_news" },
  { pattern: "axios.com",            matchMode: "exact",   type: "national_news" },
  { pattern: "forbes.com",           matchMode: "exact",   type: "national_news" },
  { pattern: "theverge.com",         matchMode: "exact",   type: "national_news" },
  { pattern: "techcrunch.com",       matchMode: "exact",   type: "national_news" },
  { pattern: "wired.com",            matchMode: "exact",   type: "national_news" },
  { pattern: "arstechnica.com",      matchMode: "exact",   type: "national_news" },

  // ── National News (India) ─────────────────────────────────────────────────
  { pattern: "thehindu.com",                    matchMode: "exact",   type: "national_news" },
  { pattern: "indianexpress.com",               matchMode: "exact",   type: "national_news" },
  { pattern: "hindustantimes.com",              matchMode: "exact",   type: "national_news" },
  { pattern: "ndtv.com",                        matchMode: "exact",   type: "national_news" },
  { pattern: "indiatoday.in",                   matchMode: "exact",   type: "national_news" },
  { pattern: "timesofindia.indiatimes.com",     matchMode: "exact",   type: "national_news" },
  { pattern: "news18.com",                      matchMode: "exact",   type: "national_news" },
  { pattern: "livemint.com",                    matchMode: "exact",   type: "national_news" },
  { pattern: "economictimes.indiatimes.com",    matchMode: "exact",   type: "national_news" },
  { pattern: "theprint.in",                     matchMode: "exact",   type: "national_news" },
  { pattern: "thewire.in",                      matchMode: "exact",   type: "national_news" },
  { pattern: "scroll.in",                       matchMode: "exact",   type: "national_news" },
  { pattern: "business-standard.com",           matchMode: "exact",   type: "national_news" },
  { pattern: "financialexpress.com",            matchMode: "exact",   type: "national_news" },
  { pattern: "swarajyamag.com",                 matchMode: "exact",   type: "national_news" },
  { pattern: "outlookindia.com",                matchMode: "exact",   type: "national_news" },
  { pattern: "firstpost.com",                   matchMode: "exact",   type: "national_news" },
  { pattern: "wionews.com",                     matchMode: "exact",   type: "national_news" },
  { pattern: "zeenews.india.com",               matchMode: "exact",   type: "national_news" },
  { pattern: "aajtak.in",                       matchMode: "exact",   type: "national_news" },

  // ── Regional News (India) ─────────────────────────────────────────────────
  { pattern: "deccanherald.com",    matchMode: "exact",   type: "regional_news" },
  { pattern: "tribuneindia.com",    matchMode: "exact",   type: "regional_news" },
  { pattern: "telegraphindia.com",  matchMode: "exact",   type: "regional_news" },
  { pattern: "mathrubhumi.com",     matchMode: "exact",   type: "regional_news" },
  { pattern: "manoramaonline.com",  matchMode: "exact",   type: "regional_news" },
  { pattern: "eenadu.net",          matchMode: "exact",   type: "regional_news" },
  { pattern: "dinamalar.com",       matchMode: "exact",   type: "regional_news" },
  { pattern: "anandabazar.com",     matchMode: "exact",   type: "regional_news" },
  { pattern: "lokmat.com",          matchMode: "exact",   type: "regional_news" },
  { pattern: "punjabkesari.in",     matchMode: "exact",   type: "regional_news" },
  { pattern: "newkerala.com",       matchMode: "exact",   type: "regional_news" },
  { pattern: "daijiworld.com",      matchMode: "exact",   type: "regional_news" },
  { pattern: "thenewsminute.com",   matchMode: "exact",   type: "regional_news" },
  { pattern: "themorningcontext.com", matchMode: "exact", type: "regional_news" },
];

// ─────────────────────────────────────────────────────────────────────────────
// URL PATTERN CLASSIFICATION (primary documents — highest priority)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * URL-pattern-based classification for primary documents.
 * PDF files, gazettes, court judgments, and official filings
 * are classified as primary_document regardless of domain.
 *
 * Checked BEFORE domain classification.
 */
function classifyByUrlPattern(url: string): SourceType | null {
  const lower = url.toLowerCase();

  // Direct document types
  if (lower.endsWith(".pdf")) return "primary_document";

  // Official gazette and notification paths
  if (
    lower.includes("/gazette/") ||
    lower.includes("/gazetteer/") ||
    lower.includes("/notifications/") ||
    lower.includes("/circulars/") ||
    lower.includes("/orders/") ||
    lower.includes("/decrees/") ||
    lower.includes("/official-gazette")
  ) {
    return "primary_document";
  }

  // Court and legal document paths
  if (
    lower.includes("/judgment/") ||
    lower.includes("/judgement/") ||
    lower.includes("/verdict/") ||
    lower.includes("/court-order/") ||
    lower.includes("/legal-notice/") ||
    lower.includes("/case-status/")
  ) {
    return "primary_document";
  }

  // Parliamentary and legislative documents
  if (
    lower.includes("/act/") ||
    lower.includes("/bill/") ||
    lower.includes("/parliamentary/") ||
    lower.includes("/legislation/") ||
    lower.includes("/statute/")
  ) {
    return "primary_document";
  }

  // Regulatory filings
  if (
    lower.includes("/regulatory-filing") ||
    lower.includes("/annual-report") ||
    lower.includes("/disclosures/")
  ) {
    return "primary_document";
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a source using observable, deterministic signals only.
 *
 * Classification order (highest to lowest priority):
 * 1. URL path patterns (for primary documents)
 * 2. Exact domain match in registry
 * 3. Domain suffix match in registry
 * 4. Domain contains-match in registry
 * 5. Fallback: "other"
 *
 * IMPORTANT:
 * - This classifier describes SOURCE TYPE only.
 * - It does NOT classify political orientation, bias, reliability, or trustworthiness.
 * - All political classifications are strictly prohibited.
 */
export function classifySourceType(domain: string, url: string): SourceType {
  // 1. URL pattern (primary documents — e.g., PDFs, gazette paths)
  const urlType = classifyByUrlPattern(url);
  if (urlType) return urlType;

  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // 2. Exact match
  for (const entry of DOMAIN_REGISTRY) {
    if (entry.matchMode === "exact" && normalizedDomain === entry.pattern) {
      return entry.type;
    }
  }

  // 3. Suffix match (e.g., .gov.in, .edu)
  for (const entry of DOMAIN_REGISTRY) {
    if (entry.matchMode === "suffix" && normalizedDomain.endsWith(entry.pattern)) {
      return entry.type;
    }
  }

  // 4. Contains match
  for (const entry of DOMAIN_REGISTRY) {
    if (entry.matchMode === "contains" && normalizedDomain.includes(entry.pattern)) {
      return entry.type;
    }
  }

  return "other";
}
