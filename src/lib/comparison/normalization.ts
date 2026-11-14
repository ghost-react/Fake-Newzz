/**
 * Specialized normalizers for ranges, currency conversions, and detail variations
 * across multi-source reporting.
 */

const WORD_TO_NUMBER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function parseWordOrDigitNumber(token: string): number | null {
  const clean = token.toLowerCase().trim().replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }
  if (WORD_TO_NUMBER[clean] !== undefined) {
    return WORD_TO_NUMBER[clean];
  }
  return null;
}

export interface RangeInfo {
  min?: number;
  max?: number;
  unit?: string;
  isRange: boolean;
  rawText: string;
}

/**
 * Normalizes ranges like "up to five years", "two to five years", "2-5 years", "maximum 5 years".
 */
export function extractRangeInfo(text: string): RangeInfo | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Pattern 1: "up to X [units]" or "maximum [of] X [units]"
  const upToMatch = lower.match(
    /\b(?:up\s+to|maximum(?:\s+of)?|no\s+more\s+than|capped\s+at)\s+([a-z0-9]+)\s*(years?|months?|days?|hours?|%|percent)?\b/i
  );
  if (upToMatch) {
    const val = parseWordOrDigitNumber(upToMatch[1]);
    if (val !== null) {
      return {
        max: val,
        unit: upToMatch[2] || undefined,
        isRange: true,
        rawText: upToMatch[0],
      };
    }
  }

  // Pattern 2: "X to Y [units]" or "between X and Y [units]" or "X - Y [units]"
  const rangeMatch = lower.match(
    /\b(?:between\s+)?([a-z0-9]+)\s*(?:to|-|and)\s*([a-z0-9]+)\s*(years?|months?|days?|hours?|%|percent)?\b/i
  );
  if (rangeMatch) {
    const minVal = parseWordOrDigitNumber(rangeMatch[1]);
    const maxVal = parseWordOrDigitNumber(rangeMatch[2]);
    if (minVal !== null && maxVal !== null) {
      return {
        min: minVal,
        max: maxVal,
        unit: rangeMatch[3] || undefined,
        isRange: true,
        rawText: rangeMatch[0],
      };
    }
  }

  return null;
}

/**
 * Checks whether two range expressions agree on their upper bound (e.g. "up to 5 years" vs "2 to 5 years").
 */
export function areRangesPartiallyAgreeing(textA: string, textB: string): boolean {
  const rA = extractRangeInfo(textA);
  const rB = extractRangeInfo(textB);
  if (!rA || !rB) return false;

  // Both have the same max ceiling
  if (rA.max !== undefined && rB.max !== undefined && rA.max === rB.max) {
    // Check unit compatibility
    if (!rA.unit || !rB.unit || rA.unit.slice(0, 3) === rB.unit.slice(0, 3)) {
      return true;
    }
  }
  return false;
}

/**
 * Exchange rate baselines normalized to EUR:
 * 1 EUR ≈ 1.125 USD (so 1 USD ≈ 0.888 EUR)
 * 1 EUR ≈ 105 INR (so 1 INR ≈ 0.00952 EUR; 21 lakh INR = 2,100,000 INR ≈ 20,000 EUR)
 * 1 EUR ≈ 0.85 GBP (so 1 GBP ≈ 1.176 EUR)
 */
export function normalizeCurrencyToEur(text: string): { amountEur: number; currency: string; originalAmount: number } | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. EUR
  // e.g. "EUR 20,000", "€20,000", "20,000 euros"
  const eurMatch = lower.match(/(?:eur|€)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:eur|euros?|€)/i);
  if (eurMatch) {
    const rawNumStr = (eurMatch[1] || eurMatch[2]).replace(/,/g, "");
    const amount = parseFloat(rawNumStr);
    if (!isNaN(amount)) {
      return { amountEur: amount, currency: "EUR", originalAmount: amount };
    }
  }

  // 2. INR (with Lakh / Crore / ₹ support)
  // e.g. "INR 21 lakh", "₹21,00,000", "21 lakh rupees"
  const inrMatch = lower.match(/(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr)?|([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr)?\s*(?:inr|rs\.?|rupees?|₹)/i);
  if (inrMatch) {
    const rawNumStr = (inrMatch[1] || inrMatch[3]).replace(/,/g, "");
    let amount = parseFloat(rawNumStr);
    const unit = (inrMatch[2] || inrMatch[4] || "").toLowerCase();
    if (unit.startsWith("lakh") || unit.startsWith("lac")) {
      amount *= 100000;
    } else if (unit.startsWith("crore") || unit.startsWith("cr")) {
      amount *= 10000000;
    }
    if (!isNaN(amount)) {
      // 21,00,000 INR / 105 = 20,000 EUR
      const amountEur = amount / 105;
      return { amountEur, currency: "INR", originalAmount: amount };
    }
  }

  // 3. USD
  // e.g. "USD 22,500", "$22,500", "22,500 dollars"
  const usdMatch = lower.match(/(?:usd|\$)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:usd|dollars?|\$)/i);
  if (usdMatch) {
    const rawNumStr = (usdMatch[1] || usdMatch[2]).replace(/,/g, "");
    const amount = parseFloat(rawNumStr);
    if (!isNaN(amount)) {
      // 22,500 USD / 1.125 = 20,000 EUR
      const amountEur = amount / 1.125;
      return { amountEur, currency: "USD", originalAmount: amount };
    }
  }

  // 4. GBP
  const gbpMatch = lower.match(/(?:gbp|£)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:gbp|pounds?|£)/i);
  if (gbpMatch) {
    const rawNumStr = (gbpMatch[1] || gbpMatch[2]).replace(/,/g, "");
    const amount = parseFloat(rawNumStr);
    if (!isNaN(amount)) {
      const amountEur = amount * 1.176;
      return { amountEur, currency: "GBP", originalAmount: amount };
    }
  }

  return null;
}

/**
 * Checks whether two currency values represent the same amount within conversion tolerance (±15%).
 */
export function areCurrenciesEquivalent(textA: string, textB: string): boolean {
  const currA = normalizeCurrencyToEur(textA);
  const currB = normalizeCurrencyToEur(textB);
  if (!currA || !currB) return false;

  const diff = Math.abs(currA.amountEur - currB.amountEur);
  const maxVal = Math.max(currA.amountEur, currB.amountEur);
  if (maxVal === 0) return true;

  // Tolerance ±15%
  return diff / maxVal <= 0.15;
}

/**
 * Checks whether differences are acceptable detail variations (age thresholds, minor count margins)
 * rather than hard factual contradictions.
 */
export function isDetailVariation(
  valA: string,
  valB: string
): { isVariation: boolean; reason?: string } {
  const cleanA = valA.toLowerCase().trim();
  const cleanB = valB.toLowerCase().trim();

  // 1. Age thresholds (e.g. "14-17" vs "16+" or "aged 14 to 17" vs "16 and older")
  const isAgeA = /\b(1[0-9]|20)\s*(?:-|to)\s*(1[0-9]|20)\b|\b(1[0-9]|20)\+\b|age/i.test(cleanA);
  const isAgeB = /\b(1[0-9]|20)\s*(?:-|to)\s*(1[0-9]|20)\b|\b(1[0-9]|20)\+\b|age/i.test(cleanB);
  if (isAgeA && isAgeB) {
    return {
      isVariation: true,
      reason: `Age threshold difference: "${valA}" vs "${valB}"`,
    };
  }

  // 2. Currency conversion equivalence
  if (areCurrenciesEquivalent(cleanA, cleanB)) {
    return {
      isVariation: true,
      reason: `Equivalent amounts across currencies: "${valA}" vs "${valB}"`,
    };
  }

  // 3. Small count margin (< 20% difference)
  const numA = parseFloat(cleanA.replace(/,/g, ""));
  const numB = parseFloat(cleanB.replace(/,/g, ""));
  if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) {
    const diff = Math.abs(numA - numB);
    const max = Math.max(numA, numB);
    if (diff / max <= 0.20) {
      return {
        isVariation: true,
        reason: `Minor count variation: ${valA} vs ${valB} (${Math.round((diff / max) * 100)}% margin)`,
      };
    }
  }

  return { isVariation: false };
}
