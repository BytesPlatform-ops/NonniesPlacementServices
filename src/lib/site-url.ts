/**
 * Canonical public origin for this marketing site. Used for `metadataBase`,
 * OpenGraph/canonical URLs, `sitemap.xml` and `robots.txt`.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in every deployed environment. The fallback is the
 * production domain already recorded in this project's own configuration
 * (`.env` uses admin@nonnisplacement.com) — it is not a placeholder, but the
 * exact host (apex vs. www) must be confirmed before launch. A malformed value
 * fails the build rather than silently shipping wrong canonical URLs.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nonnisplacement.com").replace(/\/+$/, "");
