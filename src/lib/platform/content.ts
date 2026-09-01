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

export interface ResidentialProviderCard {
  slug: string;
  name: string;
  summary: string | null;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  services: string[];
  languages: string[];
}

export interface ResidentialProviderDetail {
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  imageUrl: string | null;
  services: Array<{ name: string; levelOfCare: string | null; description: string | null }>;
  coverage: string[];
  paymentTypes: string[];
  languages: string[];
  hours: Array<{ day: string; closed: boolean; open24: boolean; opensAt: string | null; closesAt: string | null }>;
}

export interface ResidentialDirectoryOptions {
  serviceCategories: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  paymentTypes: Array<{ id: string; name: string }>;
  states: string[];
}

export interface ResidentialDirectoryPage {
  items: ResidentialProviderCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ResidentialProviderQuery {
  q?: string;
  state?: string;
  city?: string;
  serviceCategory?: string;
  language?: string;
  paymentType?: string;
  sort?: string;
  page?: number;
  limit?: number;
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

const EMPTY_DIRECTORY: ResidentialDirectoryPage = { items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 };

/** Published residential providers matching the public filters. Degrades to empty on failure. */
export async function fetchResidentialProviders(params: ResidentialProviderQuery = {}): Promise<ResidentialDirectoryPage> {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.state) q.set("state", params.state);
  if (params.city) q.set("city", params.city);
  if (params.serviceCategory) q.set("serviceCategory", params.serviceCategory);
  if (params.language) q.set("language", params.language);
  if (params.paymentType) q.set("paymentType", params.paymentType);
  if (params.sort) q.set("sort", params.sort);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 12));
  const data = await getJson<ResidentialDirectoryPage>(`/public/residential-providers?${q.toString()}`);
  return data ?? EMPTY_DIRECTORY;
}

/** A single published residential provider by slug, or null if not found / unpublished. */
export async function fetchResidentialProvider(slug: string): Promise<ResidentialProviderDetail | null> {
  return getJson<ResidentialProviderDetail>(`/public/residential-providers/${encodeURIComponent(slug)}`);
}

/** Directory filter options limited to values that currently have published providers. */
export async function fetchResidentialOptions(): Promise<ResidentialDirectoryOptions> {
  return (
    (await getJson<ResidentialDirectoryOptions>(`/public/residential-providers/options`)) ?? {
      serviceCategories: [],
      languages: [],
      paymentTypes: [],
      states: [],
    }
  );
}
