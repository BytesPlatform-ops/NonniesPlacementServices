export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export const CONTENT_STATUSES: ContentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export interface BlogPostSummary {
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

export interface BlogPostDetail extends BlogPostSummary {
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  featuredImageStoragePath: string | null;
}

export interface ShortVideoView {
  id: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  videoStoragePath: string | null;
  posterImageUrl: string | null;
  posterImageStoragePath: string | null;
  sourceLabel: string | null;
  blogPostId: string | null;
  active: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialView {
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
