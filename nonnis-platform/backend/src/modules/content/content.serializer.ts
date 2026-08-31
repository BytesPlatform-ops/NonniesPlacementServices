import type { BlogPost, ContentStatus, ShortVideo, Testimonial } from "@prisma/client";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// ---- Blog: admin views (full) ----

export interface BlogAdminSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  displayAuthor: string | null;
  featuredImageUrl: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogAdminDetail extends BlogAdminSummary {
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

/** List row — deliberately omits the (large) article body. */
export function toBlogAdminSummary(p: BlogPost): BlogAdminSummary {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    category: p.category,
    displayAuthor: p.displayAuthor,
    featuredImageUrl: p.featuredImageUrl,
    status: p.status,
    publishedAt: iso(p.publishedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toBlogAdminDetail(p: BlogPost): BlogAdminDetail {
  return {
    ...toBlogAdminSummary(p),
    body: p.body,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  };
}

// ---- Blog: public views (published-only, public-safe fields) ----

export interface BlogPublicCard {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  displayAuthor: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
}

export interface BlogPublicDetail extends BlogPublicCard {
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export function toBlogPublicCard(p: BlogPost): BlogPublicCard {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    displayAuthor: p.displayAuthor,
    featuredImageUrl: p.featuredImageUrl,
    publishedAt: iso(p.publishedAt),
  };
}

export function toBlogPublicDetail(p: BlogPost): BlogPublicDetail {
  return {
    ...toBlogPublicCard(p),
    body: p.body,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  };
}

// ---- Short video ----

export interface VideoAdminView {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterImageUrl: string | null;
  sourceLabel: string | null;
  blogPostId: string | null;
  active: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoPublicView {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterImageUrl: string | null;
  sourceLabel: string | null;
}

export function toVideoAdminView(v: ShortVideo): VideoAdminView {
  return {
    id: v.id,
    title: v.title,
    caption: v.caption,
    videoUrl: v.videoUrl,
    posterImageUrl: v.posterImageUrl,
    sourceLabel: v.sourceLabel,
    blogPostId: v.blogPostId,
    active: v.active,
    sortOrder: v.sortOrder,
    publishedAt: iso(v.publishedAt),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function toVideoPublicView(v: ShortVideo): VideoPublicView {
  return {
    id: v.id,
    title: v.title,
    caption: v.caption,
    videoUrl: v.videoUrl,
    posterImageUrl: v.posterImageUrl,
    sourceLabel: v.sourceLabel,
  };
}

// ---- Testimonial ----

export interface TestimonialAdminView {
  id: string;
  quote: string;
  clientName: string | null;
  clientTitle: string | null;
  organization: string | null;
  location: string | null;
  internalNotes: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialPublicView {
  id: string;
  quote: string;
  clientName: string | null;
  clientTitle: string | null;
  organization: string | null;
  location: string | null;
  featured: boolean;
}

export function toTestimonialAdminView(t: Testimonial): TestimonialAdminView {
  return {
    id: t.id,
    quote: t.quote,
    clientName: t.clientName,
    clientTitle: t.clientTitle,
    organization: t.organization,
    location: t.location,
    internalNotes: t.internalNotes,
    active: t.active,
    featured: t.featured,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Public testimonial — NEVER includes internalNotes, user ids, or timestamps. */
export function toTestimonialPublicView(t: Testimonial): TestimonialPublicView {
  return {
    id: t.id,
    quote: t.quote,
    clientName: t.clientName,
    clientTitle: t.clientTitle,
    organization: t.organization,
    location: t.location,
    featured: t.featured,
  };
}
