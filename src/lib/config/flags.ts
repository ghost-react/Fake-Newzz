/**
 * Feature flags for FakeNewzz
 * Defaults are strictly false unless explicitly set to "true".
 */

export function isTextInputEnabled(): boolean {
  return process.env.TEXT_INPUT_ENABLED === "true";
}

export function isUnreadableFallbackEnabled(): boolean {
  return process.env.UNREADABLE_FALLBACK_ENABLED === "true";
}
