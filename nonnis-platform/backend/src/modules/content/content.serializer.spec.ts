import type { BlogPost, ShortVideo, Testimonial } from "@prisma/client";
import {
  toBlogPublicCard,
  toBlogPublicDetail,
  toTestimonialPublicView,
  toVideoPublicView,
} from "./content.serializer";

const now = new Date("2026-01-01T00:00:00.000Z");

const blog: BlogPost = {
  id: "b1",
  title: "Title",
  slug: "title",
  excerpt: "Excerpt",
  body: "## Body\n\ntext",
  featuredImageUrl: "/assets/images/x.jpg",
  category: "Care Planning",
  displayAuthor: "Nonnis Care Team",
  metaTitle: "Meta",
  metaDescription: "Meta description",
  status: "PUBLISHED",
  publishedAt: now,
  createdByUserId: "u1",
  updatedByUserId: "u1",
  createdAt: now,
  updatedAt: now,
};

const testimonial: Testimonial = {
  id: "t1",
  quote: "Great",
  clientName: "Demo Family Testimonial",
  clientTitle: "Daughter",
  organization: null,
  location: "CA",
  internalNotes: "SECRET internal note",
  active: true,
  featured: true,
  sortOrder: 0,
  createdByUserId: "u1",
  updatedByUserId: "u1",
  createdAt: now,
  updatedAt: now,
};

const video: ShortVideo = {
  id: "v1",
  title: "Vid",
  caption: "Caption",
  videoUrl: "/assets/videos/x.mp4",
  posterImageUrl: "/assets/images/x.jpg",
  sourceLabel: "Nonnis Stories",
  blogPostId: null,
  active: true,
  sortOrder: 0,
  publishedAt: now,
  createdByUserId: "u1",
  updatedByUserId: "u1",
  createdAt: now,
  updatedAt: now,
};

describe("public serializers hide admin/internal data", () => {
  it("blog card omits body, status, and user metadata", () => {
    const card = toBlogPublicCard(blog);
    expect(card).not.toHaveProperty("body");
    expect(card).not.toHaveProperty("status");
    expect(card).not.toHaveProperty("createdByUserId");
    expect(card).not.toHaveProperty("id");
    expect(card.slug).toBe("title");
  });

  it("blog detail includes body but never status/user ids", () => {
    const detail = toBlogPublicDetail(blog);
    expect(detail.body).toContain("Body");
    expect(detail).not.toHaveProperty("status");
    expect(detail).not.toHaveProperty("updatedByUserId");
  });

  it("public testimonial NEVER exposes internalNotes or user ids", () => {
    const view = toTestimonialPublicView(testimonial);
    expect(JSON.stringify(view)).not.toContain("SECRET");
    expect(view).not.toHaveProperty("internalNotes");
    expect(view).not.toHaveProperty("createdByUserId");
    expect(view).not.toHaveProperty("active");
    expect(view.quote).toBe("Great");
  });

  it("public video exposes only presentation fields", () => {
    const view = toVideoPublicView(video);
    expect(view).not.toHaveProperty("active");
    expect(view).not.toHaveProperty("createdByUserId");
    expect(view).not.toHaveProperty("blogPostId");
    expect(view.videoUrl).toBe("/assets/videos/x.mp4");
  });
});
