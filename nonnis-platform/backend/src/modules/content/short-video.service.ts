import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { toVideoAdminView, toVideoPublicView, type VideoAdminView, type VideoPublicView } from "./content.serializer";
import type { CreateShortVideoDto, ListShortVideosDto, UpdateShortVideoDto } from "./dto/short-video.dto";

@Injectable()
export class ShortVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async adminList(query: ListShortVideosDto): Promise<PaginatedResult<VideoAdminView>> {
    const and: Prisma.ShortVideoWhereInput[] = [];
    if (query.activeOnly) and.push({ active: true });
    if (query.q) and.push({ title: { contains: query.q, mode: "insensitive" } });
    const where: Prisma.ShortVideoWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.shortVideo.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.shortVideo.count({ where }),
    ]);
    return {
      items: rows.map(toVideoAdminView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async adminFindOne(id: string): Promise<VideoAdminView> {
    const row = await this.prisma.shortVideo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Short video ${id} not found`);
    return toVideoAdminView(row);
  }

  async create(user: RequestUser, dto: CreateShortVideoDto): Promise<VideoAdminView> {
    if (dto.blogPostId) await this.assertBlogPostExists(dto.blogPostId);
    const active = dto.active ?? true;
    const created = await this.prisma.shortVideo.create({
      data: {
        title: dto.title,
        caption: dto.caption,
        videoUrl: dto.videoUrl,
        posterImageUrl: dto.posterImageUrl,
        sourceLabel: dto.sourceLabel,
        blogPostId: dto.blogPostId,
        active,
        sortOrder: dto.sortOrder ?? 0,
        publishedAt: active ? new Date() : null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "short_video.created", entityType: "ShortVideo", entityId: created.id, actorUserId: user.id, metadata: { title: created.title, active: created.active } });
    return toVideoAdminView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateShortVideoDto): Promise<VideoAdminView> {
    const existing = await this.prisma.shortVideo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Short video ${id} not found`);
    if (dto.blogPostId) await this.assertBlogPostExists(dto.blogPostId);

    const nowActive = dto.active ?? existing.active;
    const updated = await this.prisma.shortVideo.update({
      where: { id },
      data: {
        title: dto.title,
        caption: dto.caption,
        videoUrl: dto.videoUrl,
        posterImageUrl: dto.posterImageUrl,
        sourceLabel: dto.sourceLabel,
        blogPostId: dto.blogPostId === null ? null : dto.blogPostId,
        active: dto.active,
        sortOrder: dto.sortOrder,
        // Stamp publishedAt the first time it becomes active.
        publishedAt: nowActive && !existing.publishedAt ? new Date() : existing.publishedAt,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "short_video.updated", entityType: "ShortVideo", entityId: id, actorUserId: user.id, metadata: { fields: Object.keys(dto) } });
    return toVideoAdminView(updated);
  }

  async setActive(user: RequestUser, id: string, active: boolean): Promise<VideoAdminView> {
    const existing = await this.prisma.shortVideo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Short video ${id} not found`);
    const updated = await this.prisma.shortVideo.update({
      where: { id },
      data: { active, publishedAt: active && !existing.publishedAt ? new Date() : existing.publishedAt, updatedByUserId: user.id },
    });
    await this.audit.record({ action: active ? "short_video.activated" : "short_video.deactivated", entityType: "ShortVideo", entityId: id, actorUserId: user.id });
    return toVideoAdminView(updated);
  }

  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.shortVideo.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Short video ${id} not found`);
    await this.prisma.shortVideo.delete({ where: { id } });
    await this.audit.record({ action: "short_video.deleted", entityType: "ShortVideo", entityId: id, actorUserId: user.id });
    return { id };
  }

  async publicList(): Promise<VideoPublicView[]> {
    const rows = await this.prisma.shortVideo.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    return rows.map(toVideoPublicView);
  }

  private async assertBlogPostExists(blogPostId: string): Promise<void> {
    const bp = await this.prisma.blogPost.findUnique({ where: { id: blogPostId }, select: { id: true } });
    if (!bp) throw new BadRequestException("The associated blog post does not exist.");
  }
}
