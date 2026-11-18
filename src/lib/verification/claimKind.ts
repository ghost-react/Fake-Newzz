import { ClaimKind } from "@/schemas/evidence";

const OPINION_REGEX = /\b(in our view|in my view|we believe|we argue|in my opinion|opinion|editorial|author argues|should|ought to|must agree|the best|the worst|underrated|overrated|unjustified|justified)\b/i;

const PREDICTION_REGEX = /\b(will reach|will hit|will happen|is projected to|is forecast to|is expected to by 20\d\d|by the year 20\d\d|future outlook|predicted to|projected by 20\d\d)\b/i;

const SCIENCE_TERMS_REGEX = /\b(boil(?:s|ing)?|freez(?:e|ing)|melt(?:s|ing)|sea level|atmospheric pressure|revolve(?:s|d|ing)?|orbit(?:s|ed|ing)?|solar system|speed of light|gravity|gravitational|acceleration|photosynthesis|mitochondria|dna|chromosome|chemical formula|atomic number|periodic table|celsius|fahrenheit|kelvin)\b/i;

const HISTORY_TERMS_REGEX = /\b(became independent|gained independence|independence day|independence in \d{4}|declared independence|constitution was adopted|constitution in \d{4}|treaty of|world war (?:i|ii|1|2)|assassinated in \d{4}|died in \d{4}|born in \d{4}|founded in \d{4}|discovered in \d{4}|invented in \d{4})\b/i;

const GEOGRAPHY_DEFINITION_REGEX = /\b(capital of|largest ocean|highest mountain|longest river|currency of|official language of|is defined as)\b/i;

const RECENT_NEWS_SIGNALS = /\b(today|yesterday|this morning|this week|breaking|arrested|charges filed|police probe|investigation underway|statement today)\b/i;

/**
 * Deterministically classifies a claim text into:
 * - "established_fact": science, history, geography, encyclopedic definitions, settled historical dates
 * - "opinion": subjective viewpoint, editorial judgment, moral prescription
 * - "prediction": forward-looking projection or future prophecy
 * - "news_event": recent occurrences, breaking news, reports, government announcements (default)
 *
 * CRITICAL: Derived strictly from claim text syntax and semantic markers, NEVER from truth value.
 */
export function classifyClaimKind(claimText: string): ClaimKind {
  if (!claimText || typeof claimText !== "string") {
    return "news_event";
  }

  const trimmed = claimText.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check Opinion
  if (OPINION_REGEX.test(lower)) {
    return "opinion";
  }

  // 2. Check Prediction
  if (PREDICTION_REGEX.test(lower)) {
    return "prediction";
  }

  // 3. Check if it explicitly contains recent news signals
  if (RECENT_NEWS_SIGNALS.test(lower)) {
    return "news_event";
  }

  // 4. Check Established Fact: Science & Physical Laws
  if (SCIENCE_TERMS_REGEX.test(lower)) {
    // E.g. "The Sun revolves around the Earth.", "Water boils at 100°C at sea level."
    return "established_fact";
  }

  // 5. Check Established Fact: Historical Events & Dates
  if (HISTORY_TERMS_REGEX.test(lower)) {
    // E.g. "India became independent in 1947.", "India became independent in 1950."
    return "established_fact";
  }

  // 6. Check Established Fact: Geography & Definitions
  if (GEOGRAPHY_DEFINITION_REGEX.test(lower)) {
    return "established_fact";
  }

  // 7. Check Historical Year pattern with past event verb
  const historicalYearMatch = lower.match(/\b(1[6-9]\d{2}|200\d|201[0-5])\b/);
  if (
    historicalYearMatch &&
    /\b(independent|war|signed|republic|king|queen|emperor|empire|revolution|rebellion|treaty|conquered|established|founded)\b/i.test(lower)
  ) {
    return "established_fact";
  }

  return "news_event";
}
