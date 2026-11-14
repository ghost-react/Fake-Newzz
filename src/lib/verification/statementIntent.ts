import { ClaimInput } from "@/schemas/evidence";
import { inferClaimCertainty } from "./claimExtractor";

/**
 * Standardized claim types for evidence and attribution evaluation.
 */
export type ExtendedClaimType =
  | "statement_attribution"
  | "quotation_accuracy"
  | "factual_proposition"
  | "interpretation"
  | "paraphrase_accuracy"
  | "event"
  | "factual";

export interface StatementIntentResult {
  isAttributedStatement: boolean;
  speaker: string | null;
  quote: string | null;
  isExactQuote: boolean;
  isParaphrase: boolean;
  hasTransliteration: boolean;
  claimTypes: ExtendedClaimType[];
}

/**
 * Detects whether an input text represents a quoted statement, speech excerpt,
 * or attributed remark by a public figure.
 */
export function detectStatementIntent(text: string): StatementIntentResult {
  if (!text || typeof text !== "string") {
    return {
      isAttributedStatement: false,
      speaker: null,
      quote: null,
      isExactQuote: false,
      isParaphrase: false,
      hasTransliteration: false,
      claimTypes: ["factual"],
    };
  }

  const trimmed = text.trim();

  // Pattern A: "Quote" — Speaker (dash, em-dash, en-dash, hyphen)
  // e.g. "Humare yaha apraadh nhi h crime h" — Samrat Choudhary
  const dashPattern = /^["“'‘](.+?)["”'’]\s*[-—–—]+\s*([A-Z][a-zA-Z\s.'’-]{2,50})$/;
  const dashMatch = trimmed.match(dashPattern);
  if (dashMatch) {
    const quote = dashMatch[1].trim();
    const speaker = dashMatch[2].trim();
    const hasTranslit = detectHinglishOrTransliteration(quote);
    return {
      isAttributedStatement: true,
      speaker,
      quote,
      isExactQuote: true,
      isParaphrase: false,
      hasTransliteration: hasTranslit,
      claimTypes: ["statement_attribution", "factual_proposition", "interpretation"],
    };
  }

  // Pattern B: Colon Attribution (handles both "Speaker: Quote" and "Quote: Speaker")
  if (trimmed.includes(":")) {
    const colonIdx = trimmed.indexOf(":");
    const part1 = trimmed.slice(0, colonIdx).trim();
    const part2 = trimmed.slice(colonIdx + 1).trim();

    if (part1 && part2) {
      const isQuoted = (s: string) => /^["“'‘].+["”'’]$/.test(s);
      const cleanQuotes = (s: string) => s.replace(/^["“'‘]|["”'’]$/g, "").trim();

      let detectedSpeaker: string | null = null;
      let detectedQuote: string | null = null;
      let isExact = false;

      // Case 1: Part 1 is quoted -> Quote: Speaker
      if (isQuoted(part1)) {
        detectedQuote = cleanQuotes(part1);
        detectedSpeaker = cleanQuotes(part2);
        isExact = true;
      }
      // Case 2: Part 2 is quoted -> Speaker: Quote
      else if (isQuoted(part2)) {
        detectedSpeaker = cleanQuotes(part1);
        detectedQuote = cleanQuotes(part2);
        isExact = true;
      }
      // Case 3: Neither is explicitly quoted -> determine speaker vs quote by entity & verb patterns
      else {
        const verbRegex = /\b(is|was|are|were|got|has|have|had|will|would|can|could|did|do|does|not|no|my|your|our|their|his|her|says|said|alleges|alleged|claims|claimed)\b/i;
        const entityRegex = /^[A-Z][a-zA-Z0-9.'’-]*(?:\s+[A-Z][a-zA-Z0-9.'’-]*){0,4}$/;
        const isEntity = (s: string) => entityRegex.test(s) && !verbRegex.test(s);

        if (isEntity(part2) && !isEntity(part1)) {
          // e.g. "PM Modi got my phone tapped: Rahul Gandhi"
          detectedQuote = part1;
          detectedSpeaker = part2;
          isExact = false;
        } else if (isEntity(part1) && !isEntity(part2)) {
          // e.g. "Rahul Gandhi: PM Modi got my phone tapped"
          detectedSpeaker = part1;
          detectedQuote = part2;
          isExact = false;
        } else {
          // Word count heuristic: speaker entity is shorter and capitalized
          const words1 = part1.split(/\s+/).length;
          const words2 = part2.split(/\s+/).length;
          if (words2 <= 4 && words1 > words2 && /^[A-Z]/.test(part2)) {
            detectedQuote = part1;
            detectedSpeaker = part2;
            isExact = false;
          } else if (words1 <= 4 && words2 > words1 && /^[A-Z]/.test(part1)) {
            detectedSpeaker = part1;
            detectedQuote = part2;
            isExact = false;
          }
        }
      }

      if (detectedSpeaker && detectedQuote) {
        return {
          isAttributedStatement: true,
          speaker: detectedSpeaker,
          quote: detectedQuote,
          isExactQuote: isExact,
          isParaphrase: !isExact,
          hasTransliteration: detectHinglishOrTransliteration(detectedQuote),
          claimTypes: ["statement_attribution", "factual_proposition", "interpretation"],
        };
      }
    }
  }

  // Pattern C: Speaker said/claimed/stated "Quote"
  const saidPattern = /^([A-Z][a-zA-Z\s.'’-]{2,50})\s+(?:said|stated|claimed|remarked|tweeted|posted|declared|argued)(?:\s+that)?\s*[:,-]?\s*["“'‘](.+?)["”'’]$/i;
  const saidMatch = trimmed.match(saidPattern);
  if (saidMatch) {
    const speaker = saidMatch[1].trim();
    const quote = saidMatch[2].trim();
    const hasTranslit = detectHinglishOrTransliteration(quote);
    return {
      isAttributedStatement: true,
      speaker,
      quote,
      isExactQuote: true,
      isParaphrase: false,
      hasTransliteration: hasTranslit,
      claimTypes: ["statement_attribution", "quotation_accuracy", "factual_proposition"],
    };
  }

  // Pattern D: "Quote", said/stated Speaker
  const quoteFirstPattern = /^["“'‘](.+?)["”'’]\s*,\s*(?:said|stated|claimed|according to)\s+([A-Z][a-zA-Z\s.'’-]{2,50})$/i;
  const quoteFirstMatch = trimmed.match(quoteFirstPattern);
  if (quoteFirstMatch) {
    const quote = quoteFirstMatch[1].trim();
    const speaker = quoteFirstMatch[2].trim();
    const hasTranslit = detectHinglishOrTransliteration(quote);
    return {
      isAttributedStatement: true,
      speaker,
      quote,
      isExactQuote: true,
      isParaphrase: false,
      hasTransliteration: hasTranslit,
      claimTypes: ["statement_attribution", "quotation_accuracy", "factual_proposition"],
    };
  }

  // Pattern E: Paraphrased attribution without quotation marks:
  // e.g. Samrat Choudhary claimed that there is no crime in Bihar
  const paraphrasePattern = /^([A-Z][a-zA-Z\s.'’-]{2,50})\s+(?:claimed that|stated that|said that|alleged that)\s+(.+)$/i;
  const paraMatch = trimmed.match(paraphrasePattern);
  if (paraMatch) {
    const speaker = paraMatch[1].trim();
    const quote = paraMatch[2].trim();
    return {
      isAttributedStatement: true,
      speaker,
      quote,
      isExactQuote: false,
      isParaphrase: true,
      hasTransliteration: detectHinglishOrTransliteration(quote),
      claimTypes: ["statement_attribution", "paraphrase_accuracy", "factual_proposition"],
    };
  }

  return {
    isAttributedStatement: false,
    speaker: null,
    quote: null,
    isExactQuote: false,
    isParaphrase: false,
    hasTransliteration: false,
    claimTypes: ["factual"],
  };
}

/**
 * Detects common Hinglish / Romanized Hindi markers (e.g. apraadh, nahi, nhi, yaha, hai, tha, etc.)
 */
function detectHinglishOrTransliteration(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const hindiKeywords = new Set([
    "apraadh", "apradh", "nhi", "nahi", "nahin", "yaha", "yahan", "humare", "hamare",
    "kaha", "kahenge", "hai", "hain", "kuch", "hota", "desh", "sarkar", "mantri",
    "bjp", "jdu", "rjd", "bihar", "police", "prashasan"
  ]);

  return words.some((w) => hindiKeywords.has(w.replace(/[^a-z]/g, "")));
}

/**
 * Decomposes an attributed statement into distinct, independently verifiable claims:
 * 1. Statement Attribution: Did the speaker actually say this?
 * 2. Factual Proposition: Is the underlying claim/content factually accurate?
 * 3. Interpretation & Context: How is the remark interpreted in public context?
 */
export function decomposeStatementClaims(
  rawText: string,
  baseIdPrefix: string = "claim"
): ClaimInput[] {
  const intent = detectStatementIntent(rawText);

  if (!intent.isAttributedStatement || !intent.speaker || !intent.quote) {
    const trimmed = rawText.trim();
    const parts = trimmed
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);

    if (parts.length > 1) {
      return parts.slice(0, 5).map((part, idx) => ({
        id: `${baseIdPrefix}-${idx + 1}`,
        text: part,
        importance: idx === 0 ? "high" : "medium",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: inferClaimCertainty(part),
      }));
    }

    return [
      {
        id: `${baseIdPrefix}-1`,
        text: trimmed,
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: inferClaimCertainty(trimmed),
      },
    ];
  }

  const claims: ClaimInput[] = [];

  // 1. Statement Attribution (High Importance)
  // Evaluates solely whether the person actually made this statement.
  claims.push({
    id: `${baseIdPrefix}-1`,
    text: `${intent.speaker} made the public statement: "${intent.quote}"`,
    importance: "high",
    claimType: "statement_attribution",
    layer: "statement_made",
    certainty: "reported_claim",
  });

  // 2. Factual Proposition (Medium Importance)
  // Evaluates the factual content of the quote independently of who said it.
  claims.push({
    id: `${baseIdPrefix}-2`,
    text: `Factual proposition in statement: "${intent.quote}"`,
    importance: "medium",
    claimType: "factual_proposition",
    layer: "underlying_fact",
    certainty: inferClaimCertainty(intent.quote),
  });

  // 3. Interpretation / Quotation Accuracy (Low Importance)
  // Clarifies context, apparent literal contradictions, or translation distinctions.
  claims.push({
    id: `${baseIdPrefix}-3`,
    text: `Statement context and interpretation: ${intent.speaker}'s remarks represent reported public remarks in context rather than a fabricated or distorted quotation.`,
    importance: "low",
    claimType: intent.isExactQuote ? "quotation_accuracy" : "interpretation",
    layer: intent.isExactQuote ? "quote_wording" : "interpretation",
    certainty: intent.isExactQuote ? "asserted_fact" : "opinion_analysis",
  });

  return claims;
}

