import type { MetadataRoute } from "next";
import { fetchBlogPosts, fetchResidentialProviders } from "@/lib/platform/content";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 300;

const STATIC_ROUTES = ["/", "/families", "/residential-providers", "/providers", "/home-health-care", "/blog", "/about", "/contact", "/hospital-referral", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, "");

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  // Published posts only (drafts/archived never appear here — the public API omits them).
  const posts = await fetchBlogPosts({ pageSize: 200 });
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Only ACTIVE + published residential providers are returned by the public API,
  // so unpublished/inactive/paused providers never enter the sitemap.
  const directory = await fetchResidentialProviders({ limit: 48 });
  const first = directory.items;
  const rest =
    directory.totalPages > 1
      ? (
          await Promise.all(
            Array.from({ length: directory.totalPages - 1 }, (_, i) => fetchResidentialProviders({ page: i + 2, limit: 48 })),
          )
        ).flatMap((d) => d.items)
      : [];
  const providerEntries: MetadataRoute.Sitemap = [...first, ...rest].map((p) => ({
    url: `${base}/residential-providers/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries, ...providerEntries];
}
