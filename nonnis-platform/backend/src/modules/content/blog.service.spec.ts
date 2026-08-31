import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { BlogService } from "./blog.service";

const user = { id: "u1" } as unknown as RequestUser;
const NOW = new Date("2026-01-01T00:00:00.000Z");

function row(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    title: "Title",
    slug: "title",
    excerpt: null,
    body: "body",
    featuredImageUrl: null,
    category: null,
    displayAuthor: null,
    metaTitle: null,
    metaDescription: null,
    status: "DRAFT",
    publishedAt: null,
    createdByUserId: "u1",
    updatedByUserId: "u1",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

type A = { where?: unknown; orderBy?: unknown; skip?: number; take?: number; data?: Record<string, unknown> };

function build() {
  const blogPost = {
    findMany: jest.fn((_a: A): Promise<unknown> => Promise.resolve([row()])),
    count: jest.fn((_a: A): Promise<unknown> => Promise.resolve(1)),
    findUnique: jest.fn((_a: A): Promise<unknown> => Promise.resolve(row())),
    findFirst: jest.fn((_a: A): Promise<unknown> => Promise.resolve(null)),
    create: jest.fn((a: A): Promise<unknown> => Promise.resolve(row(a.data))),
    update: jest.fn((a: A): Promise<unknown> => Promise.resolve(row({ ...a.data }))),
    delete: jest.fn((_a: A): Promise<unknown> => Promise.resolve(row())),
  };
  const prisma = {
    blogPost,
    $transaction: async (arr: Promise<unknown>[]) => Promise.all(arr),
  } as unknown as PrismaService;
  const audit = { record: jest.fn(async () => ({})) } as unknown as AuditService;
  return { svc: new BlogService(prisma, audit), blogPost, audit };
}

describe("BlogService.create", () => {
  it("uses the provided slug and stays a draft with no publishedAt", async () => {
    const { svc, blogPost } = build();
    await svc.create(user, { title: "Title", slug: "custom-slug", body: "body" } as never);
    const data = blogPost.create.mock.calls[0]![0].data!;
    expect(data.slug).toBe("custom-slug");
    expect(data.status).toBe("DRAFT");
    expect(data.publishedAt).toBeNull();
  });

  it("stamps publishedAt when created already PUBLISHED", async () => {
    const { svc, blogPost } = build();
    await svc.create(user, { title: "Title", body: "body", status: "PUBLISHED" } as never);
    const data = blogPost.create.mock.calls[0]![0].data!;
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("derives a slug from the title and de-duplicates on collision", async () => {
    const { svc, blogPost } = build();
    blogPost.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(null);
    await svc.create(user, { title: "Hello World", body: "body" } as never);
    const data = blogPost.create.mock.calls[0]![0].data!;
    expect(data.slug).toBe("hello-world-2");
  });

  it("audits creation", async () => {
    const { svc, audit } = build();
    await svc.create(user, { title: "Title", body: "body" } as never);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "blog_post.created", entityType: "BlogPost", actorUserId: "u1" }));
  });
});

describe("BlogService.setStatus", () => {
  it("publishes and stamps publishedAt, auditing the publish", async () => {
    const { svc, blogPost, audit } = build();
    await svc.setStatus(user, "b1", "PUBLISHED");
    const data = blogPost.update.mock.calls[0]![0].data!;
    expect(data.status).toBe("PUBLISHED");
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "blog_post.published" }));
  });

  it("keeps the original publishedAt when re-publishing", async () => {
    const { svc, blogPost } = build();
    const original = new Date("2025-06-01T00:00:00.000Z");
    blogPost.findUnique.mockResolvedValueOnce(row({ status: "ARCHIVED", publishedAt: original }));
    await svc.setStatus(user, "b1", "PUBLISHED");
    expect(blogPost.update.mock.calls[0]![0].data!.publishedAt).toEqual(original);
  });
});

describe("BlogService public reads", () => {
  it("publicList filters to PUBLISHED only", async () => {
    const { svc, blogPost } = build();
    await svc.publicList({ page: 1, pageSize: 20 } as never);
    expect(blogPost.findMany.mock.calls[0]![0].where).toEqual({ status: "PUBLISHED" });
  });

  it("publicFindBySlug requires PUBLISHED and 404s a draft/unknown slug", async () => {
    const { svc, blogPost } = build();
    blogPost.findFirst.mockResolvedValueOnce(null);
    await expect(svc.publicFindBySlug("draft-slug")).rejects.toBeInstanceOf(NotFoundException);
    expect(blogPost.findFirst.mock.calls[0]![0].where).toEqual({ slug: "draft-slug", status: "PUBLISHED" });
  });

  it("publicFindBySlug returns a public detail (no status/user ids) for a published post", async () => {
    const { svc, blogPost } = build();
    blogPost.findFirst.mockResolvedValueOnce(row({ status: "PUBLISHED", publishedAt: NOW }));
    const detail = await svc.publicFindBySlug("title");
    expect(detail).not.toHaveProperty("status");
    expect(detail).not.toHaveProperty("createdByUserId");
    expect(detail.slug).toBe("title");
  });
});
