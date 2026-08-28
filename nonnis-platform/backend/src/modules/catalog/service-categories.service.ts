import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import {
  serviceCategoryInclude,
  toServiceCategoryView,
  type ServiceCategoryView,
} from "./catalog.serializer";
import type {
  CatalogStatusDto,
  CreateServiceCategoryDto,
  ListCatalogQueryDto,
  UpdateServiceCategoryDto,
} from "./dto/catalog.dto";

/**
 * Admin-managed service-category catalog. Categories are never hard-deleted
 * (they may be referenced by provider services and historical service requests);
 * deactivation is a soft `active=false` toggle that preserves all history.
 */
@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCatalogQueryDto): Promise<PaginatedResult<ServiceCategoryView>> {
    const { page, pageSize, q, activeOnly } = query;
    const where: Prisma.ServiceCategoryWhereInput = {
      ...(activeOnly ? { active: true } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        include: serviceCategoryInclude,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    return {
      items: rows.map(toServiceCategoryView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<ServiceCategoryView> {
    const row = await this.prisma.serviceCategory.findUnique({ where: { id }, include: serviceCategoryInclude });
    if (!row) throw new NotFoundException(`Service category ${id} not found`);
    return toServiceCategoryView(row);
  }

  async create(user: RequestUser, dto: CreateServiceCategoryDto): Promise<ServiceCategoryView> {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { code: dto.code }, select: { id: true } });
    if (existing) throw new ConflictException(`A service category with code ${dto.code} already exists`);

    const created = await this.prisma.serviceCategory.create({
      data: { code: dto.code, name: dto.name, description: dto.description, sortOrder: dto.sortOrder ?? 0 },
      include: serviceCategoryInclude,
    });
    await this.audit.record({
      action: "service_category.created",
      entityType: "ServiceCategory",
      entityId: created.id,
      actorUserId: user.id,
      metadata: { code: created.code, name: created.name },
    });
    return toServiceCategoryView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateServiceCategoryDto): Promise<ServiceCategoryView> {
    await this.ensureExists(id);
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: { name: dto.name, description: dto.description, sortOrder: dto.sortOrder },
      include: serviceCategoryInclude,
    });
    await this.audit.record({
      action: "service_category.updated",
      entityType: "ServiceCategory",
      entityId: id,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toServiceCategoryView(updated);
  }

  async setStatus(user: RequestUser, id: string, dto: CatalogStatusDto): Promise<ServiceCategoryView> {
    await this.ensureExists(id);
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: { active: dto.active },
      include: serviceCategoryInclude,
    });
    await this.audit.record({
      action: "service_category.status_changed",
      entityType: "ServiceCategory",
      entityId: id,
      actorUserId: user.id,
      metadata: { active: dto.active },
    });
    return toServiceCategoryView(updated);
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.serviceCategory.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Service category ${id} not found`);
  }
}
