import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { toProviderCapacityView, type ProviderCapacityView } from "./providers.serializer";
import type { SetCapacityDto } from "./dto/provider-subresources.dto";

const capacityInclude = {
  serviceCategory: { select: { id: true, code: true, name: true } },
  updatedBy: { select: { id: true, displayName: true, firstName: true, lastName: true, email: true } },
} as const;

/**
 * Current provider capacity/availability. Updates overwrite the row for a given
 * (provider, category) pair; history is captured via AuditEvent. No forecasting,
 * scheduling, synchronization, or analytics.
 */
@Injectable()
export class ProviderCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: ProviderAccessService,
  ) {}

  async list(user: RequestUser, providerId: string): Promise<ProviderCapacityView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerCapacity.findMany({
      where: { providerId },
      include: capacityInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toProviderCapacityView);
  }

  async set(user: RequestUser, providerId: string, dto: SetCapacityDto): Promise<ProviderCapacityView> {
    const ref = await this.access.loadForCapacityWrite(user, providerId);
    const serviceCategoryId = dto.serviceCategoryId ?? null;
    if (serviceCategoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: serviceCategoryId },
        select: { id: true },
      });
      if (!category) throw new BadRequestException("The specified service category does not exist.");
    }

    const effectiveDate = dto.effectiveDate ? new Date(`${dto.effectiveDate}T00:00:00.000Z`) : null;
    const existing = await this.prisma.providerCapacity.findFirst({
      where: { providerId, serviceCategoryId },
      select: { id: true },
    });

    const data = {
      status: dto.status,
      availableCount: dto.availableCount ?? null,
      effectiveDate,
      notes: dto.notes ?? null,
      updatedByUserId: user.id,
    };

    const row = existing
      ? await this.prisma.providerCapacity.update({ where: { id: existing.id }, data, include: capacityInclude })
      : await this.prisma.providerCapacity.create({
          data: { providerId, serviceCategoryId, ...data },
          include: capacityInclude,
        });

    await this.audit.record({
      action: "provider_capacity.changed",
      entityType: "ProviderCapacity",
      entityId: row.id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId, serviceCategoryId, status: dto.status, availableCount: dto.availableCount ?? null },
    });
    return toProviderCapacityView(row);
  }

  async remove(user: RequestUser, providerId: string, capacityId: string): Promise<{ id: string; removed: true }> {
    const ref = await this.access.loadForCapacityWrite(user, providerId);
    const row = await this.prisma.providerCapacity.findUnique({
      where: { id: capacityId },
      select: { providerId: true },
    });
    if (!row || row.providerId !== providerId) throw new NotFoundException(`Capacity ${capacityId} not found`);
    await this.prisma.providerCapacity.delete({ where: { id: capacityId } });
    await this.audit.record({
      action: "provider_capacity.removed",
      entityType: "ProviderCapacity",
      entityId: capacityId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return { id: capacityId, removed: true };
  }
}
