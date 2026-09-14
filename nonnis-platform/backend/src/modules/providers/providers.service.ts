import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { AuditService } from "../audit/audit.service";
import { MediaService, type UploadTicket } from "../content/media.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService, canManageAllProviders, canManageProvider } from "./provider-access";
import { publicListingMissing } from "./public-listing";
import {
  providerDetailInclude,
  providerListInclude,
  toProviderDetailView,
  toProviderSummaryView,
  type ProviderDetailView,
  type ProviderSummaryView,
} from "./providers.serializer";
import type {
  CreateProviderDto,
  ListProvidersQueryDto,
  ProviderUploadUrlDto,
  UpdatePublicListingDto,
  UpdateProviderDto,
} from "./dto/provider.dto";
import { ensureCaseAccess } from "../cases/case-access";
import { matchCoverage, type CoverageArea, type SeekerLocation } from "./coverage-matching";

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
    private readonly media: MediaService,
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

    // Where this case needs care, if the caller asked the question. Resolved
    // from the case's own service requests after re-checking they may read it.
    const caseLocation = query.caseId ? await this.caseLocation(user, query.caseId) : null;
    if (caseLocation && query.servesCaseOnly) {
      // Narrowed BEFORE paging, so page 2 is still only eligible providers.
      // Eligibility is a rule — a radius, a county, a postal-code list — not a
      // column comparison, so the candidates are resolved in memory. The set is
      // bounded by providers that have any coverage at all, which is the size of
      // the directory rather than of the database.
      and.push({ id: { in: await this.providersServing(caseLocation) } });
    }

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

    const serving = caseLocation ? await this.servingSet(caseLocation, rows.map((r) => r.id)) : null;

    return {
      items: rows.map((row) => ({
        ...toProviderSummaryView(row, canManageProvider(user, row)),
        // Null means the question was never asked, which is not the same as "no".
        servesCaseLocation: serving ? serving.has(row.id) : null,
      })),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Where a case needs care, from its service requests.
   *
   * `ensureCaseAccess` runs first: a case id in a query string is a question,
   * and a caller who may not read that case gets the same 404 they would get
   * anywhere else. The first request that names a place wins — a case with
   * several usually repeats the same destination.
   */
  private async caseLocation(user: RequestUser, caseId: string): Promise<SeekerLocation | null> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    const requests = await this.prisma.serviceRequest.findMany({
      where: { caseId, status: { not: "CANCELLED" } },
      select: { serviceCity: true, serviceState: true, servicePostalCode: true },
      orderBy: { createdAt: "asc" },
    });
    const named = requests.find((r) => r.serviceCity || r.serviceState || r.servicePostalCode);
    if (!named) return null;
    return {
      city: named.serviceCity,
      state: named.serviceState,
      postalCode: named.servicePostalCode,
    };
  }

  /** Coverage rows for the given providers, as the matcher expects them. */
  private async coverageFor(providerIds?: string[]): Promise<Map<string, CoverageArea[]>> {
    const rows = await this.prisma.providerCoverageArea.findMany({
      where: { active: true, ...(providerIds ? { providerId: { in: providerIds } } : {}) },
    });
    const byProvider = new Map<string, CoverageArea[]>();
    for (const row of rows) {
      const area: CoverageArea = {
        ...row,
        // Decimal is not a number until it is asked to be one.
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      };
      byProvider.set(row.providerId, [...(byProvider.get(row.providerId) ?? []), area]);
    }
    return byProvider;
  }

  /** Every provider whose coverage reaches this location. */
  private async providersServing(location: SeekerLocation): Promise<string[]> {
    const byProvider = await this.coverageFor();
    return [...byProvider.entries()]
      .filter(([, areas]) => matchCoverage(areas, location).eligible)
      .map(([providerId]) => providerId);
  }

  /** Which of these providers reach the location — for annotating one page. */
  private async servingSet(location: SeekerLocation, providerIds: string[]): Promise<Set<string>> {
    if (providerIds.length === 0) return new Set();
    const byProvider = await this.coverageFor(providerIds);
    return new Set(
      providerIds.filter((id) => matchCoverage(byProvider.get(id) ?? [], location).eligible),
    );
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

  // ---- Public residential directory listing (Nonnis-managed) ----------------

  /** Update the public listing configuration. Nonnis-only via the controller guard. */
  async updatePublicListing(user: RequestUser, id: string, dto: UpdatePublicListingDto): Promise<ProviderDetailView> {
    const ref = await this.access.loadForWrite(user, id);

    if (dto.publicSlug) {
      const clash = await this.prisma.provider.findFirst({
        where: { publicSlug: dto.publicSlug, id: { not: id } },
        select: { id: true },
      });
      if (clash) throw new ConflictException("That public URL slug is already in use by another provider.");
    }

    const current = await this.prisma.provider.findUnique({
      where: { id },
      select: { publicFeaturedImageStoragePath: true },
    });

    await this.prisma.provider.update({
      where: { id },
      data: {
        isResidentialProvider: dto.isResidentialProvider,
        publicSlug: dto.publicSlug,
        publicDescription: dto.publicDescription,
        publicFeaturedImageUrl: dto.publicFeaturedImageUrl,
        publicFeaturedImageStoragePath: dto.publicFeaturedImageStoragePath,
        publicSortOrder: dto.publicSortOrder,
      },
    });

    // Clean up a replaced managed image after the DB write succeeds.
    const previous = current?.publicFeaturedImageStoragePath ?? null;
    if (
      dto.publicFeaturedImageStoragePath !== undefined &&
      previous &&
      previous !== dto.publicFeaturedImageStoragePath
    ) {
      await this.media.deleteObject(previous);
    }

    await this.audit.record({
      action: "provider.public_listing_updated",
      entityType: "Provider",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.findOne(user, id);
  }

  /** Publish the provider to the public directory after validating the minimum profile. */
  async publish(user: RequestUser, id: string): Promise<ProviderDetailView> {
    const ref = await this.access.loadForWrite(user, id);
    const [provider, activeServicesCount] = await Promise.all([
      this.prisma.provider.findUnique({
        where: { id },
        select: { isResidentialProvider: true, status: true, displayName: true, publicSlug: true, city: true, state: true },
      }),
      this.prisma.providerService.count({ where: { providerId: id, active: true } }),
    ]);
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);

    const missing = publicListingMissing({ ...provider, activeServicesCount });
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        message: "This provider cannot be published yet.",
        missing,
      });
    }

    await this.prisma.provider.update({
      where: { id },
      data: { publicListingEnabled: true, publicPublishedAt: new Date() },
    });
    await this.audit.record({
      action: "provider.published",
      entityType: "Provider",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { slug: provider.publicSlug },
    });
    return this.findOne(user, id);
  }

  /** Remove the provider from the public directory. */
  async unpublish(user: RequestUser, id: string): Promise<ProviderDetailView> {
    const ref = await this.access.loadForWrite(user, id);
    await this.prisma.provider.update({ where: { id }, data: { publicListingEnabled: false } });
    await this.audit.record({
      action: "provider.unpublished",
      entityType: "Provider",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
    });
    return this.findOne(user, id);
  }

  /** Mint a signed direct-upload URL for a public provider image (Nonnis-only). */
  async createPublicImageTicket(user: RequestUser, id: string, dto: ProviderUploadUrlDto): Promise<UploadTicket> {
    await this.access.loadForWrite(user, id);
    return this.media.createUploadTicket("provider-public", dto.contentType, dto.sizeBytes);
  }

  /** Delete a managed public provider image object (external URLs are ignored). */
  async deletePublicImage(user: RequestUser, id: string, storagePath: string): Promise<{ ok: true }> {
    await this.access.loadForWrite(user, id);
    await this.media.deleteObject(storagePath);
    return { ok: true };
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
