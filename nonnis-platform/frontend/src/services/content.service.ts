import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { BlogPostDetail, BlogPostSummary, ShortVideoView, TestimonialView } from "@/types/content";

function qs(filters: object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- Blog ----

export interface BlogFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  category?: string;
  sort?: string;
  order?: string;
}

export function listBlogPosts(filters: BlogFilters = {}): Promise<PaginatedResult<BlogPostSummary>> {
  return apiGet<PaginatedResult<BlogPostSummary>>(`/api/v1/blog-posts${qs(filters)}`);
}
export function getBlogPost(id: string): Promise<BlogPostDetail> {
  return apiGet<BlogPostDetail>(`/api/v1/blog-posts/${id}`);
}
export function createBlogPost(body: Record<string, unknown>): Promise<BlogPostDetail> {
  return apiPost<BlogPostDetail>(`/api/v1/blog-posts`, body);
}
export function updateBlogPost(id: string, body: Record<string, unknown>): Promise<BlogPostDetail> {
  return apiPatch<BlogPostDetail>(`/api/v1/blog-posts/${id}`, body);
}
export function publishBlogPost(id: string): Promise<BlogPostDetail> {
  return apiPost<BlogPostDetail>(`/api/v1/blog-posts/${id}/publish`, {});
}
export function unpublishBlogPost(id: string): Promise<BlogPostDetail> {
  return apiPost<BlogPostDetail>(`/api/v1/blog-posts/${id}/unpublish`, {});
}
export function archiveBlogPost(id: string): Promise<BlogPostDetail> {
  return apiPost<BlogPostDetail>(`/api/v1/blog-posts/${id}/archive`, {});
}
export function deleteBlogPost(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/blog-posts/${id}`);
}

// ---- Short videos ----

export interface VideoFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  activeOnly?: boolean;
}

export function listShortVideos(filters: VideoFilters = {}): Promise<PaginatedResult<ShortVideoView>> {
  return apiGet<PaginatedResult<ShortVideoView>>(`/api/v1/short-videos${qs(filters)}`);
}
export function getShortVideo(id: string): Promise<ShortVideoView> {
  return apiGet<ShortVideoView>(`/api/v1/short-videos/${id}`);
}
export function createShortVideo(body: Record<string, unknown>): Promise<ShortVideoView> {
  return apiPost<ShortVideoView>(`/api/v1/short-videos`, body);
}
export function updateShortVideo(id: string, body: Record<string, unknown>): Promise<ShortVideoView> {
  return apiPatch<ShortVideoView>(`/api/v1/short-videos/${id}`, body);
}
export function setShortVideoActive(id: string, active: boolean): Promise<ShortVideoView> {
  return apiPatch<ShortVideoView>(`/api/v1/short-videos/${id}/active`, { active });
}
export function deleteShortVideo(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/short-videos/${id}`);
}

// ---- Testimonials ----

export interface TestimonialFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  activeOnly?: boolean;
}

export function listTestimonials(filters: TestimonialFilters = {}): Promise<PaginatedResult<TestimonialView>> {
  return apiGet<PaginatedResult<TestimonialView>>(`/api/v1/testimonials${qs(filters)}`);
}
export function getTestimonial(id: string): Promise<TestimonialView> {
  return apiGet<TestimonialView>(`/api/v1/testimonials/${id}`);
}
export function createTestimonial(body: Record<string, unknown>): Promise<TestimonialView> {
  return apiPost<TestimonialView>(`/api/v1/testimonials`, body);
}
export function updateTestimonial(id: string, body: Record<string, unknown>): Promise<TestimonialView> {
  return apiPatch<TestimonialView>(`/api/v1/testimonials/${id}`, body);
}
export function setTestimonialActive(id: string, active: boolean): Promise<TestimonialView> {
  return apiPatch<TestimonialView>(`/api/v1/testimonials/${id}/active`, { active });
}
export function deleteTestimonial(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/v1/testimonials/${id}`);
}
