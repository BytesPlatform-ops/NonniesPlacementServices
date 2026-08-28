import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { toCoverageAreaView, type CoverageAreaView } from "./providers.serializer";
import type { CreateCoverageAreaDto, UpdateCoverageAreaDto } from "./dto/provider-subresources.dto";

@Injectable()
export class ProviderCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: ProviderAccessService,
  ) {}

  async list(user: RequestUser, providerId: string): Promise<CoverageAreaView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerCoverageArea.findMany({
      where: { providerId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toCoverageAreaView);
  }

  async create(user: RequestUser, providerId: string, dto: CreateCoverageAreaDto): Promise<CoverageAreaView> {
    const ref = await this.access.loadForWrite(user, providerId);
    const created = await this.prisma.providerCoverageArea.create({
      data: {
        providerId,
        coverageType: dto.coverageType ?? "CITY",
        city: dto.city,
        county: dto.county,
        state: dto.state,
        postalCode: dto.postalCode,
        radiusMiles: dto.radiusMiles,
        notes: dto.notes,
        active: dto.active ?? true,
      },
    });
    await this.audit.record({
      action: "provider_coverage.added",
      entityType: "ProviderCoverageArea",
      entityId: created.id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return toCoverageAreaView(created);
  }

  async update(
    user: RequestUser,
    providerId: string,
    coverageId: string,
    dto: UpdateCoverageAreaDto,
  ): Promise<CoverageAreaView> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureBelongs(providerId, coverageId);
    const updated = await this.prisma.providerCoverageArea.update({
      where: { id: coverageId },
      data: {
        coverageType: dto.coverageType,
        city: dto.city,
        county: dto.county,
        state: dto.state,
        postalCode: dto.postalCode,
        radiusMiles: dto.radiusMiles,
        notes: dto.notes,
        active: dto.active,
      },
    });
    await this.audit.record({
      action: "provider_coverage.updated",
      entityType: "ProviderCoverageArea",
      entityId: coverageId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toCoverageAreaView(updated);
  }

  async remove(user: RequestUser, providerId: string, coverageId: string): Promise<{ id: string; removed: true }> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureBelongs(providerId, coverageId);
    await this.prisma.providerCoverageArea.delete({ where: { id: coverageId } });
    await this.audit.record({
      action: "provider_coverage.removed",
      entityType: "ProviderCoverageArea",
      entityId: coverageId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return { id: coverageId, removed: true };
  }

  private async ensureBelongs(providerId: string, coverageId: string): Promise<void> {
    const row = await this.prisma.providerCoverageArea.findUnique({
      where: { id: coverageId },
      select: { providerId: true },
    });
    if (!row || row.providerId !== providerId) {
      throw new NotFoundException(`Coverage area ${coverageId} not found`);
    }
  }
}
