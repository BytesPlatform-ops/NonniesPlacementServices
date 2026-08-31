import "server-only";

/**
 * Server-only fetch helpers for PUBLIC website content served by the Nonni's
 * platform backend. Reuses the same server-side base URL as form ingestion
 * (`NONNIS_PLATFORM_API_URL`) — no browser token is involved, and these
 * endpoints are public/read-only. Every call degrades gracefully: on any error
 * or missing configuration the site renders an empty/fallback state rather than
 * crashing, and technical errors are never surfaced to visitors.
 */

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

const REVALIDATE_SECONDS = 60;

function baseUrl(): string | null {
  const url = process.env.NONNIS_PLATFORM_API_URL;
  return url ? url.replace(/\/$/, "") : null;
}

async function getJson<T>(path: string): Promise<T | null> {
  const base = baseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return (body?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

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
