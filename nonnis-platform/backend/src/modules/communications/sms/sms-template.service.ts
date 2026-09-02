import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { SMS_TRANSPORT, type SmsTransport } from "../providers/sms-transport";
import { normalizePhoneE164 } from "../normalization";
import type { CreateSmsTemplateDto, ListSmsTemplatesDto, UpdateSmsTemplateDto } from "../dto/sms.dto";
import { SAMPLE_SMS_VALUES, renderSmsBody, validateSmsBody } from "./sms-merge";
import { calculateSegments, type SegmentInfo } from "./sms-segments";
import { smsReadiness, statusCallbackUrl } from "./sms-config";
import { toSmsTemplateDetail, toSmsTemplateSummary, type SmsTemplateDetail, type SmsTemplateSummary } from "./sms.serializer";

/** Test sends are a privileged relay — keep them strictly bounded per user. */
const TEST_SEND_LIMIT = 5;
const TEST_SEND_WINDOW_MS = 60_000;

export interface SmsPreview {
  renderedBody: string;
  segments: SegmentInfo;
}

@Injectable()
export class SmsTemplateService {
  private readonly testSends = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audit: AuditService,
    @Inject(SMS_TRANSPORT) private readonly transport: SmsTransport,
  ) {}

  /** Estimate for a stored/unsaved body using SAMPLE merge values. */
  preview(body: string): SmsPreview {
    const validated = validateSmsBody(body);
    const renderedBody = renderSmsBody(validated, SAMPLE_SMS_VALUES);
    return { renderedBody, segments: calculateSegments(renderedBody) };
  }

  private sampleSegments(body: string): SegmentInfo {
    return calculateSegments(renderSmsBody(body, SAMPLE_SMS_VALUES));
  }

  async list(query: ListSmsTemplatesDto): Promise<PaginatedResult<SmsTemplateSummary>> {
    const and: Prisma.CommunicationSmsTemplateWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    else and.push({ status: { not: "ARCHIVED" } });
    if (query.search) and.push({ name: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationSmsTemplateWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationSmsTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationSmsTemplate.count({ where }),
    ]);
    return {
      items: rows.map((t) => toSmsTemplateSummary(t, this.sampleSegments(t.body))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string): Promise<SmsTemplateDetail> {
    const t = await this.prisma.communicationSmsTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("SMS template not found");
    return toSmsTemplateDetail(t, this.sampleSegments(t.body));
  }

  async create(user: RequestUser, dto: CreateSmsTemplateDto): Promise<SmsTemplateDetail> {
    const body = validateSmsBody(dto.body);
    const created = await this.prisma.communicationSmsTemplate.create({
      data: { name: dto.name.trim(), description: dto.description?.trim() || null, body, status: "DRAFT", createdByUserId: user.id, updatedByUserId: user.id },
    });
    await this.audit.record({ action: "communication.sms_template.created", entityType: "CommunicationSmsTemplate", entityId: created.id, actorUserId: user.id, metadata: { name: created.name } });
    return toSmsTemplateDetail(created, this.sampleSegments(created.body));
  }

  async update(user: RequestUser, id: string, dto: UpdateSmsTemplateDto): Promise<SmsTemplateDetail> {
    const existing = await this.prisma.communicationSmsTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("SMS template not found");
    const data: Prisma.CommunicationSmsTemplateUpdateInput = { updatedByUserId: user.id };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.body !== undefined) data.body = validateSmsBody(dto.body);
    if (dto.status !== undefined) data.status = dto.status;
    const updated = await this.prisma.communicationSmsTemplate.update({ where: { id }, data });
    await this.audit.record({ action: "communication.sms_template.updated", entityType: "CommunicationSmsTemplate", entityId: id, actorUserId: user.id });
    return toSmsTemplateDetail(updated, this.sampleSegments(updated.body));
  }

  async archive(user: RequestUser, id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.communicationSmsTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("SMS template not found");
    await this.prisma.communicationSmsTemplate.update({ where: { id }, data: { status: "ARCHIVED", updatedByUserId: user.id } });
    await this.audit.record({ action: "communication.sms_template.archived", entityType: "CommunicationSmsTemplate", entityId: id, actorUserId: user.id });
    return { ok: true };
  }

  /**
   * Send a single test SMS through the SAME transport port as campaigns. Rate
   * limited per user so this can never become an unrestricted SMS relay.
   */
  async testSend(user: RequestUser, id: string, phone: string, bodyOverride?: string): Promise<{ ok: boolean; mock: boolean; message: string; segments: SegmentInfo; renderedBody: string }> {
    this.enforceTestRateLimit(user.id);

    const template = await this.prisma.communicationSmsTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("SMS template not found");

    const body = validateSmsBody(bodyOverride ?? template.body);
    const to = normalizePhoneE164(phone, "US");
    if (!to) throw new BadRequestException("Enter a valid phone number.");

    const readiness = smsReadiness(this.config, this.transport);
    if (!readiness.directReplyAllowed) throw new ForbiddenException(readiness.directReplyBlockedReason ?? "SMS provider is not fully configured.");

    const renderedBody = renderSmsBody(body, SAMPLE_SMS_VALUES);
    const segments = calculateSegments(renderedBody);

    const outcome = await this.transport.sendSms({
      internalMessageId: `test-${id}-${Date.now()}`,
      to,
      body: renderedBody,
      statusCallbackUrl: statusCallbackUrl(this.config),
      correlationMetadata: { kind: "test", templateId: id },
    });

    // Never log or audit the phone number or body — ids and outcome only.
    await this.audit.record({ action: "communication.sms_template.test_sent", entityType: "CommunicationSmsTemplate", entityId: id, actorUserId: user.id, metadata: { ok: outcome.ok, provider: this.transport.name } });

    if (!outcome.ok) {
      return { ok: false, mock: readiness.mockMode, message: outcome.message, segments, renderedBody };
    }
    return {
      ok: true,
      mock: readiness.mockMode,
      message: readiness.mockMode ? "Mock SMS processed — no external SMS delivered." : "Test SMS sent.",
      segments,
      renderedBody,
    };
  }

  private enforceTestRateLimit(userId: string): void {
    const now = Date.now();
    const recent = (this.testSends.get(userId) ?? []).filter((t) => now - t < TEST_SEND_WINDOW_MS);
    if (recent.length >= TEST_SEND_LIMIT) throw new BadRequestException("Too many test messages. Please wait a minute and try again.");
    recent.push(now);
    this.testSends.set(userId, recent);
  }
}
