/**
 * Configuration for the Full-Bleed News Backdrop Hero
 *
 * Implements light blur (8px desktop / 4px mobile; max 25px), selective scrims,
 * scroll darkening up to 0.85, and adaptive luminance-based contrast boosting.
 */

export interface ScrimConfig {
  leftScrimOpacity: number;
  rightScrimOpacity: number;
  bottomScrimOpacity: number;
}

export interface BackdropConfig {
  /** Blur radius in pixels (desktop default: 8px, light blur where photo remains recognisable) */
  blurPx: number;
  /** Maximum blur scale limit in pixels (default: 25px) */
  maxBlurPx: number;
  /** Blur radius for mobile viewports (default: 4px) */
  mobileBlurPx: number;
  /** Image opacity (default: 0.92) */
  imageOpacity: number;
  /** Image scale to hide blur boundary bleed (default: 1.08) */
  scale: number;
  /** Dark horizontal scrim behind headline & score on left (default: 0.75) */
  leftScrimOpacity: number;
  /** Dark horizontal scrim on right edge (default: 0.55) */
  rightScrimOpacity: number;
  /** Bottom gradient fading into solid #0B0F17 (default: 0.85) */
  bottomScrimOpacity: number;
  /** Maximum background darkening opacity as user scrolls past hero (default: 0.85) */
  scrollDarkenMax: number;
  /** Default focal position for hero photo (default: "center 30%") */
  defaultObjectPosition: string;
  /** Threshold above which an image is considered bright (e.g. snow, white sky) */
  highLuminanceThreshold: number;
  /** Threshold below which an image is considered dark */
  lowLuminanceThreshold: number;
  /** Scrim opacity boosts applied automatically to bright images to guarantee WCAG AA contrast */
  brightImageScrimBoost: ScrimConfig;
  /** Transition duration for image fade-in in ms (default: 600) */
  transitionDurationMs: number;
}

export const DEFAULT_BACKDROP_CONFIG: BackdropConfig = {
  blurPx: 8,
  maxBlurPx: 25,
  mobileBlurPx: 4,
  imageOpacity: 0.92,
  scale: 1.08,
  leftScrimOpacity: 0.75,
  rightScrimOpacity: 0.55,
  bottomScrimOpacity: 0.85,
  scrollDarkenMax: 0.85,
  defaultObjectPosition: "center 30%",
  highLuminanceThreshold: 0.6,
  lowLuminanceThreshold: 0.2,
  brightImageScrimBoost: {
    leftScrimOpacity: 0.90,
    rightScrimOpacity: 0.75,
    bottomScrimOpacity: 0.95,
  },
  transitionDurationMs: 600,
};

/**
 * Returns effective backdrop values accounting for image luminance and device configuration.
 */
export function getEffectiveBackdropConfig(
  customConfig?: Partial<BackdropConfig>,
  luminance?: number
): BackdropConfig {
  const merged: BackdropConfig = {
    ...DEFAULT_BACKDROP_CONFIG,
    ...(customConfig || {}),
  };

  // Clamp blur to maxBlurPx (25px)
  merged.blurPx = Math.min(merged.blurPx, merged.maxBlurPx);
  merged.mobileBlurPx = Math.min(merged.mobileBlurPx, merged.maxBlurPx);

  // If the image is bright (snow, sky, high-key photography), automatically raise scrim opacity
  if (luminance !== undefined && luminance >= merged.highLuminanceThreshold) {
    merged.leftScrimOpacity = Math.max(
      merged.leftScrimOpacity,
      merged.brightImageScrimBoost.leftScrimOpacity
    );
    merged.rightScrimOpacity = Math.max(
      merged.rightScrimOpacity,
      merged.brightImageScrimBoost.rightScrimOpacity
    );
    merged.bottomScrimOpacity = Math.max(
      merged.bottomScrimOpacity,
      merged.brightImageScrimBoost.bottomScrimOpacity
    );
  }

  return merged;
}

/**
 * Calculates effective background luminance under a scrim layer.
 * Base background is solid #0B0F17 (approx relative luminance 0.008).
 */
export function calculateEffectiveBackgroundLuminance(
  imageLuminance: number,
  scrimOpacity: number,
  canvasLuminance: number = 0.008
): number {
  const clampedImg = Math.max(0, Math.min(1, imageLuminance));
  const clampedScrim = Math.max(0, Math.min(1, scrimOpacity));
  return (1 - clampedScrim) * clampedImg + clampedScrim * canvasLuminance;
}

/**
 * Calculates standard WCAG 2.1 relative luminance contrast ratio between two luminances.
 * Returns ratio in range 1:1 to 21:1.
 */
export function calculateContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks whether text on an image with given scrim opacity meets WCAG AA standards.
 * - Large text (>= 18pt or 14pt bold): requires 3.0:1
 * - Normal body text: requires 4.5:1
 */
export function verifyTextContrastAa(
  imageLuminance: number,
  scrimOpacity: number,
  textColorLuminance: number = 0.95, // Near pure white #F5F5F5
  isLargeText: boolean = false
): { contrastRatio: number; passesAa: boolean } {
  const effectiveBg = calculateEffectiveBackgroundLuminance(imageLuminance, scrimOpacity);
  const contrastRatio = calculateContrastRatio(textColorLuminance, effectiveBg);
  const threshold = isLargeText ? 3.0 : 4.5;
  return {
    contrastRatio,
    passesAa: contrastRatio >= threshold,
  };
}
