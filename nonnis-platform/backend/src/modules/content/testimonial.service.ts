import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { toTestimonialAdminView, toTestimonialPublicView, type TestimonialAdminView, type TestimonialPublicView } from "./content.serializer";
import type { CreateTestimonialDto, ListTestimonialsDto, UpdateTestimonialDto } from "./dto/testimonial.dto";

@Injectable()
export class TestimonialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async adminList(query: ListTestimonialsDto): Promise<PaginatedResult<TestimonialAdminView>> {
    const and: Prisma.TestimonialWhereInput[] = [];
    if (query.activeOnly) and.push({ active: true });
    if (query.q) {
      and.push({
        OR: [
          { quote: { contains: query.q, mode: "insensitive" } },
          { clientName: { contains: query.q, mode: "insensitive" } },
          { organization: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.TestimonialWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.testimonial.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.testimonial.count({ where }),
    ]);
    return {
      items: rows.map(toTestimonialAdminView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async adminFindOne(id: string): Promise<TestimonialAdminView> {
    const row = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Testimonial ${id} not found`);
    return toTestimonialAdminView(row);
  }

  async create(user: RequestUser, dto: CreateTestimonialDto): Promise<TestimonialAdminView> {
    const created = await this.prisma.testimonial.create({
      data: {
        quote: dto.quote,
        clientName: dto.clientName,
        clientTitle: dto.clientTitle,
        organization: dto.organization,
        location: dto.location,
        internalNotes: dto.internalNotes,
        active: dto.active ?? true,
        featured: dto.featured ?? false,
        sortOrder: dto.sortOrder ?? 0,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "testimonial.created", entityType: "Testimonial", entityId: created.id, actorUserId: user.id, metadata: { active: created.active } });
    return toTestimonialAdminView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateTestimonialDto): Promise<TestimonialAdminView> {
    const existing = await this.prisma.testimonial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Testimonial ${id} not found`);
    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        quote: dto.quote,
        clientName: dto.clientName,
        clientTitle: dto.clientTitle,
        organization: dto.organization,
        location: dto.location,
        internalNotes: dto.internalNotes,
        active: dto.active,
        featured: dto.featured,
        sortOrder: dto.sortOrder,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "testimonial.updated", entityType: "Testimonial", entityId: id, actorUserId: user.id, metadata: { fields: Object.keys(dto) } });
    return toTestimonialAdminView(updated);
  }

  async setActive(user: RequestUser, id: string, active: boolean): Promise<TestimonialAdminView> {
    const existing = await this.prisma.testimonial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Testimonial ${id} not found`);
    const updated = await this.prisma.testimonial.update({ where: { id }, data: { active, updatedByUserId: user.id } });
    await this.audit.record({ action: active ? "testimonial.activated" : "testimonial.deactivated", entityType: "Testimonial", entityId: id, actorUserId: user.id });
    return toTestimonialAdminView(updated);
  }

  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.testimonial.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Testimonial ${id} not found`);
    await this.prisma.testimonial.delete({ where: { id } });
    await this.audit.record({ action: "testimonial.deleted", entityType: "Testimonial", entityId: id, actorUserId: user.id });
    return { id };
  }

  /** Active testimonials for the homepage — featured first, then manual order. */
  async publicList(): Promise<TestimonialPublicView[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toTestimonialPublicView);
  }
}
