/** Runtime configuration derived from public environment variables. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/**
 * The marketing site's production origin.
 *
 * Same value the website app defaults to in its own canonical-origin helper
 * (`src/lib/site-url.ts` at the repo root), so the two apps cannot disagree
 * about where the public site lives.
 */
const PRODUCTION_SITE_URL = "https://nonnisplacement.com";
const DEVELOPMENT_SITE_URL = "http://localhost:3000";

/**
 * Resolves the public website origin from the environment.
 *
 * Kept as a pure function so the production default is covered by a unit test
 * rather than only by whatever the current shell happens to export.
 *
 * The default is environment-aware on purpose. A single localhost default is
 * exactly what pointed the production admin panel's "View on website" button at
 * `http://localhost:3000`: `NEXT_PUBLIC_SITE_URL` was never set on the
 * deployment, and an unset variable is indistinguishable from a deliberate one
 * at build time. Falling back to the production domain in a production build
 * means a missing variable degrades to the right host instead of an unreachable
 * one, while `next dev` still points at a local website.
 *
 * A blank or whitespace-only value counts as unset — a host that defines the
 * variable with an empty value should not silently produce `/residential-...`
 * as an absolute URL.
 */
export function resolvePublicSiteUrl(raw: string | undefined, nodeEnv: string | undefined): string {
  const configured = raw?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return nodeEnv === "production" ? PRODUCTION_SITE_URL : DEVELOPMENT_SITE_URL;
}

/**
 * Public marketing website base URL — used for "View on website" links.
 *
 * `NEXT_PUBLIC_*` values are inlined when the app is built, so changing this
 * variable on the host requires a redeploy before it takes effect.
 */
export const PUBLIC_SITE_URL = resolvePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
