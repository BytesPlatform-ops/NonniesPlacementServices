import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ContentStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { isValidSlug, slugify } from "./content-slug";
import {
  toBlogAdminDetail,
  toBlogAdminSummary,
  toBlogPublicCard,
  toBlogPublicDetail,
  type BlogAdminDetail,
  type BlogAdminSummary,
  type BlogPublicCard,
  type BlogPublicDetail,
} from "./content.serializer";
import type { CreateBlogPostDto, ListBlogPostsDto, PublicBlogQueryDto, UpdateBlogPostDto } from "./dto/blog.dto";

const SORTABLE = new Set(["updatedAt", "createdAt", "publishedAt", "title"]);

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- admin ----

  async adminList(query: ListBlogPostsDto): Promise<PaginatedResult<BlogAdminSummary>> {
    const and: Prisma.BlogPostWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.category) and.push({ category: query.category });
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { slug: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.BlogPostWhereInput = and.length > 0 ? { AND: and } : {};
    const sortField = query.sort && SORTABLE.has(query.sort) ? query.sort : "updatedAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({ where, orderBy: { [sortField]: order }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      items: rows.map(toBlogAdminSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async adminFindOne(id: string): Promise<BlogAdminDetail> {
    const row = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Blog post ${id} not found`);
    return toBlogAdminDetail(row);
  }

  async create(user: RequestUser, dto: CreateBlogPostDto): Promise<BlogAdminDetail> {
    const slug = await this.resolveSlug(dto.slug, dto.title);
    const status: ContentStatus = dto.status ?? "DRAFT";
    const created = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        body: dto.body,
        featuredImageUrl: dto.featuredImageUrl,
        category: dto.category,
        displayAuthor: dto.displayAuthor,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "blog_post.created", entityType: "BlogPost", entityId: created.id, actorUserId: user.id, metadata: { slug: created.slug, status: created.status } });
    return toBlogAdminDetail(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateBlogPostDto): Promise<BlogAdminDetail> {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Blog post ${id} not found`);

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      if (!isValidSlug(dto.slug)) throw new BadRequestException("Invalid slug.");
      slug = await this.resolveSlug(dto.slug, dto.slug, id);
    }

    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        body: dto.body,
        featuredImageUrl: dto.featuredImageUrl,
        category: dto.category,
        displayAuthor: dto.displayAuthor,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "blog_post.updated", entityType: "BlogPost", entityId: id, actorUserId: user.id, metadata: { fields: Object.keys(dto) } });
    return toBlogAdminDetail(updated);
  }

  async setStatus(user: RequestUser, id: string, status: ContentStatus): Promise<BlogAdminDetail> {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Blog post ${id} not found`);

    // Set publishedAt the first time a post is published; keep the original date thereafter.
    const publishedAt = status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;
    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: { status, publishedAt, updatedByUserId: user.id },
    });
    const action = status === "PUBLISHED" ? "blog_post.published" : status === "ARCHIVED" ? "blog_post.archived" : "blog_post.unpublished";
    await this.audit.record({ action, entityType: "BlogPost", entityId: id, actorUserId: user.id, metadata: { status } });
    return toBlogAdminDetail(updated);
  }

  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.blogPost.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!existing) throw new NotFoundException(`Blog post ${id} not found`);
    await this.prisma.blogPost.delete({ where: { id } });
    await this.audit.record({ action: "blog_post.deleted", entityType: "BlogPost", entityId: id, actorUserId: user.id, metadata: { slug: existing.slug } });
    return { id };
  }

  // ---- public (published only) ----

  async publicList(query: PublicBlogQueryDto): Promise<PaginatedResult<BlogPublicCard>> {
    const where: Prisma.BlogPostWhereInput = { status: "PUBLISHED", ...(query.category ? { category: query.category } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      items: rows.map(toBlogPublicCard),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async publicFindBySlug(slug: string): Promise<BlogPublicDetail> {
    const row = await this.prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED" } });
    if (!row) throw new NotFoundException(`Article not found`);
    return toBlogPublicDetail(row);
  }

  // ---- helpers ----

  /** Produce a unique slug from an explicit slug or a title, suffixing -2, -3, … on collision. */
  private async resolveSlug(explicit: string | undefined, fallbackSource: string, excludeId?: string): Promise<string> {
    const base = explicit ? slugify(explicit) : slugify(fallbackSource);
    if (!base) throw new BadRequestException("A title or slug is required to derive a URL.");
    let candidate = base;
    for (let n = 2; n < 100; n++) {
      const clash = await this.prisma.blogPost.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
      if (!clash) return candidate;
      candidate = `${base}-${n}`.slice(0, 80).replace(/-+$/g, "");
    }
    throw new ConflictException("Could not allocate a unique slug.");
  }
}
