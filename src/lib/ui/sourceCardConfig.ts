/**
 * Configuration for hover-lift source cards and links.
 * Controls lift distance, animation timing, and shadow depth.
 */

export interface SourceCardConfig {
  liftDistancePx: number;
  liftDistance: string;
  transitionDurationMs: number;
  transitionEasing: string;
  shadowNormal: string;
  shadowLifted: string;
  borderNormal: string;
  borderLifted: string;
  focusRingColor: string;
}

export const DEFAULT_SOURCE_CARD_CONFIG: SourceCardConfig = {
  liftDistancePx: 4,
  liftDistance: "-4px",
  transitionDurationMs: 180,
  transitionEasing: "cubic-bezier(0, 0, 0.2, 1)",
  shadowNormal: "0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  shadowLifted: "0 10px 20px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
  borderNormal: "rgba(255, 255, 255, 0.08)",
  borderLifted: "rgba(255, 255, 255, 0.22)",
  focusRingColor: "#10B981", // Emerald-400
};

/**
 * Formats publish timestamps into human-readable relative time (e.g., "2 months ago", "3 days ago").
 * Never truncates relative units.
 */
export function formatRelativeTime(dateString?: string | null): string | null {
  if (!dateString || !dateString.trim()) return null;
  const trimmed = dateString.trim();

  // If already relative (e.g. "3 days ago", "just now", "yesterday")
  if (/\b(ago|just now|yesterday|today)\b/i.test(trimmed)) {
    return trimmed;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return trimmed.slice(0, 10);
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) {
    return "Recent";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return "1 year ago";
  return `${diffYears} years ago`;
}

/**
 * Validates that a string is a safe HTTP or HTTPS URL returned by the pipeline.
 * Rejects javascript:, data:, file:, domain homepages when composed, or malformed strings.
 */
export function isValidHttpUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Common motion and accessibility classes for hover-lift source links.
 *
 * 1. Motion: -4px translateY (-translate-y-1), deeper shadow, brighter border on hover.
 * 2. Easing: ~180ms ease-out, smooth return on mouse leave.
 * 3. Transform only: uses transform and opacity only (zero layout shifts).
 * 4. Accessibility:
 *    - prefers-reduced-motion: motion-reduce:transform-none (border/shadow change only).
 *    - touch devices (@media(hover:none)): disables translateY, provides active pressed scale.
 *    - visible AA focus ring: focus-visible:ring-2 focus-visible:ring-emerald-400.
 */
export const SOURCE_LINK_MOTION_CLASSES = [
  "group/sourcelink",
  "inline-flex",
  "items-center",
  "relative",
  // 180ms ease-out transform and opacity
  "transition-[transform,box-shadow,border-color,background-color,opacity]",
  "duration-[180ms]",
  "ease-out",
  // Hover lift on pointer devices only
  "[@media(hover:hover)]:hover:-translate-y-1",
  "[@media(hover:hover)]:hover:border-white/[0.22]",
  "[@media(hover:hover)]:hover:shadow-[0_10px_20px_-3px_rgba(0,0,0,0.5),0_4px_6px_-4px_rgba(0,0,0,0.3)]",
  // Focus visible AA ring
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-emerald-400",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-[#0B0F17]",
  "[@media(hover:hover)]:focus-visible:-translate-y-1",
  "[@media(hover:hover)]:focus-visible:border-white/[0.22]",
  // Reduced motion: movement disabled
  "motion-reduce:transform-none",
  "motion-reduce:transition-none",
  "motion-reduce:hover:translate-y-0",
  "motion-reduce:focus-visible:translate-y-0",
  // Touch devices: no lift, active pressed state
  "[@media(hover:none)]:hover:translate-y-0",
  "active:scale-[0.98]",
  "active:bg-white/[0.08]",
].join(" ");

