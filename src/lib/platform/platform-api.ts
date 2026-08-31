import "server-only";

/**
 * Single source of truth for building Nonni's platform API URLs from the public
 * website (server-side only). Centralizes the environment contract so Blog,
 * Testimonials, Videos, and the sitemap never construct URLs independently.
 *
 * Environment:
 *  - `NONNIS_PLATFORM_API_URL` — server-only base URL of the NestJS backend.
 *    May be given with or without a trailing slash and with or without an
 *    `/api/v1` suffix; both are normalized so we never request `/api/v1/api/v1`.
 *  - In DEVELOPMENT only, if the variable is unset we fall back to the local
 *    backend (`http://localhost:4000`) so the site works out of the box. In
 *    production the variable is REQUIRED — no localhost fallback is used.
 */

const DEV_FALLBACK_BASE = "http://localhost:4000";

/** Origin of the platform API, without a trailing slash and without `/api/v1`. */
export function platformApiOrigin(): string | null {
  const configured = process.env.NONNIS_PLATFORM_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_BASE;
  }
  return null;
}

/** Whether a usable platform API origin is available (configured or dev fallback). */
export function isPlatformApiConfigured(): boolean {
  return platformApiOrigin() !== null;
}

/** True when we are relying on the development fallback rather than a configured URL. */
export function usingDevFallback(): boolean {
  return !process.env.NONNIS_PLATFORM_API_URL?.trim() && process.env.NODE_ENV !== "production";
}

/** Build a full `/api/v1` URL for `path` (leading slash optional), or null if unconfigured. */
export function platformApiUrl(path: string): string | null {
  const origin = platformApiOrigin();
  if (!origin) return null;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}/api/v1${suffix}`;
}
