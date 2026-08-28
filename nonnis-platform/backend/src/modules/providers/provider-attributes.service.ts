import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import {
  toProviderHoursView,
  toProviderLanguageView,
  toProviderPaymentTypeView,
  type ProviderHoursView,
  type ProviderLanguageView,
  type ProviderPaymentTypeView,
} from "./providers.serializer";
import type {
  CreateProviderLanguageDto,
  CreateProviderPaymentTypeDto,
  SetHoursDto,
  UpdateProviderLanguageDto,
  UpdateProviderPaymentTypeDto,
} from "./dto/provider-subresources.dto";

const paymentInclude = { paymentType: { select: { id: true, code: true, name: true } } } as const;
const languageInclude = { language: { select: { id: true, code: true, name: true } } } as const;

@Injectable()
export class ProviderAttributesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: ProviderAccessService,
  ) {}

  // ---- Payment types ----

  async listPaymentTypes(user: RequestUser, providerId: string): Promise<ProviderPaymentTypeView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerPaymentType.findMany({
      where: { providerId },
      include: paymentInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toProviderPaymentTypeView);
  }

  async addPaymentType(
    user: RequestUser,
    providerId: string,
    dto: CreateProviderPaymentTypeDto,
  ): Promise<ProviderPaymentTypeView> {
    const ref = await this.access.loadForWrite(user, providerId);
    const pt = await this.prisma.paymentType.findUnique({ where: { id: dto.paymentTypeId }, select: { id: true } });
    if (!pt) throw new BadRequestException("The specified payment type does not exist.");
    const existing = await this.prisma.providerPaymentType.findUnique({
      where: { providerId_paymentTypeId: { providerId, paymentTypeId: dto.paymentTypeId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("This provider already accepts that payment type.");
    const created = await this.prisma.providerPaymentType.create({
      data: { providerId, paymentTypeId: dto.paymentTypeId, notes: dto.notes, active: dto.active ?? true },
      include: paymentInclude,
    });
    await this.audit.record({
      action: "provider_payment_type.added",
      entityType: "ProviderPaymentType",
      entityId: created.id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId, paymentTypeId: dto.paymentTypeId },
    });
    return toProviderPaymentTypeView(created);
  }

  async updatePaymentType(
    user: RequestUser,
    providerId: string,
    id: string,
    dto: UpdateProviderPaymentTypeDto,
  ): Promise<ProviderPaymentTypeView> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensurePaymentBelongs(providerId, id);
    const updated = await this.prisma.providerPaymentType.update({
      where: { id },
      data: { notes: dto.notes, active: dto.active },
      include: paymentInclude,
    });
    await this.audit.record({
      action: "provider_payment_type.updated",
      entityType: "ProviderPaymentType",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toProviderPaymentTypeView(updated);
  }

  async removePaymentType(user: RequestUser, providerId: string, id: string): Promise<{ id: string; removed: true }> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensurePaymentBelongs(providerId, id);
    await this.prisma.providerPaymentType.delete({ where: { id } });
    await this.audit.record({
      action: "provider_payment_type.removed",
      entityType: "ProviderPaymentType",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return { id, removed: true };
  }

  // ---- Languages ----

  async listLanguages(user: RequestUser, providerId: string): Promise<ProviderLanguageView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerLanguage.findMany({
      where: { providerId },
      include: languageInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toProviderLanguageView);
  }

  async addLanguage(
    user: RequestUser,
    providerId: string,
    dto: CreateProviderLanguageDto,
  ): Promise<ProviderLanguageView> {
    const ref = await this.access.loadForWrite(user, providerId);
    const lang = await this.prisma.language.findUnique({ where: { id: dto.languageId }, select: { id: true } });
    if (!lang) throw new BadRequestException("The specified language does not exist.");
    const existing = await this.prisma.providerLanguage.findUnique({
      where: { providerId_languageId: { providerId, languageId: dto.languageId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("This provider already supports that language.");
    const created = await this.prisma.providerLanguage.create({
      data: { providerId, languageId: dto.languageId, active: dto.active ?? true },
      include: languageInclude,
    });
    await this.audit.record({
      action: "provider_language.added",
      entityType: "ProviderLanguage",
      entityId: created.id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId, languageId: dto.languageId },
    });
    return toProviderLanguageView(created);
  }

  async setLanguageActive(
    user: RequestUser,
    providerId: string,
    id: string,
    dto: UpdateProviderLanguageDto,
  ): Promise<ProviderLanguageView> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureLanguageBelongs(providerId, id);
    const updated = await this.prisma.providerLanguage.update({
      where: { id },
      data: { active: dto.active },
      include: languageInclude,
    });
    await this.audit.record({
      action: "provider_language.updated",
      entityType: "ProviderLanguage",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { active: dto.active },
    });
    return toProviderLanguageView(updated);
  }

  async removeLanguage(user: RequestUser, providerId: string, id: string): Promise<{ id: string; removed: true }> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.ensureLanguageBelongs(providerId, id);
    await this.prisma.providerLanguage.delete({ where: { id } });
    await this.audit.record({
      action: "provider_language.removed",
      entityType: "ProviderLanguage",
      entityId: id,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { providerId },
    });
    return { id, removed: true };
  }

  // ---- Hours ----

  async listHours(user: RequestUser, providerId: string): Promise<ProviderHoursView[]> {
    await this.access.loadForRead(user, providerId);
    const rows = await this.prisma.providerHours.findMany({ where: { providerId }, orderBy: { dayOfWeek: "asc" } });
    return rows.map(toProviderHoursView);
  }

  /** Replace the weekly hours in one transaction (upsert per provided weekday). */
  async setHours(user: RequestUser, providerId: string, dto: SetHoursDto): Promise<ProviderHoursView[]> {
    const ref = await this.access.loadForWrite(user, providerId);
    await this.prisma.$transaction(
      dto.hours.map((h) =>
        this.prisma.providerHours.upsert({
          where: { providerId_dayOfWeek: { providerId, dayOfWeek: h.dayOfWeek } },
          update: {
            closed: h.closed ?? false,
            open24: h.open24 ?? false,
            opensAt: h.closed || h.open24 ? null : (h.opensAt ?? null),
            closesAt: h.closed || h.open24 ? null : (h.closesAt ?? null),
            notes: h.notes ?? null,
          },
          create: {
            providerId,
            dayOfWeek: h.dayOfWeek,
            closed: h.closed ?? false,
            open24: h.open24 ?? false,
            opensAt: h.closed || h.open24 ? null : (h.opensAt ?? null),
            closesAt: h.closed || h.open24 ? null : (h.closesAt ?? null),
            notes: h.notes ?? null,
          },
        }),
      ),
    );
    await this.audit.record({
      action: "provider_hours.updated",
      entityType: "Provider",
      entityId: providerId,
      organizationId: ref.organizationId,
      actorUserId: user.id,
      metadata: { days: dto.hours.map((h) => h.dayOfWeek) },
    });
    return this.listHours(user, providerId);
  }

  private async ensurePaymentBelongs(providerId: string, id: string): Promise<void> {
    const row = await this.prisma.providerPaymentType.findUnique({ where: { id }, select: { providerId: true } });
    if (!row || row.providerId !== providerId) throw new NotFoundException(`Provider payment type ${id} not found`);
  }

  private async ensureLanguageBelongs(providerId: string, id: string): Promise<void> {
    const row = await this.prisma.providerLanguage.findUnique({ where: { id }, select: { providerId: true } });
    if (!row || row.providerId !== providerId) throw new NotFoundException(`Provider language ${id} not found`);
  }
}
