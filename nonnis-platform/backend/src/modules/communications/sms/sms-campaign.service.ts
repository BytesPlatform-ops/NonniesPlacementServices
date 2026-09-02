import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type SmsEncoding } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { SMS_TRANSPORT, type SmsTransport } from "../providers/sms-transport";
import { CampaignAudienceService, type AudienceConfig, type EligibleSmsContact, type SmsAudienceEvaluation } from "../email/campaign-audience.service";
import type { AudienceDto } from "../dto/email-campaign.dto";
import type { CreateSmsCampaignDto, ListSmsCampaignsDto, ListSmsRecipientsDto, UpdateSmsCampaignDto } from "../dto/sms.dto";
import { renderSmsBody, validateSmsBody } from "./sms-merge";
import { calculateSegments } from "./sms-segments";
import { smsReadiness } from "./sms-config";
import {
  toSmsCampaignDetail,
  toSmsCampaignSummary,
  toSmsRecipientView,
  type SmsCampaignDetail,
  type SmsCampaignSummary,
  type SmsRecipientCounts,
  type SmsRecipientView,
} from "./sms.serializer";

const EDITABLE_STATUSES = new Set(["DRAFT", "READY"]);

/** Aggregate segment estimate across a rendered audience. */
export interface SmsSegmentSummary {
  estimatedSegmentCount: number;
  gsm7RecipientCount: number;
  ucs2RecipientCount: number;
  multiSegmentCount: number;
  longestBodyChars: number;
}

export interface RenderedSmsRecipient extends EligibleSmsContact {
  renderedBody: string;
  encoding: SmsEncoding;
  segmentCount: number;
}

export interface SmsAudiencePreview extends Omit<SmsAudienceEvaluation, "eligible"> {
  summary: SmsSegmentSummary;
  sampleBody: string | null;
}

@Injectable()
export class SmsCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audience: CampaignAudienceService,
    private readonly audit: AuditService,
    @Inject(SMS_TRANSPORT) private readonly transport: SmsTransport,
  ) {}

  private audienceConfig(dto?: AudienceDto): AudienceConfig {
    return { listIds: dto?.listIds ?? [], contactIds: dto?.contactIds ?? [] };
  }

  /**
   * Render the message PER RECIPIENT — `{{firstName}}` can change both the encoding
   * and the segment count from one contact to the next, so a single template-level
   * estimate would be wrong.
   */
  renderRecipients(body: string, eligible: EligibleSmsContact[]): { recipients: RenderedSmsRecipient[]; summary: SmsSegmentSummary } {
    const recipients: RenderedSmsRecipient[] = [];
    const summary: SmsSegmentSummary = { estimatedSegmentCount: 0, gsm7RecipientCount: 0, ucs2RecipientCount: 0, multiSegmentCount: 0, longestBodyChars: 0 };
    for (const contact of eligible) {
      const renderedBody = renderSmsBody(body, { firstName: contact.firstName, lastName: contact.lastName, organizationName: contact.organizationName });
      const info = calculateSegments(renderedBody);
      recipients.push({ ...contact, renderedBody, encoding: info.encoding as SmsEncoding, segmentCount: info.segmentCount });
      summary.estimatedSegmentCount += info.segmentCount;
      if (info.encoding === "GSM7") summary.gsm7RecipientCount += 1;
      else summary.ucs2RecipientCount += 1;
      if (info.multiSegment) summary.multiSegmentCount += 1;
      summary.longestBodyChars = Math.max(summary.longestBodyChars, info.characterCount);
    }
    return { recipients, summary };
  }

  /** Resolve the message body for a campaign: explicit body wins, else the template. */
  private async resolveBody(templateId?: string | null, body?: string | null): Promise<string> {
    if (body && body.trim()) return validateSmsBody(body);
    if (templateId) {
      const t = await this.prisma.communicationSmsTemplate.findUnique({ where: { id: templateId }, select: { body: true } });
      if (!t) throw new NotFoundException("SMS template not found");
      return validateSmsBody(t.body);
    }
    throw new BadRequestException("Choose an SMS template or enter a message before sending.");
  }

  // --- read -----------------------------------------------------------------
  async list(query: ListSmsCampaignsDto): Promise<PaginatedResult<SmsCampaignSummary>> {
    const and: Prisma.CommunicationSmsCampaignWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.search) and.push({ name: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationSmsCampaignWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationSmsCampaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationSmsCampaign.count({ where }),
    ]);
    return { items: rows.map(toSmsCampaignSummary), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string): Promise<SmsCampaignDetail> {
    const c = await this.prisma.communicationSmsCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("SMS campaign not found");
    return toSmsCampaignDetail(c, await this.countsFor(id));
  }

  async countsFor(campaignId: string): Promise<SmsRecipientCounts> {
    const grouped = await this.prisma.communicationSmsCampaignRecipient.groupBy({ by: ["deliveryStatus"], where: { campaignId }, _count: { _all: true }, orderBy: { deliveryStatus: "asc" } });
    const map = new Map(grouped.map((g) => [g.deliveryStatus, g._count._all]));
    const g = (s: string) => map.get(s as never) ?? 0;
    return {
      total: [...map.values()].reduce((a, b) => a + b, 0),
      excluded: g("EXCLUDED"),
      queued: g("QUEUED"),
      processing: g("PROCESSING"),
      accepted: g("ACCEPTED"),
      sent: g("SENT"),
      delivered: g("DELIVERED"),
      undelivered: g("UNDELIVERED"),
      failed: g("FAILED"),
      cancelled: g("CANCELLED"),
      deliveryUnknown: g("DELIVERY_UNKNOWN"),
    };
  }

  async recipients(campaignId: string, query: ListSmsRecipientsDto): Promise<PaginatedResult<SmsRecipientView>> {
    const and: Prisma.CommunicationSmsCampaignRecipientWhereInput[] = [{ campaignId }];
    if (query.status) and.push({ deliveryStatus: query.status });
    if (query.search) {
      const s = query.search.trim();
      and.push({ OR: [{ phoneSnapshot: { contains: s, mode: "insensitive" } }, { firstNameSnapshot: { contains: s, mode: "insensitive" } }, { lastNameSnapshot: { contains: s, mode: "insensitive" } }] });
    }
    const where: Prisma.CommunicationSmsCampaignRecipientWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationSmsCampaignRecipient.findMany({ where, orderBy: { createdAt: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationSmsCampaignRecipient.count({ where }),
    ]);
    return { items: rows.map(toSmsRecipientView), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  /** Counts + segment estimate only — the eligible contact list never leaves the server. */
  async audiencePreview(audience: AudienceDto, templateId?: string, body?: string): Promise<SmsAudiencePreview> {
    const resolved = await this.resolveBody(templateId ?? null, body ?? null);
    const evaluation = await this.audience.evaluateSms(this.audienceConfig(audience));
    const { summary } = this.renderRecipients(resolved, evaluation.eligible);
    // Counts only — the eligible contact list never leaves the server.
    const counts = { totalUnique: evaluation.totalUnique, duplicatesRemoved: evaluation.duplicatesRemoved, eligibleCount: evaluation.eligibleCount, excludedCount: evaluation.excludedCount, exclusions: evaluation.exclusions };
    const sample = evaluation.eligible[0];
    return {
      ...counts,
      summary,
      sampleBody: sample ? renderSmsBody(resolved, { firstName: sample.firstName, lastName: sample.lastName, organizationName: sample.organizationName }) : null,
    };
  }

  // --- write ----------------------------------------------------------------
  async create(user: RequestUser, dto: CreateSmsCampaignDto): Promise<SmsCampaignDetail> {
    const created = await this.prisma.communicationSmsCampaign.create({
      data: {
        name: dto.name.trim(),
        templateId: dto.templateId ?? null,
        bodySnapshot: dto.body?.trim() || null,
        audienceConfig: this.audienceConfig(dto.audience) as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "communication.sms_campaign.created", entityType: "CommunicationSmsCampaign", entityId: created.id, actorUserId: user.id, metadata: { name: created.name } });
    return this.findOne(created.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateSmsCampaignDto): Promise<SmsCampaignDetail> {
    const c = await this.prisma.communicationSmsCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("SMS campaign not found");
    if (!EDITABLE_STATUSES.has(c.status)) throw new BadRequestException("Only a draft campaign can be edited.");
    const data: Prisma.CommunicationSmsCampaignUpdateInput = { updatedByUserId: user.id };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.templateId !== undefined) data.template = dto.templateId ? { connect: { id: dto.templateId } } : { disconnect: true };
    if (dto.body !== undefined) data.bodySnapshot = dto.body.trim() || null;
    if (dto.audience !== undefined) data.audienceConfig = this.audienceConfig(dto.audience) as unknown as Prisma.InputJsonValue;
    await this.prisma.communicationSmsCampaign.update({ where: { id }, data });
    return this.findOne(id);
  }

  /**
   * Queue a campaign: server-side revalidation + immutable per-recipient snapshots.
   * The HTTP request itself never sends SMS — the dispatcher does.
   */
  async queue(user: RequestUser, id: string): Promise<SmsCampaignDetail> {
    const c = await this.prisma.communicationSmsCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("SMS campaign not found");
    if (c.status !== "DRAFT" && c.status !== "READY") throw new BadRequestException("Only a draft campaign can be queued.");

    // Live-provider readiness gate (mock mode always passes).
    const readiness = smsReadiness(this.config, this.transport);
    if (!readiness.campaignSendingAllowed) throw new ForbiddenException(readiness.campaignBlockedReason ?? "SMS sending is not available.");

    // Rebuild everything server-side — the frontend preview is never trusted.
    const body = await this.resolveBody(c.templateId, c.bodySnapshot);
    const audience = c.audienceConfig as unknown as AudienceConfig;
    const evaluation = await this.audience.evaluateSms({ listIds: audience?.listIds ?? [], contactIds: audience?.contactIds ?? [] });
    if (evaluation.eligibleCount === 0) throw new BadRequestException("No eligible recipients — nothing would be sent.");

    const { recipients, summary } = this.renderRecipients(body, evaluation.eligible);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Atomically CLAIM the DRAFT -> QUEUED transition — see the email campaign
      // service. A concurrent duplicate request rolls back instead of double-queueing.
      const claimed = await tx.communicationSmsCampaign.updateMany({
        where: { id, status: { in: ["DRAFT", "READY"] } },
        data: {
          status: "QUEUED",
          bodySnapshot: body,
          queuedAt: now,
          eligibleRecipientCount: evaluation.eligibleCount,
          excludedRecipientCount: evaluation.excludedCount,
          estimatedSegmentCount: summary.estimatedSegmentCount,
          gsm7RecipientCount: summary.gsm7RecipientCount,
          ucs2RecipientCount: summary.ucs2RecipientCount,
          multiSegmentCount: summary.multiSegmentCount,
          longestBodyChars: summary.longestBodyChars,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count === 0) throw new BadRequestException("Only a draft campaign can be queued.");
      await tx.communicationSmsCampaignRecipient.createMany({
        skipDuplicates: true,
        data: recipients.map((r) => ({
          campaignId: id,
          contactId: r.contactId,
          phoneSnapshot: r.normalizedPhoneE164,
          firstNameSnapshot: r.firstName,
          lastNameSnapshot: r.lastName,
          organizationNameSnapshot: r.organizationName,
          bodySnapshot: r.renderedBody,
          encodingSnapshot: r.encoding,
          estimatedSegmentCount: r.segmentCount,
          internalMessageId: `${id}:${r.contactId}`,
          deliveryStatus: "QUEUED" as const,
          queuedAt: now,
        })),
      });
    });

    await this.audit.record({
      action: "communication.sms_campaign.queued",
      entityType: "CommunicationSmsCampaign",
      entityId: id,
      actorUserId: user.id,
      metadata: { eligible: evaluation.eligibleCount, excluded: evaluation.excludedCount, estimatedSegments: summary.estimatedSegmentCount },
    });
    return this.findOne(id);
  }

  /** Cancel remaining unsent work. Messages already handed to the provider stand. */
  async cancel(user: RequestUser, id: string): Promise<SmsCampaignDetail> {
    const c = await this.prisma.communicationSmsCampaign.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!c) throw new NotFoundException("SMS campaign not found");
    if (c.status !== "QUEUED" && c.status !== "SENDING") throw new BadRequestException("Only a queued or sending campaign can be cancelled.");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.communicationSmsCampaignRecipient.updateMany({ where: { campaignId: id, deliveryStatus: "QUEUED" }, data: { deliveryStatus: "CANCELLED", cancelledAt: now, exclusionReason: "CAMPAIGN_CANCELLED" } }),
      this.prisma.communicationSmsCampaign.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: now, updatedByUserId: user.id } }),
    ]);
    await this.audit.record({ action: "communication.sms_campaign.cancelled", entityType: "CommunicationSmsCampaign", entityId: id, actorUserId: user.id });
    return this.findOne(id);
  }
}
