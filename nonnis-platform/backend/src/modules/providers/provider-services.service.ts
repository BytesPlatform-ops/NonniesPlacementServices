import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { toProviderServiceView, type ProviderServiceView } from "./providers.serializer";
import type { CreateProviderServiceDto, UpdateProviderServiceDto } from "./dto/provider-subresources.dto";

const serviceInclude = { serviceCategory: { select: { id: true, code: true, name: true } } } as const;

@Injectable()
export class ProviderServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: ProviderAccessService,
  ) {}

  async list(user: RequestUser, providerId: string): Promise<ProviderServiceView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerService.findMany({
      where: { providerId },
      include: serviceInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toProviderServiceView);
  }

  async create(user: RequestUser, providerId: string, dto: CreateProviderServiceDto): Promise<ProviderServiceView> {
    const ref = await this.access.loadForWrite(user, providerId);
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.serviceCategoryId },
      select: { id: true, active: true },
    });
    if (!category) throw new BadRequestException("The specified service category does not exist.");

    const existing = await this.prisma.providerService.findUnique({
      where: { providerId_serviceCategoryId: { providerId, serviceCategoryId: dto.serviceCategoryId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("This provider already offers that service category.");

    const created = await this.prisma.providerService.create({
      data: {
        providerId,
        serviceCategoryId: dto.serviceCategoryId,
        description: dto.description,
        levelOfCare: dto.levelOfCare,
        active: dto.active ?? true,
      },
      include: serviceInclude,
    });
    await this.audit.record({
      action: "provider_service.added",
      entityType: "ProviderService",
      entityId: created.id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId, serviceCategoryId: dto.serviceCategoryId },
    });
    return toProviderServiceView(created);
  }

  async update(
    user: RequestUser,
    providerId: string,
    providerServiceId: string,
    dto: UpdateProviderServiceDto,
  ): Promise<ProviderServiceView> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureBelongs(providerId, providerServiceId);
    const updated = await this.prisma.providerService.update({
      where: { id: providerServiceId },
      data: { description: dto.description, levelOfCare: dto.levelOfCare, active: dto.active },
      include: serviceInclude,
    });
    await this.audit.record({
      action: "provider_service.updated",
      entityType: "ProviderService",
      entityId: providerServiceId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toProviderServiceView(updated);
  }

  async remove(user: RequestUser, providerId: string, providerServiceId: string): Promise<{ id: string; removed: true }> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureBelongs(providerId, providerServiceId);
    await this.prisma.providerService.delete({ where: { id: providerServiceId } });
    await this.audit.record({
      action: "provider_service.removed",
      entityType: "ProviderService",
      entityId: providerServiceId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return { id: providerServiceId, removed: true };
  }

  private async ensureBelongs(providerId: string, providerServiceId: string): Promise<void> {
    const row = await this.prisma.providerService.findUnique({
      where: { id: providerServiceId },
      select: { providerId: true },
    });
    if (!row || row.providerId !== providerId) {
      throw new NotFoundException(`Provider service ${providerServiceId} not found`);
    }
  }
}
