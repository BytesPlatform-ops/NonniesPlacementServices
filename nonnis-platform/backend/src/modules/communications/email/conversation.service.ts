import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { AttachmentStorageService } from "./attachment-storage.service";
import { formatReplyAddress, inboundDomain } from "./reply-address";
import { generateThreadToken } from "./email-config";
import { generateInternetMessageId, normalizeReplySubject, buildReferencesChain } from "./thread-headers";
import { compileReply } from "./reply-format";
import { buildPreviewText } from "./inbound-sanitize";
import { MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES, buildAttachmentPath, validateAttachment } from "./attachment-policy";
import {
  type ConversationDetail,
  type ConversationListItem,
  type MessageView,
  deriveNeedsReply,
  toMessageView,
} from "./inbox.serializer";

export type InboxView = "all" | "unread" | "needs_reply" | "archived";

export interface ListConversationsInput {
  view: InboxView;
  search?: string;
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReplyAttachmentInput {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

const THREAD_MESSAGE_LIMIT = 200;

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audit: AuditService,
    private readonly attachments: AttachmentStorageService,
  ) {}

  // --- list (per-user unread + derived needsReply, no N+1) -------------------
  async list(user: RequestUser, input: ListConversationsInput): Promise<Paginated<ConversationListItem>> {
    const offset = (input.page - 1) * input.pageSize;
    const where = this.buildListWhere(user.id, input);

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        contactId: string;
        contactName: string | null;
        contactEmail: string | null;
        contactOrg: string | null;
        subject: string | null;
        preview: string | null;
        latestDirection: "INBOUND" | "OUTBOUND" | null;
        lastMessageAt: Date | null;
        status: "OPEN" | "CLOSED" | "ARCHIVED";
        unread: boolean;
        needsReply: boolean;
        originCampaignId: string | null;
        originCampaignName: string | null;
      }>
    >(Prisma.sql`
      SELECT c.id, c."contactId",
        NULLIF(TRIM(CONCAT(COALESCE(ct."firstName", ''), ' ', COALESCE(ct."lastName", ''))), '') AS "contactName",
        ct.email AS "contactEmail", ct."organizationName" AS "contactOrg",
        c.subject, c."previewText" AS preview, c."latestDirection", c."lastMessageAt", c.status,
        (c."lastInboundAt" IS NOT NULL AND (rs."lastReadAt" IS NULL OR c."lastInboundAt" > rs."lastReadAt")) AS unread,
        (c.status <> 'ARCHIVED' AND c."lastInboundAt" IS NOT NULL AND (c."lastOutboundAt" IS NULL OR c."lastInboundAt" > c."lastOutboundAt")) AS "needsReply",
        c."originCampaignId", cam.name AS "originCampaignName"
      FROM "communication_conversations" c
      JOIN "communication_contacts" ct ON ct.id = c."contactId"
      LEFT JOIN "communication_conversation_read_states" rs ON rs."conversationId" = c.id AND rs."userId" = ${user.id}::uuid
      LEFT JOIN "communication_email_campaigns" cam ON cam.id = c."originCampaignId"
      WHERE ${where}
      ORDER BY c."lastMessageAt" DESC NULLS LAST
      LIMIT ${input.pageSize} OFFSET ${offset}
    `);

    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "communication_conversations" c
      JOIN "communication_contacts" ct ON ct.id = c."contactId"
      LEFT JOIN "communication_conversation_read_states" rs ON rs."conversationId" = c.id AND rs."userId" = ${user.id}::uuid
      WHERE ${where}
    `);
    const total = Number(countRows[0]?.count ?? 0n);

    return {
      items: rows.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        contactOrganization: r.contactOrg,
        subject: r.subject,
        preview: r.preview,
        latestDirection: r.latestDirection,
        lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
        status: r.status,
        unread: r.unread,
        needsReply: r.needsReply,
        originCampaignId: r.originCampaignId,
        originCampaignName: r.originCampaignName,
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }

  private buildListWhere(userId: string, input: ListConversationsInput): Prisma.Sql {
    const conds: Prisma.Sql[] = [Prisma.sql`c.channel = 'EMAIL'`];
    if (input.view === "archived") conds.push(Prisma.sql`c.status = 'ARCHIVED'`);
    else conds.push(Prisma.sql`c.status <> 'ARCHIVED'`);

    if (input.view === "unread") {
      conds.push(Prisma.sql`c."lastInboundAt" IS NOT NULL AND (rs."lastReadAt" IS NULL OR c."lastInboundAt" > rs."lastReadAt")`);
    }
    if (input.view === "needs_reply") {
      conds.push(Prisma.sql`c."lastInboundAt" IS NOT NULL AND (c."lastOutboundAt" IS NULL OR c."lastInboundAt" > c."lastOutboundAt")`);
    }
    if (input.search && input.search.trim()) {
      const q = `%${input.search.trim().toLowerCase()}%`;
      conds.push(Prisma.sql`(LOWER(COALESCE(ct.email,'')) LIKE ${q} OR LOWER(COALESCE(ct."firstName",'') || ' ' || COALESCE(ct."lastName",'')) LIKE ${q} OR LOWER(COALESCE(c.subject,'')) LIKE ${q})`);
    }
    return conds.reduce((acc, cur, i) => (i === 0 ? cur : Prisma.sql`${acc} AND ${cur}`));
  }

  /** Efficient per-user unread conversation count for the nav badge. */
  async unreadCount(user: RequestUser): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "communication_conversations" c
      LEFT JOIN "communication_conversation_read_states" rs ON rs."conversationId" = c.id AND rs."userId" = ${user.id}::uuid
      WHERE c.channel = 'EMAIL' AND c.status <> 'ARCHIVED'
        AND c."lastInboundAt" IS NOT NULL AND (rs."lastReadAt" IS NULL OR c."lastInboundAt" > rs."lastReadAt")
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  // --- detail ----------------------------------------------------------------
  async get(user: RequestUser, id: string): Promise<ConversationDetail> {
    const conversation = await this.prisma.communicationConversation.findUnique({
      where: { id },
      include: {
        contact: { include: { preferences: { where: { channel: "EMAIL" }, select: { consentStatus: true } }, listMemberships: { include: { list: { select: { name: true } } } }, tagAssignments: { include: { tag: { select: { name: true } } } } } },
        originCampaign: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: THREAD_MESSAGE_LIMIT, include: { attachments: true } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    // Opening the conversation marks it read for THIS user only.
    await this.markRead(user, id);

    const suppressed = conversation.contact.normalizedEmail
      ? !!(await this.prisma.communicationSuppression.findFirst({ where: { channel: "EMAIL", normalizedAddress: conversation.contact.normalizedEmail, active: true }, select: { id: true } }))
      : false;

    return {
      id: conversation.id,
      contact: {
        id: conversation.contact.id,
        name: [conversation.contact.firstName, conversation.contact.lastName].filter(Boolean).join(" ") || null,
        email: conversation.contact.email,
        organization: conversation.contact.organizationName,
        emailConsent: conversation.contact.preferences[0]?.consentStatus ?? null,
        suppressed,
        lists: conversation.contact.listMemberships.map((m) => m.list.name),
        tags: conversation.contact.tagAssignments.map((t) => t.tag.name),
      },
      subject: conversation.subject,
      status: conversation.status,
      needsReply: deriveNeedsReply(conversation),
      replyAddress: conversation.threadToken ? formatReplyAddress(this.config, conversation.threadToken) : null,
      originCampaignId: conversation.originCampaignId,
      originCampaignName: conversation.originCampaign?.name ?? null,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map(toMessageView),
    };
  }

  // --- read state ------------------------------------------------------------
  async markRead(user: RequestUser, id: string): Promise<{ ok: true }> {
    const now = new Date();
    await this.prisma.communicationConversationReadState.upsert({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      create: { conversationId: id, userId: user.id, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return { ok: true };
  }

  async markUnread(user: RequestUser, id: string): Promise<{ ok: true }> {
    // Setting lastReadAt to the epoch makes it unread again for this user only.
    await this.prisma.communicationConversationReadState.upsert({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      create: { conversationId: id, userId: user.id, lastReadAt: new Date(0) },
      update: { lastReadAt: new Date(0) },
    });
    return { ok: true };
  }

  // --- archive / restore -----------------------------------------------------
  async archive(user: RequestUser, id: string): Promise<{ ok: true }> {
    const conversation = await this.requireConversation(id);
    await this.prisma.communicationConversation.update({ where: { id: conversation.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await this.audit.record({ action: "communication.conversation.archived", entityType: "CommunicationConversation", entityId: id, actorUserId: user.id });
    return { ok: true };
  }

  async restore(user: RequestUser, id: string): Promise<{ ok: true }> {
    const conversation = await this.requireConversation(id);
    await this.prisma.communicationConversation.update({ where: { id: conversation.id }, data: { status: "OPEN", archivedAt: null } });
    await this.audit.record({ action: "communication.conversation.restored", entityType: "CommunicationConversation", entityId: id, actorUserId: user.id });
    return { ok: true };
  }

  // --- reply -----------------------------------------------------------------
  async reply(user: RequestUser, id: string, markdown: string, attachments: ReplyAttachmentInput[] = []): Promise<{ conversationId: string; message: MessageView }> {
    const conversation = await this.prisma.communicationConversation.findUnique({ where: { id }, include: { contact: { select: { email: true, normalizedEmail: true } } } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    if (conversation.channel !== "EMAIL") throw new BadRequestException("Only email conversations can be replied to here.");
    if (!conversation.contact.email || !conversation.contact.normalizedEmail) throw new BadRequestException("This contact has no email address to reply to.");

    const compiled = compileReply(markdown); // validates + sanitizes + compiles

    // Stable per-conversation opaque reply token (never rotated per message).
    let threadToken = conversation.threadToken;
    if (!threadToken) {
      threadToken = generateThreadToken();
      await this.prisma.communicationConversation.update({ where: { id }, data: { threadToken } });
    }
    const replyToAddress = formatReplyAddress(this.config, threadToken);

    // Threading: In-Reply-To = latest inbound RFC Message-ID (fallback: latest with an id).
    const latestInbound = await this.prisma.communicationMessage.findFirst({ where: { conversationId: id, direction: "INBOUND", messageId: { not: null } }, orderBy: { createdAt: "desc" }, select: { messageId: true, references: true } });
    const anchor = latestInbound ?? (await this.prisma.communicationMessage.findFirst({ where: { conversationId: id, messageId: { not: null } }, orderBy: { createdAt: "desc" }, select: { messageId: true, references: true } }));
    const inReplyTo = anchor?.messageId ?? null;
    const references = buildReferencesChain(anchor?.references ?? null, inReplyTo);
    const internetMessageId = generateInternetMessageId(inboundDomain(this.config));
    const subject = normalizeReplySubject(conversation.subject);
    const preview = buildPreviewText(compiled.text);

    const validated = this.validateReplyAttachments(attachments);
    await this.assertAttachmentsPresent(validated);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communicationMessage.create({
        data: {
          conversationId: id,
          channel: "EMAIL",
          direction: "OUTBOUND",
          status: "QUEUED",
          subject,
          textBody: compiled.text,
          htmlBody: compiled.html,
          previewText: preview,
          fromAddress: null,
          toAddress: conversation.contact.email,
          replyToAddress,
          messageId: internetMessageId,
          inReplyTo,
          references,
          nextAttemptAt: new Date(),
        },
      });
      if (validated.length) {
        await tx.communicationMessageAttachment.createMany({ data: validated.map((a) => ({ messageId: created.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, storagePath: a.path })) });
      }
      // Replying clears needsReply, keeps the thread open, and marks it read for the sender.
      await tx.communicationConversation.update({ where: { id }, data: { lastMessageAt: new Date(), lastOutboundAt: new Date(), latestDirection: "OUTBOUND", previewText: preview, status: conversation.status === "ARCHIVED" ? "OPEN" : conversation.status, archivedAt: conversation.status === "ARCHIVED" ? null : conversation.archivedAt } });
      await tx.communicationConversationReadState.upsert({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, create: { conversationId: id, userId: user.id, lastReadAt: new Date() }, update: { lastReadAt: new Date() } });
      return created;
    });

    await this.audit.record({ action: "communication.email_reply.queued", entityType: "CommunicationConversation", entityId: id, actorUserId: user.id, metadata: { messageId: message.id, attachmentCount: validated.length } });

    const withAttachments = await this.prisma.communicationMessage.findUnique({ where: { id: message.id }, include: { attachments: true } });
    return { conversationId: id, message: toMessageView(withAttachments!) };
  }

  /** Retry a permanently-failed / delivery-unknown outbound reply (authorized, manual). */
  async retryReply(user: RequestUser, conversationId: string, messageId: string): Promise<{ ok: true }> {
    const message = await this.prisma.communicationMessage.findFirst({ where: { id: messageId, conversationId, direction: "OUTBOUND" }, select: { id: true, status: true } });
    if (!message) throw new NotFoundException("Message not found");
    if (message.status !== "FAILED" && message.status !== "DELIVERY_UNKNOWN") throw new BadRequestException("Only a failed reply can be retried.");
    await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { status: "QUEUED", nextAttemptAt: new Date(), claimToken: null, leaseExpiresAt: null } });
    await this.audit.record({ action: "communication.email_reply.retried", entityType: "CommunicationConversation", entityId: conversationId, actorUserId: user.id, metadata: { messageId } });
    return { ok: true };
  }

  // --- attachments -----------------------------------------------------------
  async createAttachmentUploadUrl(fileName: string, mimeType: string, sizeBytes: number): Promise<{ path: string; token: string; signedUrl: string; fileName: string; mimeType: string; sizeBytes: number }> {
    validateAttachment(fileName, mimeType, sizeBytes);
    const path = buildAttachmentPath(mimeType);
    const ticket = await this.attachments.createSignedUploadUrl(path);
    return { ...ticket, fileName, mimeType, sizeBytes };
  }

  async attachmentDownloadUrl(conversationId: string, attachmentId: string): Promise<{ url: string; fileName: string }> {
    const attachment = await this.prisma.communicationMessageAttachment.findFirst({ where: { id: attachmentId, message: { conversationId } }, select: { storagePath: true, fileName: true } });
    if (!attachment) throw new NotFoundException("Attachment not found");
    const url = await this.attachments.createSignedDownloadUrl(attachment.storagePath, attachment.fileName);
    return { url, fileName: attachment.fileName };
  }

  private validateReplyAttachments(input: ReplyAttachmentInput[]): ReplyAttachmentInput[] {
    if (input.length === 0) return [];
    if (input.length > MAX_ATTACHMENTS) throw new BadRequestException(`At most ${MAX_ATTACHMENTS} attachments are allowed.`);
    let total = 0;
    for (const a of input) {
      validateAttachment(a.fileName, a.mimeType, a.sizeBytes);
      if (!a.path.startsWith("attachments/")) throw new BadRequestException("Invalid attachment reference.");
      total += a.sizeBytes;
    }
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) throw new BadRequestException("The attachments exceed the total size limit.");
    return input;
  }

  private async assertAttachmentsPresent(input: ReplyAttachmentInput[]): Promise<void> {
    for (const a of input) {
      const exists = await this.attachments.objectExists(a.path);
      if (!exists) throw new BadRequestException(`Attachment "${a.fileName}" was not uploaded.`);
    }
  }

  private async requireConversation(id: string) {
    const conversation = await this.prisma.communicationConversation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }
}
