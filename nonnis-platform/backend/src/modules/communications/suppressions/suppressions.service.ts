import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CommunicationChannel } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { normalizeEmail, normalizePhoneE164 } from "../normalization";
import type { CreateSuppressionDto, ListSuppressionsQueryDto } from "../dto/suppressions.dto";

export interface SuppressionView {
  id: string;
  channel: CommunicationChannel;
  address: string;
  reason: string;
  active: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

function toView(row: {
  id: string;
  channel: CommunicationChannel;
  normalizedAddress: string;
  reason: string;
  active: boolean;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SuppressionView {
  return {
    id: row.id,
    channel: row.channel,
    address: row.normalizedAddress,
    reason: row.reason,
    active: row.active,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SuppressionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Normalize an address for its channel (email = lowercase; sms = E.164). */
  normalizeAddress(channel: CommunicationChannel, address: string): string | null {
    if (channel === "EMAIL") {
      const t = address.trim();
      return t ? normalizeEmail(t) : null;
    }
    return normalizePhoneE164(address, "US");
  }

  async list(query: ListSuppressionsQueryDto): Promise<PaginatedResult<SuppressionView>> {
    const and: Prisma.CommunicationSuppressionWhereInput[] = [];
    if (query.channel) and.push({ channel: query.channel });
    if (query.search) and.push({ normalizedAddress: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationSuppressionWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationSuppression.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.communicationSuppression.count({ where }),
    ]);
    return {
      items: rows.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  /** Upsert a suppression (reactivating an inactive one) — never duplicate rows. */
  async create(user: RequestUser, dto: CreateSuppressionDto): Promise<SuppressionView> {
    const normalized = this.normalizeAddress(dto.channel, dto.address);
    if (!normalized) throw new BadRequestException(`Invalid ${dto.channel === "EMAIL" ? "email" : "phone"} address.`);

    const row = await this.prisma.communicationSuppression.upsert({
      where: { channel_normalizedAddress: { channel: dto.channel, normalizedAddress: normalized } },
      create: { channel: dto.channel, normalizedAddress: normalized, reason: dto.reason, source: dto.source, active: true, createdByUserId: user.id },
      update: { reason: dto.reason, source: dto.source, active: true },
    });
    await this.audit.record({
      action: "communication.suppression.added",
      entityType: "CommunicationSuppression",
      entityId: row.id,
      actorUserId: user.id,
      metadata: { channel: dto.channel, reason: dto.reason },
    });
    return toView(row);
  }

  /** Deactivate a suppression (re-enables future sending) — audited. */
  async deactivate(user: RequestUser, id: string): Promise<SuppressionView> {
    const existing = await this.prisma.communicationSuppression.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Suppression not found");
    const row = await this.prisma.communicationSuppression.update({ where: { id }, data: { active: false } });
    await this.audit.record({
      action: "communication.suppression.removed",
      entityType: "CommunicationSuppression",
      entityId: id,
      actorUserId: user.id,
      metadata: { channel: existing.channel },
    });
    return toView(row);
  }

  /** Active-suppression flags for a batch of normalized addresses (no N+1). */
  async flagsFor(emails: string[], phones: string[]): Promise<{ emails: Set<string>; phones: Set<string> }> {
    const uniqEmails = [...new Set(emails.filter(Boolean))];
    const uniqPhones = [...new Set(phones.filter(Boolean))];
    if (uniqEmails.length === 0 && uniqPhones.length === 0) return { emails: new Set(), phones: new Set() };
    const rows = await this.prisma.communicationSuppression.findMany({
      where: {
        active: true,
        OR: [
          { channel: "EMAIL", normalizedAddress: { in: uniqEmails } },
          { channel: "SMS", normalizedAddress: { in: uniqPhones } },
        ],
      },
      select: { channel: true, normalizedAddress: true },
    });
    const eSet = new Set<string>();
    const pSet = new Set<string>();
    for (const r of rows) (r.channel === "EMAIL" ? eSet : pSet).add(r.normalizedAddress);
    return { emails: eSet, phones: pSet };
  }
}
