import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { PaginatedResult } from "../../../common/types/api-response";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { EMAIL_TRANSPORT, type EmailTransport, type OutboundEmailAttachment } from "../providers/email-transport";
import { AttachmentStorageService } from "./attachment-storage.service";
import { buildAttachmentPath, validateAttachment } from "./attachment-policy";
import { designWithAttachments, readTemplateAttachments, validateTemplateAttachments, type TemplateAttachment } from "./template-attachments";
import { assertMergeTokensAllowed, validateDesign } from "./template-design";
import { compileDesign, renderForRecipient } from "./email-compiler";
import { publicSiteUrl, resolveSender } from "./email-config";
import {
  toTemplateDetail,
  toTemplateSummary,
  type EmailTemplateDetail,
  type EmailTemplateSummary,
} from "./email.serializer";
import type { CreateEmailTemplateDto, ListEmailTemplatesDto, PreviewDesignDto, TestSendDto, UpdateEmailTemplateDto } from "../dto/email-template.dto";

/** Simple in-memory per-user rate limit for test sends (not a spam relay). */
const testSendLog = new Map<string, number[]>();
const TEST_SEND_WINDOW_MS = 60_000;
const TEST_SEND_MAX = 10;

@Injectable()
export class EmailTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly storage: AttachmentStorageService,
  ) {}

  // --- attachments -----------------------------------------------------------

  /** Validates a file and returns a short-lived signed URL the browser uploads it to. */
  async createAttachmentUploadUrl(fileName: string, mimeType: string, sizeBytes: number): Promise<{ path: string; token: string; signedUrl: string; fileName: string; mimeType: string; sizeBytes: number }> {
    validateAttachment(fileName, mimeType, sizeBytes);
    const ticket = await this.storage.createSignedUploadUrl(buildAttachmentPath(mimeType));
    return { ...ticket, fileName, mimeType, sizeBytes };
  }

  /**
   * Validates a submitted attachment list. Files the template did not already
   * carry must actually have been uploaded, so a template can never point at
   * nothing and fail every send later.
   */
  private async resolveAttachments(input: TemplateAttachment[], existing: TemplateAttachment[] = []): Promise<TemplateAttachment[]> {
    const validated = validateTemplateAttachments(input);
    const known = new Set(existing.map((a) => a.path));
    for (const a of validated) {
      if (known.has(a.path)) continue;
      if (!(await this.storage.objectExists(a.path))) throw new BadRequestException(`Attachment "${a.fileName}" was not uploaded.`);
    }
    return validated;
  }

  /** Short-lived signed URL for downloading one of a template's attachments. */
  async attachmentDownloadUrl(id: string, path: string): Promise<{ url: string; fileName: string }> {
    const t = await this.prisma.communicationEmailTemplate.findUnique({ where: { id }, select: { designJson: true } });
    if (!t) throw new NotFoundException("Template not found");
    const attachment = readTemplateAttachments(t.designJson).find((a) => a.path === path);
    if (!attachment) throw new NotFoundException("Attachment not found");
    return { url: await this.storage.createSignedDownloadUrl(attachment.path, attachment.fileName), fileName: attachment.fileName };
  }

  private async loadAttachmentContent(attachments: TemplateAttachment[]): Promise<OutboundEmailAttachment[] | undefined> {
    if (attachments.length === 0) return undefined;
    const out: OutboundEmailAttachment[] = [];
    for (const a of attachments) {
      const buf = await this.storage.downloadBuffer(a.path);
      if (!buf) throw new BadRequestException(`Attachment "${a.fileName}" could not be read from storage.`);
      out.push({ fileName: a.fileName, mimeType: a.mimeType, contentBase64: buf.toString("base64") });
    }
    return out;
  }

  private async names(ids: Array<string | null>): Promise<Map<string, string | null>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, displayName: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || null)]));
  }

  async list(query: ListEmailTemplatesDto): Promise<PaginatedResult<EmailTemplateSummary>> {
    const and: Prisma.CommunicationEmailTemplateWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    else and.push({ status: { not: "ARCHIVED" } });
    if (query.search) and.push({ name: { contains: query.search.trim(), mode: "insensitive" } });
    const where: Prisma.CommunicationEmailTemplateWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationEmailTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.communicationEmailTemplate.count({ where }),
    ]);
    const names = await this.names(rows.map((r) => r.updatedByUserId));
    return { items: rows.map((r) => toTemplateSummary(r, names)), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string): Promise<EmailTemplateDetail> {
    const t = await this.prisma.communicationEmailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Template not found");
    return toTemplateDetail(t, await this.names([t.updatedByUserId]));
  }

  /** Validate + compile a design (relaxed media at draft time). */
  private compile(designJson: unknown, preheader: string | undefined, requireProdMedia: boolean) {
    const design = validateDesign(designJson, requireProdMedia);
    assertMergeTokensAllowed(design);
    return { design, ...compileDesign(design, { preheader }) };
  }

  async create(user: RequestUser, dto: CreateEmailTemplateDto): Promise<EmailTemplateDetail> {
    const { html, text } = this.compile(dto.designJson, dto.preheaderDefault, false);
    const attachments = await this.resolveAttachments(dto.attachments ?? []);
    const created = await this.prisma.communicationEmailTemplate.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        subjectDefault: dto.subjectDefault?.trim() || null,
        preheaderDefault: dto.preheaderDefault?.trim() || null,
        designJson: designWithAttachments(dto.designJson, attachments) as Prisma.InputJsonValue,
        compiledHtml: html,
        compiledText: text,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "communication.email_template.created", entityType: "CommunicationEmailTemplate", entityId: created.id, actorUserId: user.id, metadata: { name: created.name, attachmentCount: attachments.length } });
    return this.findOne(created.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplateDetail> {
    const existing = await this.prisma.communicationEmailTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Template not found");
    const data: Prisma.CommunicationEmailTemplateUpdateInput = { updatedByUserId: user.id };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.subjectDefault !== undefined) data.subjectDefault = dto.subjectDefault.trim() || null;
    if (dto.preheaderDefault !== undefined) data.preheaderDefault = dto.preheaderDefault.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.designJson !== undefined) {
      const preheader = dto.preheaderDefault ?? existing.preheaderDefault ?? undefined;
      const { html, text } = this.compile(dto.designJson, preheader, false);
      data.compiledHtml = html;
      data.compiledText = text;
    }
    if (dto.designJson !== undefined || dto.attachments !== undefined) {
      // The attachment list rides on designJson, so either change rewrites it:
      // a new design keeps the current files, a new file list keeps the design.
      const current = readTemplateAttachments(existing.designJson);
      const attachments = dto.attachments !== undefined ? await this.resolveAttachments(dto.attachments, current) : current;
      data.designJson = designWithAttachments(dto.designJson ?? existing.designJson, attachments) as Prisma.InputJsonValue;
    }
    await this.prisma.communicationEmailTemplate.update({ where: { id }, data });
    await this.audit.record({ action: "communication.email_template.updated", entityType: "CommunicationEmailTemplate", entityId: id, actorUserId: user.id, metadata: { fields: Object.keys(dto) } });
    return this.findOne(id);
  }

  async duplicate(user: RequestUser, id: string): Promise<EmailTemplateDetail> {
    const t = await this.prisma.communicationEmailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Template not found");
    const created = await this.prisma.communicationEmailTemplate.create({
      data: {
        name: `${t.name} (copy)`,
        description: t.description,
        subjectDefault: t.subjectDefault,
        preheaderDefault: t.preheaderDefault,
        designJson: t.designJson as Prisma.InputJsonValue,
        compiledHtml: t.compiledHtml,
        compiledText: t.compiledText,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    await this.audit.record({ action: "communication.email_template.created", entityType: "CommunicationEmailTemplate", entityId: created.id, actorUserId: user.id, metadata: { duplicatedFrom: id } });
    return this.findOne(created.id);
  }

  async archive(user: RequestUser, id: string): Promise<EmailTemplateDetail> {
    const existing = await this.prisma.communicationEmailTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Template not found");
    await this.prisma.communicationEmailTemplate.update({ where: { id }, data: { status: "ARCHIVED", updatedByUserId: user.id } });
    await this.audit.record({ action: "communication.email_template.archived", entityType: "CommunicationEmailTemplate", entityId: id, actorUserId: user.id });
    return this.findOne(id);
  }

  /** Live compile of an in-progress design for the builder preview (same compiler as sending). */
  previewDesign(dto: PreviewDesignDto): { html: string; text: string } {
    const compiled = this.compile(dto.designJson, dto.preheader, false);
    const sampleUrl = `${publicSiteUrl(this.config)}/unsubscribe/email?token=sample`;
    return renderForRecipient({ html: compiled.html, text: compiled.text }, { firstName: dto.sampleValues?.firstName ?? "Alex", lastName: dto.sampleValues?.lastName ?? "Rivera", organizationName: dto.sampleValues?.organizationName ?? "Sample Org", email: "sample@example.com" }, sampleUrl);
  }

  private rateLimit(userId: string): void {
    const now = Date.now();
    const recent = (testSendLog.get(userId) ?? []).filter((t) => now - t < TEST_SEND_WINDOW_MS);
    if (recent.length >= TEST_SEND_MAX) throw new BadRequestException("Too many test emails. Please wait a moment and try again.");
    recent.push(now);
    testSendLog.set(userId, recent);
  }

  async testSend(user: RequestUser, id: string, dto: TestSendDto): Promise<{ ok: boolean; mock: boolean; providerMessageId?: string; message: string }> {
    this.rateLimit(user.id);
    const t = await this.prisma.communicationEmailTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Template not found");
    if (!this.transport.configured) throw new ForbiddenException("Email provider is not configured for sending.");

    const compiled = { html: t.compiledHtml, text: t.compiledText };
    const sampleUrl = `${publicSiteUrl(this.config)}/unsubscribe/email?token=sample`;
    const rendered = renderForRecipient(compiled, { firstName: dto.sampleValues?.firstName ?? "Alex", lastName: dto.sampleValues?.lastName ?? "Rivera", organizationName: dto.sampleValues?.organizationName ?? "Sample Org", email: dto.toEmail }, sampleUrl);
    const attachments = await this.loadAttachmentContent(readTemplateAttachments(t.designJson));
    const sender = resolveSender(this.config);
    const outcome = await this.transport.sendEmail({
      internalMessageId: `test-${id}-${Date.now()}`,
      to: dto.toEmail,
      senderEmail: sender.email,
      senderName: sender.name,
      subject: `[TEST] ${dto.subject ?? t.subjectDefault ?? t.name}`,
      html: rendered.html,
      text: rendered.text,
      tags: ["nonnis-test"],
      attachments,
    });
    await this.audit.record({ action: "communication.email_template.test_sent", entityType: "CommunicationEmailTemplate", entityId: id, actorUserId: user.id, metadata: { provider: this.transport.name } });
    const mock = this.transport.name === "mock";
    if (outcome.ok) return { ok: true, mock, providerMessageId: outcome.providerMessageId, message: mock ? "Mock test processed — no external email delivered." : "Test email sent." };
    return { ok: false, mock, message: `Test send failed: ${outcome.message}` };
  }
}
