import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { EMAIL_TRANSPORT, type EmailTransport } from "../providers/email-transport";
import { assertMergeTokensAllowed, validateDesign } from "./template-design";
import { compileDesign } from "./email-compiler";
import { generateThreadToken, resolveSender } from "./email-config";
import { CampaignAudienceService, type AudienceConfig, type AudienceEvaluation } from "./campaign-audience.service";
import {
  toCampaignDetail,
  toCampaignSummary,
  toRecipientView,
  type CampaignRecipientCounts,
  type EmailCampaignDetail,
  type EmailCampaignSummary,
  type EmailRecipientView,
} from "./email.serializer";
import type { AudienceDto, CreateCampaignDto, ListCampaignsDto, ListRecipientsDto, UpdateCampaignDto } from "../dto/email-campaign.dto";

const EDITABLE_STATUSES = new Set(["DRAFT"]);
const CANCELLABLE = new Set(["QUEUED", "SENDING"]);
const CHUNK = 1000;

@Injectable()
export class EmailCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audience: CampaignAudienceService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  private audienceConfig(a?: AudienceDto): AudienceConfig {
    return { listIds: a?.listIds ?? [], contactIds: a?.contactIds ?? [] };
  }

  async countsFor(campaignId: string): Promise<CampaignRecipientCounts> {
    const grouped = await this.prisma.communicationEmailCampaignRecipient.groupBy({ by: ["deliveryStatus"], where: { campaignId }, _count: { _all: true }, orderBy: { deliveryStatus: "asc" } });
    const map = new Map(grouped.map((g) => [g.deliveryStatus, g._count._all]));
    const g = (s: string) => map.get(s as never) ?? 0;
    return {
      total: [...map.values()].reduce((a, b) => a + b, 0),
      excluded: g("EXCLUDED"),
      queued: g("QUEUED"),
      processing: g("PROCESSING"),
      sent: g("SENT"),
      delivered: g("DELIVERED"),
      bounced: g("BOUNCED"),
      failed: g("FAILED"),
      unsubscribed: g("UNSUBSCRIBED"),
      cancelled: g("CANCELLED"),
      deliveryUnknown: g("DELIVERY_UNKNOWN"),
    };
  }

  async list(query: ListCampaignsDto): Promise<PaginatedResult<EmailCampaignSummary>> {
    const and: Prisma.CommunicationEmailCampaignWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.search) and.push({ name: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationEmailCampaignWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationEmailCampaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationEmailCampaign.count({ where }),
    ]);
    return { items: rows.map(toCampaignSummary), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string): Promise<EmailCampaignDetail> {
    const c = await this.prisma.communicationEmailCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Campaign not found");
    return toCampaignDetail(c, await this.countsFor(id));
  }

  async create(user: RequestUser, dto: CreateCampaignDto): Promise<EmailCampaignDetail> {
    const created = await this.prisma.communicationEmailCampaign.create({
      data: {
        name: dto.name.trim(),
        templateId: dto.templateId ?? null,
        subjectSnapshot: dto.subject?.trim() || null,
        preheaderSnapshot: dto.preheader?.trim() || null,
        senderName: dto.senderName?.trim() || null,
        audienceConfig: this.audienceConfig(dto.audience) as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "communication.email_campaign.created", entityType: "CommunicationEmailCampaign", entityId: created.id, actorUserId: user.id, metadata: { name: created.name } });
    return this.findOne(created.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateCampaignDto): Promise<EmailCampaignDetail> {
    const c = await this.prisma.communicationEmailCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Campaign not found");
    if (!EDITABLE_STATUSES.has(c.status)) throw new BadRequestException("Only draft campaigns can be edited.");
    const data: Prisma.CommunicationEmailCampaignUpdateInput = { updatedByUserId: user.id };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.templateId !== undefined) data.template = dto.templateId ? { connect: { id: dto.templateId } } : { disconnect: true };
    if (dto.subject !== undefined) data.subjectSnapshot = dto.subject.trim() || null;
    if (dto.preheader !== undefined) data.preheaderSnapshot = dto.preheader.trim() || null;
    if (dto.senderName !== undefined) data.senderName = dto.senderName.trim() || null;
    if (dto.audience !== undefined) data.audienceConfig = this.audienceConfig(dto.audience) as unknown as Prisma.InputJsonValue;
    await this.prisma.communicationEmailCampaign.update({ where: { id }, data });
    return this.findOne(id);
  }

  async audiencePreview(audience: AudienceDto): Promise<AudienceEvaluation> {
    const evaluation = await this.audience.evaluate(this.audienceConfig(audience));
    // Do not leak the full eligible list to the client — counts only.
    return { ...evaluation, eligible: [] };
  }

  /**
   * Queue a campaign: server-side revalidation + immutable snapshot + recipient
   * rows. The HTTP request itself never sends email — the dispatcher does.
   */
  async queue(user: RequestUser, id: string): Promise<EmailCampaignDetail> {
    const c = await this.prisma.communicationEmailCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Campaign not found");
    if (c.status !== "DRAFT") throw new BadRequestException("Only a draft campaign can be queued.");
    if (!this.transport.configured) throw new ForbiddenException("The email provider is not configured for sending.");
    if (!c.templateId) throw new BadRequestException("Choose an email template before sending.");
    if (!c.subjectSnapshot?.trim()) throw new BadRequestException("A subject is required before sending.");

    const template = await this.prisma.communicationEmailTemplate.findUnique({ where: { id: c.templateId } });
    if (!template) throw new BadRequestException("The selected template no longer exists.");

    // Recompile authoritatively with production media validation.
    const design = validateDesign(template.designJson, true);
    assertMergeTokensAllowed(design);
    const compiled = compileDesign(design, { preheader: c.preheaderSnapshot ?? undefined });
    const sender = resolveSender(this.config);

    const evaluation = await this.audience.evaluate(this.audienceConfig(c.audienceConfig as unknown as AudienceDto));
    if (evaluation.eligibleCount === 0) throw new BadRequestException("No eligible recipients. Everyone in the audience is excluded (no opted-in, non-suppressed email).");

    await this.prisma.$transaction(async (tx) => {
      // Atomically CLAIM the DRAFT -> QUEUED transition. A concurrent duplicate
      // request (double-click, browser retry) updates zero rows and rolls the whole
      // transaction back, so a campaign can never be snapshotted or queued twice.
      const claimed = await tx.communicationEmailCampaign.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          status: "QUEUED",
          queuedAt: new Date(),
          htmlSnapshot: compiled.html,
          textSnapshot: compiled.text,
          senderEmail: sender.email,
          senderName: c.senderName ?? sender.name,
          eligibleRecipientCount: evaluation.eligibleCount,
          excludedRecipientCount: evaluation.excludedCount,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count === 0) throw new BadRequestException("Only a draft campaign can be queued.");
      const now = new Date();
      for (let i = 0; i < evaluation.eligible.length; i += CHUNK) {
        const chunk = evaluation.eligible.slice(i, i + CHUNK);
        await tx.communicationEmailCampaignRecipient.createMany({
          data: chunk.map((e) => ({
            campaignId: id,
            contactId: e.contactId,
            emailSnapshot: e.email,
            firstNameSnapshot: e.firstName,
            lastNameSnapshot: e.lastName,
            organizationNameSnapshot: e.organizationName,
            deliveryStatus: "QUEUED" as const,
            internalMessageId: `${id}:${e.contactId}`,
            threadToken: generateThreadToken(),
            queuedAt: now,
          })),
          skipDuplicates: true,
        });
      }
    });

    await this.audit.record({ action: "communication.email_campaign.queued", entityType: "CommunicationEmailCampaign", entityId: id, actorUserId: user.id, metadata: { eligible: evaluation.eligibleCount, excluded: evaluation.excludedCount } });
    return this.findOne(id);
  }

  async cancel(user: RequestUser, id: string): Promise<EmailCampaignDetail> {
    const c = await this.prisma.communicationEmailCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Campaign not found");
    if (!CANCELLABLE.has(c.status)) throw new BadRequestException("Only a queued or sending campaign can be cancelled.");
    await this.prisma.$transaction([
      // Only not-yet-sent recipients can be cancelled; already-sent stay as-is.
      this.prisma.communicationEmailCampaignRecipient.updateMany({ where: { campaignId: id, deliveryStatus: "QUEUED" }, data: { deliveryStatus: "CANCELLED", cancelledAt: new Date() } }),
      this.prisma.communicationEmailCampaign.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), updatedByUserId: user.id } }),
    ]);
    await this.audit.record({ action: "communication.email_campaign.cancelled", entityType: "CommunicationEmailCampaign", entityId: id, actorUserId: user.id });
    return this.findOne(id);
  }

  async recipients(id: string, query: ListRecipientsDto): Promise<PaginatedResult<EmailRecipientView>> {
    const and: Prisma.CommunicationEmailCampaignRecipientWhereInput[] = [{ campaignId: id }];
    if (query.status) and.push({ deliveryStatus: query.status });
    if (query.search) and.push({ OR: [{ emailSnapshot: { contains: query.search.trim(), mode: "insensitive" } }, { firstNameSnapshot: { contains: query.search.trim(), mode: "insensitive" } }, { lastNameSnapshot: { contains: query.search.trim(), mode: "insensitive" } }] });
    const where: Prisma.CommunicationEmailCampaignRecipientWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationEmailCampaignRecipient.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationEmailCampaignRecipient.count({ where }),
    ]);
    return { items: rows.map(toRecipientView), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }
}
