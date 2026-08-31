import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ShortVideoService } from "./short-video.service";
import { TestimonialService } from "./testimonial.service";

const user = { id: "u1" } as unknown as RequestUser;
const NOW = new Date("2026-01-01T00:00:00.000Z");
const audit = { record: jest.fn(async () => ({})) } as unknown as AuditService;

type A = { where?: unknown; orderBy?: unknown; skip?: number; take?: number; data?: Record<string, unknown> };

describe("ShortVideoService.publicList", () => {
  it("returns only active videos ordered by sortOrder", async () => {
    const findMany = jest.fn((_a: A): Promise<unknown> => Promise.resolve([]));
    const prisma = { shortVideo: { findMany } } as unknown as PrismaService;
    const svc = new ShortVideoService(prisma, audit);
    await svc.publicList();
    expect(findMany.mock.calls[0]![0].where).toEqual({ active: true });
    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "desc" }]);
  });
});

describe("ShortVideoService.create", () => {
  it("defaults to active and stamps publishedAt", async () => {
    const create = jest.fn((a: A): Promise<unknown> =>
      Promise.resolve({
        id: "v1", ...a.data, caption: null, posterImageUrl: null, sourceLabel: null, blogPostId: null,
        sortOrder: 0, publishedAt: NOW, createdByUserId: "u1", updatedByUserId: "u1", createdAt: NOW, updatedAt: NOW,
      }),
    );
    const prisma = { shortVideo: { create }, blogPost: { findUnique: jest.fn() } } as unknown as PrismaService;
    const svc = new ShortVideoService(prisma, audit);
    await svc.create(user, { title: "Vid", videoUrl: "/assets/videos/x.mp4" } as never);
    const data = create.mock.calls[0]![0].data!;
    expect(data.active).toBe(true);
    expect(data.publishedAt).toBeInstanceOf(Date);
  });
});

describe("TestimonialService.publicList", () => {
  it("returns only active testimonials, featured first", async () => {
    const findMany = jest.fn((_a: A): Promise<unknown> => Promise.resolve([]));
    const prisma = { testimonial: { findMany } } as unknown as PrismaService;
    const svc = new TestimonialService(prisma, audit);
    await svc.publicList();
    expect(findMany.mock.calls[0]![0].where).toEqual({ active: true });
    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }]);
  });
});

describe("TestimonialService.adminList activeOnly filter", () => {
  it("adds an active clause when activeOnly is set", async () => {
    const findMany = jest.fn((_a: A): Promise<unknown> => Promise.resolve([]));
    const count = jest.fn((_a: A): Promise<unknown> => Promise.resolve(0));
    const prisma = { testimonial: { findMany, count }, $transaction: async (a: Promise<unknown>[]) => Promise.all(a) } as unknown as PrismaService;
    const svc = new TestimonialService(prisma, audit);
    await svc.adminList({ page: 1, pageSize: 20, activeOnly: true } as never);
    expect(findMany.mock.calls[0]![0].where).toEqual({ AND: [{ active: true }] });
  });
});
