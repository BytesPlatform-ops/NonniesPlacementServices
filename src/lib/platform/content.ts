import "server-only";
import { isPlatformApiConfigured, platformApiUrl } from "./platform-api";
import { extractEnvelope } from "./platform-url";

/**
 * Server-only fetch helpers for PUBLIC website content served by the Nonni's
 * platform backend. URLs are built by the shared `platform-api` helper
 * (`NONNIS_PLATFORM_API_URL`, with a development fallback). No browser token is
 * involved — these endpoints are public/read-only.
 *
 * Failure handling is deliberate, not silent: in DEVELOPMENT every failure is
 * logged with safe diagnostics (endpoint, HTTP status, category) so an empty
 * page is never mistaken for "no CMS content". In PRODUCTION the site still
 * degrades gracefully (empty/hidden) rather than crashing. Secrets are never
 * logged.
 */

const isDev = process.env.NODE_ENV !== "production";

function diagnose(path: string, category: string, detail: string): void {
  if (isDev) {
    console.warn(`[content] ${category} for GET /api/v1${path.startsWith("/") ? path : `/${path}`} — ${detail}`);
  }
}

export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  displayAuthor: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
}

export interface BlogDetail extends BlogCard {
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface ShortVideoItem {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterImageUrl: string | null;
  sourceLabel: string | null;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  clientName: string | null;
  clientTitle: string | null;
  organization: string | null;
  location: string | null;
  featured: boolean;
}

interface Paginated<T> {
  items: T[];
  total: number;
}

// CMS content should reflect admin changes promptly; a 30s revalidation keeps
// pages fast while ensuring a published/edited record appears within ~30s. An
// indefinitely cached empty response must never make content disappear.
const REVALIDATE_SECONDS = 30;

async function getJson<T>(path: string): Promise<T | null> {
  const url = platformApiUrl(path);
  if (!url) {
    diagnose(path, "SKIPPED (platform API not configured)", "set NONNIS_PLATFORM_API_URL");
    return null;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (err) {
    diagnose(path, "NETWORK ERROR", err instanceof Error ? err.message : "unknown");
    return null;
  }
  if (!res.ok) {
    diagnose(path, `HTTP ${res.status}`, res.headers.get("content-type") ?? "");
    return null;
  }
  try {
    const parsed = extractEnvelope<T>(await res.json());
    if (parsed === null) diagnose(path, "MALFORMED RESPONSE", "missing { data } envelope");
    return parsed;
  } catch (err) {
    diagnose(path, "PARSE ERROR", err instanceof Error ? err.message : "invalid JSON");
    return null;
  }
}

export { isPlatformApiConfigured };

/** Published blog cards (newest first). Returns [] on any failure. */
export async function fetchBlogPosts(params: { category?: string; pageSize?: number } = {}): Promise<BlogCard[]> {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  q.set("pageSize", String(params.pageSize ?? 50));
  const data = await getJson<Paginated<BlogCard>>(`/public/blog?${q.toString()}`);
  return data?.items ?? [];
}

/** A single published article by slug, or null if not found / unpublished. */
export async function fetchBlogPost(slug: string): Promise<BlogDetail | null> {
  return getJson<BlogDetail>(`/public/blog/${encodeURIComponent(slug)}`);
}

/** Active short videos in display order. Returns [] on any failure. */
export async function fetchShortVideos(): Promise<ShortVideoItem[]> {
  return (await getJson<ShortVideoItem[]>(`/public/blog-videos`)) ?? [];
}

/** Active testimonials (featured first). Returns [] on any failure. */
export async function fetchTestimonials(): Promise<TestimonialItem[]> {
  return (await getJson<TestimonialItem[]>(`/public/testimonials`)) ?? [];
}
