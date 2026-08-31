import type { MetadataRoute } from "next";
import { fetchBlogPosts } from "@/lib/platform/content";

// Mirrors the metadataBase placeholder in `layout.tsx`. Update both when the
// production domain is finalized.
const SITE_URL = "https://nonnisplacement.example";

export const revalidate = 300;

const STATIC_ROUTES = ["/", "/families", "/providers", "/home-health-care", "/blog", "/about", "/contact", "/hospital-referral", "/privacy", "/terms"];

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

  return [...staticEntries, ...postEntries];
}
