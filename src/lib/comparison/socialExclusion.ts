/**
 * Social media and user-generated content platform exclusion list.
 *
 * Requirements:
 * - Social platforms and user-generated pages are never counted as independent
 *   corroboration and never shown as "Key Independent Source".
 * - Never use social-media or aggregator images as background photo candidates.
 */

export const SOCIAL_AND_AGGREGATOR_DOMAINS = new Set([
  "facebook.com",
  "m.facebook.com",
  "fb.com",
  "fb.me",
  "fb.watch",
  "instagram.com",
  "instagr.am",
  "twitter.com",
  "x.com",
  "mobile.twitter.com",
  "t.co",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "whatsapp.com",
  "telegram.org",
  "t.me",
  "reddit.com",
  "old.reddit.com",
  "v.redd.it",
  "tiktok.com",
  "threads.net",
  "linkedin.com",
  "pinterest.com",
  "quora.com",
  "medium.com",
  "wikipedia.org",
  "ground.news",
]);

/**
 * Checks if a domain or URL belongs to a social media platform, user-generated forum, or aggregator.
 */
export function isSocialOrAggregator(domainOrUrl?: string | null): boolean {
  if (!domainOrUrl) return false;
  let host = domainOrUrl.toLowerCase().trim();
  try {
    if (host.includes("://")) {
      host = new URL(host).hostname;
    }
  } catch {}

  host = host.replace(/^www\./i, "");

  for (const domain of SOCIAL_AND_AGGREGATOR_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
}
