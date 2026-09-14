import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { toCoverageAreaView, type CoverageAreaView } from "./providers.serializer";
import {
  overlappingPairs,
  stateCoverage,
  summarizeCoverage,
  type CoverageSummary,
  type StateCoverage,
} from "./coverage-matching";
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
        ...this.geoFields(dto),
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
        ...(dto.coverageType !== undefined ? { coverageType: dto.coverageType } : {}),
        ...this.geoFields(dto),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
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

  /**
   * The hierarchy fields, normalised once for both create and update.
   *
   * Postal codes are trimmed, upper-cased and de-duplicated here rather than at
   * the call sites, so a code entered as " 60601 " matches one stored as
   * "60601". A coordinate is written only when BOTH halves are present — half a
   * point is not a location.
   */
  private geoFields(dto: CreateCoverageAreaDto | UpdateCoverageAreaDto) {
    const codes = dto.postalCodes
      ?.map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0);
    const hasPoint = dto.latitude !== undefined && dto.longitude !== undefined;
    return {
      ...(dto.country !== undefined ? { country: dto.country.trim().toUpperCase() } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.county !== undefined ? { county: dto.county } : {}),
      ...(dto.state !== undefined ? { state: dto.state?.trim().toUpperCase() } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
      ...(codes !== undefined ? { postalCodes: [...new Set(codes)] } : {}),
      ...(dto.street !== undefined ? { street: dto.street } : {}),
      ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
      ...(hasPoint ? { latitude: dto.latitude, longitude: dto.longitude } : {}),
      ...(dto.radiusMiles !== undefined ? { radiusMiles: dto.radiusMiles } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
  }

  /**
   * Counts, per-state status and detected overlaps for one provider.
   *
   * Derived from the rows on every read rather than stored, so it can never
   * disagree with the areas it describes.
   */
  async summary(
    user: RequestUser,
    providerId: string,
  ): Promise<{
    summary: CoverageSummary;
    states: Array<{ state: string; status: StateCoverage; areaCount: number }>;
    overlaps: Array<[string, string]>;
  }> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerCoverageArea.findMany({ where: { providerId } });
    const areas = rows.map(toCoverageAreaView);
    const status = stateCoverage(areas);
    const counts = new Map<string, number>();
    for (const area of areas) {
      if (!area.active || !area.state) continue;
      counts.set(area.state, (counts.get(area.state) ?? 0) + 1);
    }
    return {
      summary: summarizeCoverage(areas),
      states: [...status.entries()]
        .map(([state, s]) => ({ state, status: s, areaCount: counts.get(state) ?? 0 }))
        .sort((a, b) => a.state.localeCompare(b.state)),
      overlaps: overlappingPairs(areas),
    };
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
