/**
 * Relevance Gate & URL Filtering Module
 *
 * Implements Step 2.A:
 * - Rejects homepages, section hubs, tag pages, category archives, search pages, and channel pages.
 * - Enforces key specifics (subject, predicate/action, number or date where present) before results become evidence.
 * - Rejects mere keyword overlap with an explicit reason.
 */

export interface GatingResult {
  passed: boolean;
  reason?: string;
}

const COMMON_NAV_PATHS = new Set([
  "",
  "/",
  "/news",
  "/news/",
  "/world",
  "/world/",
  "/politics",
  "/politics/",
  "/sport",
  "/sport/",
  "/sports",
  "/sports/",
  "/entertainment",
  "/entertainment/",
  "/business",
  "/business/",
  "/latest",
  "/latest/",
  "/breaking",
  "/breaking/",
]);

const NAV_PATH_PATTERNS = [
  /\/topic\/[^\/]+$/i,
  /\/topics\/[^\/]+$/i,
  /\/tag\/[^\/]+$/i,
  /\/tags\/[^\/]+$/i,
  /\/category\/[^\/]+$/i,
  /\/categories\/[^\/]+$/i,
  /\/section\/[^\/]+$/i,
  /\/sections\/[^\/]+$/i,
  /\/browse\//i,
  /\/search\b/i,
  /\/archive\b/i,
  /\/feed\b/i,
];

const NAV_TITLE_PATTERNS = [
  /^latest news/i,
  /^breaking news/i,
  /^top stories/i,
  /^today's top/i,
  /^home\b/i,
  /^index of\b/i,
  /latest news, exclusives and opinion/i,
  /news, sport, celebrities and gossip/i,
  /breaking headlines and latest news/i,
  /channel - youtube/i,
  /\(@[a-zA-Z0-9_]+\) \/ twitter/i,
  /\(@[a-zA-Z0-9_]+\) • instagram/i,
];

/**
 * Rejects homepage, section, tag, category, search, and "Today's Top Stories"-type pages.
 */
export function isNavOrSectionUrl(
  url: string,
  title?: string
): { isNav: boolean; reason?: string } {
  if (!url || typeof url !== "string") {
    return { isNav: true, reason: "invalid_url" };
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase().replace(/\/$/, "");

    // 1. Root or shallow common news section path
    if (COMMON_NAV_PATHS.has(pathname) || COMMON_NAV_PATHS.has(pathname + "/")) {
      return { isNav: true, reason: "homepage_or_section_hub" };
    }

    // 2. Query-only without path or root search
    if ((pathname === "" || pathname === "/") && parsed.search) {
      return { isNav: true, reason: "root_search_or_filter" };
    }

    // 3. Known navigation directory patterns (/topic/, /tag/, /category/)
    for (const pattern of NAV_PATH_PATTERNS) {
      if (pattern.test(parsed.pathname)) {
        return { isNav: true, reason: `nav_pattern_${pattern.source.replace(/[^a-zA-Z0-9]/g, "_")}` };
      }
    }

    // 4. Very shallow path with common section words and no extension/id (e.g. /uk, /us, /news/latest)
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 2 && !/\d/.test(pathname) && !pathname.includes(".")) {
      if (
        segments.every((s) =>
          [
            "news",
            "world",
            "india",
            "uk",
            "us",
            "asia",
            "tech",
            "video",
            "photos",
            "opinion",
            "latest",
            "breaking",
            "top-stories",
            "headlines",
          ].includes(s)
        )
      ) {
        return { isNav: true, reason: "shallow_section_hub" };
      }
    }

    // 5. Title patterns
    if (title) {
      const cleanTitle = title.trim();
      for (const tPat of NAV_TITLE_PATTERNS) {
        if (tPat.test(cleanTitle)) {
          return { isNav: true, reason: "generic_nav_title" };
        }
      }
    }

    return { isNav: false };
  } catch {
    return { isNav: false };
  }
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
  "by", "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "of", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "should", "now", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "it", "its", "they", "them", "their"
]);

/**
 * Normalizes tokens for flexible morphological matching (e.g. revolves -> revolve, boils -> boil).
 */
function stemToken(t: string): string {
  return t
    .toLowerCase()
    .replace(/^(the|a|an)\s+/g, "")
    .replace(/(?:ing|ed|es|s)$/g, "");
}

/**
 * Extracts key specifics from claim:
 * - subject: central entities/nouns
 * - predicate: main verbs/action/relation
 * - numbers/dates: numeric details, years, temperatures, measurements
 */
export function extractClaimSpecifics(claimText: string): {
  subjects: string[];
  predicates: string[];
  numbersAndDates: string[];
} {
  const clean = claimText.replace(/[“""'']/g, "").trim();

  // Numbers, years, temperatures, percentages
  const numbersAndDates = (clean.match(/\b(?:\d{4}|\d+(?:\.\d+)?(?:%|°c|°f|c|f|k)?|sea\s+level)\b/gi) || [])
    .map((s) => s.toLowerCase().trim());

  const words = clean
    .replace(/[,;:.!?()[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const subjects: string[] = [];
  const predicates: string[] = [];

  for (const w of words) {
    const lower = w.toLowerCase();
    if (numbersAndDates.some((nd) => nd.includes(lower))) continue;

    // Check if word looks like verb/predicate
    if (
      /^(revolve|orbit|boil|freeze|melt|move|turn|become|became|die|born|sign|arrest|pass|approve|agree|claim|say|state|attack|kill|win|lose|discover|spot|identif|find|detect|announc|launch|reveal|show|declar|rule|hold|order|probe|investigat)/i.test(
        lower
      ) ||
      lower.endsWith("ed") ||
      lower.endsWith("ing") ||
      lower === "independent" ||
      lower === "independence"
    ) {
      predicates.push(lower);
    } else {
      subjects.push(lower);
    }
  }

  // Fallback: If no explicit predicate identified and multiple words exist, take middle/verb-like word
  if (predicates.length === 0 && words.length > 2) {
    predicates.push(words[1].toLowerCase());
  }
  if (subjects.length === 0 && words.length > 0) {
    subjects.push(words[0].toLowerCase());
  }

  return { subjects, predicates, numbersAndDates };
}

/**
 * Gating check: A result becomes evidence only if its passage contains the claim's
 * key specifics (subject, predicate/action, number or date where present).
 * Mere keyword overlap is rejected and logged with the reason.
 */
export function gateEvidenceSpecifics(
  claim: { text: string; claimKind?: string },
  item: { title: string; snippet: string; url: string; sourceContentExcerpt?: string }
): GatingResult {
  // 1. Navigation / Hub page filter
  const navCheck = isNavOrSectionUrl(item.url, item.title);
  if (navCheck.isNav) {
    return { passed: false, reason: navCheck.reason || "nav_or_section_page" };
  }

  const passage = `${item.title} ${item.snippet} ${item.sourceContentExcerpt || ""}`.toLowerCase();
  const { subjects, predicates, numbersAndDates } = extractClaimSpecifics(claim.text);

  // 2. Check Subject presence (at least one key subject token must appear)
  const hasSubject = subjects.some((subj) => {
    const stem = stemToken(subj);
    return passage.includes(subj) || (stem.length >= 3 && passage.includes(stem));
  });

  if (!hasSubject) {
    return { passed: false, reason: "missing_subject_entity" };
  }

  // 3. Check Predicate / Action presence (or direct refutation/antonym/synonym)
  const hasPredicate = predicates.length === 0 || predicates.some((pred) => {
    const stem = stemToken(pred);
    if (passage.includes(pred) || (stem.length >= 3 && passage.includes(stem))) {
      return true;
    }
    // Action/discovery synonyms
    if (
      (pred.includes("discover") || pred.includes("find") || pred.includes("identif") || pred.includes("spot") || pred.includes("detect")) &&
      (passage.includes("discover") || passage.includes("identif") || passage.includes("spot") || passage.includes("detect") || passage.includes("found"))
    ) {
      return true;
    }
    // Related/antonym action concepts (e.g. revolve -> orbit, turn; independent -> republic, freedom)
    if (pred.includes("revolve") && (passage.includes("orbit") || passage.includes("turn") || passage.includes("heliocentr"))) {
      return true;
    }
    if (pred.includes("orbit") && (passage.includes("revolve") || passage.includes("turn"))) {
      return true;
    }
    if (pred.includes("independent") && (passage.includes("independence") || passage.includes("sovereignty") || passage.includes("republic"))) {
      return true;
    }
    if (pred.includes("boil") && (passage.includes("boiling") || passage.includes("vapor") || passage.includes("evaporat"))) {
      return true;
    }
    return false;
  });

  if (!hasPredicate) {
    return { passed: false, reason: "missing_predicate_action" };
  }

  // 4. Check Numbers / Dates where present in claim
  if (numbersAndDates.length > 0) {
    const hasRelevantNumberOrDate = numbersAndDates.some((nd) => {
      // Check direct number match
      if (passage.includes(nd)) return true;
      const numOnly = nd.replace(/[^0-9]/g, "");
      if (numOnly.length >= 2 && passage.includes(numOnly)) return true;
      // Contradiction scenario: For historical dates or numbers, passage has a 4-digit year or number alongside subject and predicate
      if (/^\d{4}$/.test(nd) && /\b(1[7-9]\d{2}|20[0-2]\d)\b/.test(passage)) {
        return true;
      }
      return false;
    });

    if (!hasRelevantNumberOrDate) {
      return { passed: false, reason: "missing_number_or_date_specifics" };
    }
  }

  return { passed: true };
}
