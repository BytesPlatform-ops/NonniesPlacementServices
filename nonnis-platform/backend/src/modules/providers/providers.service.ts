import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService, canManageAllProviders, canManageProvider } from "./provider-access";
import {
  providerDetailInclude,
  providerListInclude,
  toProviderDetailView,
  toProviderSummaryView,
  type ProviderDetailView,
  type ProviderSummaryView,
} from "./providers.serializer";
import type { CreateProviderDto, ListProvidersQueryDto, UpdateProviderDto } from "./dto/provider.dto";

export interface ProviderUserView {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  roleCode: string;
  roleName: string;
  membershipStatus: string;
  userStatus: string;
}

/**
 * Provider directory management. Nonnis staff manage all providers; provider
 * users are bounded to their own organization by ProviderAccessService. No
 * matching, scoring, or ranking — only explicit CRUD, search and filtering.
 */
@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: ProviderAccessService,
  ) {}

  async list(user: RequestUser, query: ListProvidersQueryDto): Promise<PaginatedResult<ProviderSummaryView>> {
    const { page, pageSize, q, status, serviceCategoryId, state, city, postalCode, languageId, paymentTypeId, availability } = query;

    const and: Prisma.ProviderWhereInput[] = [this.access.listScope(user)];
    if (status) and.push({ status });
    if (q) {
      and.push({
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { organization: { name: { contains: q, mode: "insensitive" } } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (serviceCategoryId) and.push({ services: { some: { serviceCategoryId, active: true } } });
    if (languageId) and.push({ languages: { some: { languageId, active: true } } });
    if (paymentTypeId) and.push({ paymentTypes: { some: { paymentTypeId, active: true } } });
    if (availability) and.push({ capacity: { some: { status: availability } } });
    if (query.noServices) and.push({ services: { none: { active: true } } });
    if (query.noCoverage) and.push({ coverageAreas: { none: { active: true } } });
    if (state) and.push(this.geoFilter("state", state));
    if (city) and.push(this.geoFilter("city", city));
    if (postalCode) and.push(this.geoFilter("postalCode", postalCode));

    const where: Prisma.ProviderWhereInput = { AND: and };
    const orderBy = this.buildOrderBy(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.provider.findMany({
        where,
        include: providerListInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      items: rows.map((row) => toProviderSummaryView(row, canManageProvider(user, row))),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /** Match a provider column OR any of its coverage areas for a geographic term. */
  private geoFilter(field: "state" | "city" | "postalCode", value: string): Prisma.ProviderWhereInput {
    return {
      OR: [
        { [field]: { contains: value, mode: "insensitive" } },
        { coverageAreas: { some: { [field]: { contains: value, mode: "insensitive" }, active: true } } },
      ],
    };
  }

  private buildOrderBy(query: ListProvidersQueryDto): Prisma.ProviderOrderByWithRelationInput {
    const order = query.order ?? (query.sort === "updatedAt" ? "desc" : "asc");
    switch (query.sort) {
      case "updatedAt":
        return { updatedAt: order };
      case "status":
        return { status: order };
      case "name":
      default:
        return { displayName: order };
    }
  }

  async findOne(user: RequestUser, id: string): Promise<ProviderDetailView> {
    const ref = await this.access.loadForRead(user, id);
    const row = await this.prisma.provider.findUnique({ where: { id }, include: providerDetailInclude });
    if (!row) throw new NotFoundException(`Provider ${id} not found`);
    return toProviderDetailView(row, {
      editable: canManageProvider(user, ref),
      canManageCapacity: this.canManageCapacity(user, ref.organizationId),
      canViewInternal: canManageAllProviders(user),
    });
  }

  private canManageCapacity(user: RequestUser, organizationId: string): boolean {
    if (user.activePermissions.has(PERMISSIONS.PROVIDER_CAPACITY_MANAGE)) return true;
    return (
      user.activePermissions.has(PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN) &&
      user.memberships.some((m) => m.organizationId === organizationId)
    );
  }

  async create(user: RequestUser, dto: CreateProviderDto): Promise<ProviderDetailView> {
    const created = await this.prisma.$transaction(async (tx) => {
      let organizationId: string;

      if (dto.organizationId) {
        const org = await tx.organization.findUnique({
          where: { id: dto.organizationId },
          select: { id: true, type: true, provider: { select: { id: true } } },
        });
        if (!org) throw new BadRequestException("The specified organization does not exist.");
        if (org.type !== "PROVIDER") throw new BadRequestException("The organization is not a provider organization.");
        if (org.provider) throw new ConflictException("This organization already has a provider profile.");
        organizationId = org.id;
      } else if (dto.organizationName) {
        const org = await tx.organization.create({
          data: { type: "PROVIDER", name: dto.organizationName, status: "ACTIVE" },
          select: { id: true },
        });
        organizationId = org.id;
      } else {
        throw new BadRequestException("Provide either organizationId or organizationName.");
      }

      const provider = await tx.provider.create({
        data: {
          organizationId,
          displayName: dto.displayName,
          description: dto.description,
          phone: dto.phone,
          email: dto.email,
          website: dto.website,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country,
          timezone: dto.timezone,
          eligibilityNotes: dto.eligibilityNotes,
          internalNotes: dto.internalNotes,
          licenseNumber: dto.licenseNumber,
          licenseType: dto.licenseType,
        },
      });

      await this.audit.record(
        {
          action: "provider.created",
          entityType: "Provider",
          entityId: provider.id,
          organizationId,
          actorUserId: user.id,
          metadata: { displayName: provider.displayName },
        },
        tx,
      );
      return provider;
    });

    return this.findOne(user, created.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateProviderDto): Promise<ProviderDetailView> {
    const ref = await this.access.loadForWrite(user, id);
    // Internal notes are Nonnis-only: provider-org users can neither read nor write them.
    const internalNotes = canManageAllProviders(user) ? dto.internalNotes : undefined;
    await this.prisma.provider.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        timezone: dto.timezone,
        eligibilityNotes: dto.eligibilityNotes,
        internalNotes,
        licenseNumber: dto.licenseNumber,
        licenseType: dto.licenseType,
      },
    });
    await this.audit.record({
      action: "provider.updated",
      entityType: "Provider",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.findOne(user, id);
  }

  async setStatus(user: RequestUser, id: string, status: Prisma.ProviderUpdateInput["status"]): Promise<ProviderDetailView> {
    const ref = await this.access.loadForWrite(user, id);
    await this.prisma.provider.update({ where: { id }, data: { status } });
    await this.audit.record({
      action: "provider.status_changed",
      entityType: "Provider",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { status },
    });
    return this.findOne(user, id);
  }

  /** Provider organization users/memberships (read-only view; no duplicate user system). */
  async listUsers(user: RequestUser, id: string): Promise<ProviderUserView[]> {
    const ref = await this.access.loadForRead(user, id);
    // Only managers (Nonnis or the provider's own admins) may see the user list.
    if (!canManageProvider(user, ref) && !canManageAllProviders(user)) {
      throw new NotFoundException(`Provider ${id} not found`);
    }
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId: ref.organizationId },
      include: {
        user: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true, status: true } },
        role: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.displayName || `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || null,
      roleCode: m.role.code,
      roleName: m.role.name,
      membershipStatus: m.status,
      userStatus: m.user.status,
    }));
  }
}
