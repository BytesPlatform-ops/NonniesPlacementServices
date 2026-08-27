import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { AuditService } from "../audit/audit.service";
import { isMemberOf } from "../auth/org-context";
import type { RequestUser } from "../auth/request-user";
import {
  organizationInclude,
  toOrganizationView,
  type OrganizationView,
} from "./organizations.serializer";
import type {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  UpdateOrganizationDto,
} from "./dto/organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Platform-scoped list of all organizations (guarded by organizations.manage). */
  async list(query: ListOrganizationsQueryDto): Promise<PaginatedResult<OrganizationView>> {
    const { page, pageSize, type, status, q } = query;
    const where: Prisma.OrganizationWhereInput = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: organizationInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      items: rows.map(toOrganizationView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /** Read a single organization. Non-platform users may only read their own. */
  async findOne(user: RequestUser, id: string): Promise<OrganizationView> {
    const isPlatform = user.activePermissions.has(PERMISSIONS.ORGANIZATIONS_MANAGE);
    if (!isPlatform && !isMemberOf(user, id)) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
    const row = await this.prisma.organization.findUnique({ where: { id }, include: organizationInclude });
    if (!row) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
    return toOrganizationView(row);
  }

  async create(user: RequestUser, dto: CreateOrganizationDto): Promise<OrganizationView> {
    const created = await this.prisma.organization.create({
      data: { type: dto.type, name: dto.name, legalName: dto.legalName, externalRef: dto.externalRef },
      include: organizationInclude,
    });
    await this.audit.record({
      action: "organization.created",
      entityType: "Organization",
      entityId: created.id,
      organizationId: created.id,
      actorUserId: user.id,
      metadata: { name: created.name, type: created.type },
    });
    return toOrganizationView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateOrganizationDto): Promise<OrganizationView> {
    await this.ensureExists(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { name: dto.name, legalName: dto.legalName, externalRef: dto.externalRef },
      include: organizationInclude,
    });
    await this.audit.record({
      action: "organization.updated",
      entityType: "Organization",
      entityId: id,
      organizationId: id,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toOrganizationView(updated);
  }

  async setStatus(user: RequestUser, id: string, status: OrganizationStatus): Promise<OrganizationView> {
    await this.ensureExists(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status },
      include: organizationInclude,
    });
    await this.audit.record({
      action: "organization.status_changed",
      entityType: "Organization",
      entityId: id,
      organizationId: id,
      actorUserId: user.id,
      metadata: { status },
    });
    return toOrganizationView(updated);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
  }
}
