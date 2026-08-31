/**
 * Pure URL/envelope helpers for the platform content API. Kept free of
 * `server-only` so they can be unit-tested. `platform-api.ts` wires these to
 * `process.env`; `content.ts` uses `extractEnvelope` to parse responses.
 */

export const DEV_FALLBACK_BASE = "http://localhost:4000";

/**
 * Normalize the configured platform origin: strip trailing slashes and a
 * trailing `/api/v1` so URLs never end up as `/api/v1/api/v1`. When unset, use
 * the local dev backend in non-production and return null in production.
 */
export function normalizeOrigin(configured: string | undefined, nodeEnv: string | undefined): string | null {
  const c = configured?.trim();
  if (c) return c.replace(/\/+$/, "").replace(/\/api\/v1\/?$/i, "");
  if (nodeEnv !== "production") return DEV_FALLBACK_BASE;
  return null;
}

/** Build a full `/api/v1` URL for `path` (leading slash optional), or null when no origin. */
export function buildApiUrl(origin: string | null, path: string): string | null {
  if (!origin) return null;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}/api/v1${suffix}`;
}

/** Return the `data` of a `{ data }` envelope, or null when the shape is wrong. */
export function extractEnvelope<T>(body: unknown): T | null {
  if (body == null || typeof body !== "object" || !("data" in body)) return null;
  return ((body as { data?: T }).data ?? null) as T | null;
}
