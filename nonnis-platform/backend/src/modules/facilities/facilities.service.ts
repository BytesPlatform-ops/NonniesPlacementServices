import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type FacilityStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import { requireActiveOrganization } from "../auth/org-context";
import type { RequestUser } from "../auth/request-user";
import { facilityInclude, toFacilityView, type FacilityView } from "./facilities.serializer";
import type { CreateFacilityDto, ListFacilitiesQueryDto, UpdateFacilityDto } from "./dto/facility.dto";

/**
 * Facilities are strictly organization-scoped: every operation is bounded by
 * the caller's active organization, so a user can never read or mutate a
 * facility belonging to another organization.
 */
@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, query: ListFacilitiesQueryDto): Promise<PaginatedResult<FacilityView>> {
    const organizationId = requireActiveOrganization(user);
    const { page, pageSize, status, q } = query;
    const where: Prisma.FacilityWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.facility.findMany({
        where,
        include: facilityInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.facility.count({ where }),
    ]);

    return {
      items: rows.map(toFacilityView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findOne(user: RequestUser, id: string): Promise<FacilityView> {
    const organizationId = requireActiveOrganization(user);
    const row = await this.prisma.facility.findFirst({ where: { id, organizationId }, include: facilityInclude });
    if (!row) {
      throw new NotFoundException(`Facility ${id} not found`);
    }
    return toFacilityView(row);
  }

  async create(user: RequestUser, dto: CreateFacilityDto): Promise<FacilityView> {
    const organizationId = requireActiveOrganization(user);
    const created = await this.prisma.facility.create({
      data: {
        organizationId,
        name: dto.name,
        externalRef: dto.externalRef,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        phone: dto.phone,
      },
      include: facilityInclude,
    });
    await this.audit.record({
      action: "facility.created",
      entityType: "Facility",
      entityId: created.id,
      organizationId,
      actorUserId: user.id,
      metadata: { name: created.name },
    });
    return toFacilityView(created);
  }

  async update(user: RequestUser, id: string, dto: UpdateFacilityDto): Promise<FacilityView> {
    const organizationId = await this.ensureInOrg(user, id);
    const updated = await this.prisma.facility.update({
      where: { id },
      data: {
        name: dto.name,
        externalRef: dto.externalRef,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        phone: dto.phone,
      },
      include: facilityInclude,
    });
    await this.audit.record({
      action: "facility.updated",
      entityType: "Facility",
      entityId: id,
      organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toFacilityView(updated);
  }

  async setStatus(user: RequestUser, id: string, status: FacilityStatus): Promise<FacilityView> {
    const organizationId = await this.ensureInOrg(user, id);
    const updated = await this.prisma.facility.update({ where: { id }, data: { status }, include: facilityInclude });
    await this.audit.record({
      action: "facility.status_changed",
      entityType: "Facility",
      entityId: id,
      organizationId,
      actorUserId: user.id,
      metadata: { status },
    });
    return toFacilityView(updated);
  }

  /** Verify the facility exists within the caller's active organization; returns the org id. */
  private async ensureInOrg(user: RequestUser, id: string): Promise<string> {
    const organizationId = requireActiveOrganization(user);
    const facility = await this.prisma.facility.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!facility) {
      throw new NotFoundException(`Facility ${id} not found`);
    }
    return organizationId;
  }
}
