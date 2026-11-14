import { ConclusionLabel } from "@/schemas/verification";

export type Tone = "green" | "amber" | "red" | "grey";

export interface ToneTokens {
  tone: Tone;
  base: string;
  soft: string;
  border: string;
  glow: string;
  text: string;
  ring: string;
}

export const TONE_TOKENS: Record<Tone, ToneTokens> = {
  green: {
    tone: "green",
    base: "#10B981",
    soft: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.35)",
    glow: "rgba(16, 185, 129, 0.25)",
    text: "#34D399",
    ring: "#10B981",
  },
  amber: {
    tone: "amber",
    base: "#F59E0B",
    soft: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.35)",
    glow: "rgba(245, 158, 11, 0.25)",
    text: "#FBBF24",
    ring: "#F59E0B",
  },
  red: {
    tone: "red",
    base: "#EF4444",
    soft: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.35)",
    glow: "rgba(239, 68, 68, 0.25)",
    text: "#F87171",
    ring: "#EF4444",
  },
  grey: {
    tone: "grey",
    base: "#64748B",
    soft: "rgba(100, 116, 139, 0.15)",
    border: "rgba(100, 116, 139, 0.35)",
    glow: "rgba(100, 116, 139, 0.20)",
    text: "#94A3B8",
    ring: "#64748B",
  },
};

export interface ToneInput {
  conclusion?: {
    label?: ConclusionLabel | string | null;
  } | null;
  veracityVerdict?: string | null;
  overallTrustScore?: number | null;
  score?: number | null;
}

/**
 * Deterministically derives the results accent tone:
 * 1. From conclusion.label (True/Mostly true -> green, Partly true/Unconfirmed/Misleading -> amber, False -> red, Can't verify -> grey)
 * 2. If conclusion is missing (old reports), derive from verdict
 * 3. As a last resort, derive from score bands (>=75 green, 40-74 amber, <40 red)
 * Never use the score alone when a label exists.
 */
export function deriveTone(input?: ToneInput | null): Tone {
  if (!input) {
    return "grey";
  }

  // 1. Conclusion Label (Primary Source)
  const rawLabel = input.conclusion?.label;
  if (rawLabel) {
    const label = rawLabel.trim().toLowerCase();
    if (label === "true" || label === "mostly true") {
      return "green";
    }
    if (
      label === "partly true" ||
      label === "unconfirmed" ||
      label === "misleading"
    ) {
      return "amber";
    }
    if (label === "false") {
      return "red";
    }
    if (label === "can't verify" || label === "cant verify") {
      return "grey";
    }
  }

  // 2. Verdict Fallback (for older stored reports without conclusion object)
  const rawVerdict = input.veracityVerdict;
  if (rawVerdict) {
    const verdict = rawVerdict.trim().toLowerCase();
    if (verdict === "verified_true" || verdict === "mostly_true") {
      return "green";
    }
    if (verdict === "mixed" || verdict === "misleading") {
      return "amber";
    }
    if (verdict === "mostly_false" || verdict === "false") {
      return "red";
    }
    if (verdict === "unverified" || verdict === "unable_to_verify") {
      return "grey";
    }
  }

  // 3. Score Band Fallback (last resort only when neither label nor verdict exists)
  const scoreVal = input.overallTrustScore ?? input.score;
  if (typeof scoreVal === "number" && !isNaN(scoreVal)) {
    if (scoreVal >= 75) return "green";
    if (scoreVal >= 40) return "amber";
    return "red";
  }

  return "grey";
}

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB hex color.
 */
export function calculateLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 */
export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = calculateLuminance(fgHex);
  const l2 = calculateLuminance(bgHex);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}
