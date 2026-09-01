import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type CommunicationConversation, type CommunicationInboundReviewReason } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { INBOUND_EMAIL_ADAPTER, type EmailInboundAdapter, type NormalizedInboundEmail } from "../providers/email-inbound-adapter";
import { AttachmentStorageService } from "./attachment-storage.service";
import { findReplyToken, parseReplyToken } from "./reply-address";
import { buildPreviewText, htmlToPlainText, sanitizeInboundHtml } from "./inbound-sanitize";
import { buildAttachmentPath, isAllowedAttachmentType, safeDisplayFilename } from "./attachment-policy";

const FUTURE_TOLERANCE_MS = 5 * 60_000; // never trust a provider timestamp far in the future

export type IngestResult =
  | { status: "linked"; conversationId: string }
  | { status: "review"; reason: CommunicationInboundReviewReason }
  | { status: "duplicate" }
  | { status: "ignored" };

function normalizeEmail(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Ingest normalized inbound email into CRM conversations. Deterministic correlation
 * (opaque token → In-Reply-To → References; NEVER subject). A sender-identity check
 * guards against appending to the wrong person's thread. Anything that fails
 * correlation or the identity check is safely quarantined for human review — it is
 * never dropped and never auto-creates a contact.
 */
@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger("InboundEmail");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(INBOUND_EMAIL_ADAPTER) private readonly adapter: EmailInboundAdapter,
    private readonly attachments: AttachmentStorageService,
  ) {}

  async ingestMany(messages: NormalizedInboundEmail[]): Promise<IngestResult[]> {
    const results: IngestResult[] = [];
    for (const m of messages) results.push(await this.ingestOne(m));
    return results;
  }

  async ingestOne(n: NormalizedInboundEmail): Promise<IngestResult> {
    if (!n.from.address) return { status: "ignored" };

    // Idempotency: a retried webhook must not create duplicates.
    if (await this.alreadyProcessed(n)) return { status: "duplicate" };

    const resolution = await this.resolveConversation(n);
    if (resolution.kind === "review") {
      await this.quarantine(n, resolution.reason);
      return { status: "review", reason: resolution.reason };
    }

    // Sender identity check: the From must match the conversation's contact.
    const conversation = resolution.conversation;
    const contact = await this.prisma.communicationContact.findUnique({ where: { id: conversation.contactId }, select: { normalizedEmail: true } });
    const fromNorm = normalizeEmail(n.from.address);
    if (!contact?.normalizedEmail || contact.normalizedEmail !== fromNorm) {
      const reason: CommunicationInboundReviewReason = resolution.via === "token" ? "THREAD_SENDER_MISMATCH" : "HEADER_SENDER_MISMATCH";
      await this.quarantine(n, reason, conversation.id);
      return { status: "review", reason };
    }

    const conversationId = await this.appendInboundMessage(conversation, n);
    return conversationId ? { status: "linked", conversationId } : { status: "duplicate" };
  }

  // --- correlation -----------------------------------------------------------
  private async resolveConversation(
    n: NormalizedInboundEmail,
  ): Promise<{ kind: "resolved"; conversation: CommunicationConversation; via: "token" | "header" } | { kind: "review"; reason: CommunicationInboundReviewReason }> {
    // 1) Opaque thread token from any destination address.
    const token = findReplyToken(this.config, n.destinations);
    if (token) {
      const conv = await this.prisma.communicationConversation.findUnique({ where: { threadToken: token } });
      if (conv) return { kind: "resolved", conversation: conv, via: "token" };
      return { kind: "review", reason: "UNKNOWN_TOKEN" };
    }
    // A malformed reply-<...>@domain that carried no valid token is flagged distinctly.
    if (n.destinations.some((d) => d && d.toLowerCase().includes("reply-") && !parseReplyToken(this.config, d) && this.looksLikeInboundDomain(d))) {
      return { kind: "review", reason: "MALFORMED_ADDRESS" };
    }

    // 2) In-Reply-To → an existing outbound message's RFC Message-ID.
    if (n.inReplyTo) {
      const msg = await this.prisma.communicationMessage.findFirst({ where: { messageId: n.inReplyTo }, orderBy: { createdAt: "desc" }, select: { conversationId: true } });
      if (msg) {
        const conv = await this.prisma.communicationConversation.findUnique({ where: { id: msg.conversationId } });
        if (conv) return { kind: "resolved", conversation: conv, via: "header" };
      }
    }

    // 3) References — newest/most-specific known id first.
    const refs = (n.references?.match(/<[^>]+>/g) ?? []).reverse();
    for (const ref of refs) {
      const msg = await this.prisma.communicationMessage.findFirst({ where: { messageId: ref }, orderBy: { createdAt: "desc" }, select: { conversationId: true } });
      if (msg) {
        const conv = await this.prisma.communicationConversation.findUnique({ where: { id: msg.conversationId } });
        if (conv) return { kind: "resolved", conversation: conv, via: "header" };
      }
    }

    // Subject text is NEVER a correlation key.
    return { kind: "review", reason: n.destinations.length ? "UNRESOLVED" : "NO_TOKEN" };
  }

  private looksLikeInboundDomain(address: string): boolean {
    const domain = this.config.get("communicationsInboundEmailDomain", { infer: true });
    return address.toLowerCase().endsWith(`@${domain}`);
  }

  // --- idempotency -----------------------------------------------------------
  private async alreadyProcessed(n: NormalizedInboundEmail): Promise<boolean> {
    if (n.providerInboundId) {
      const [msg, review] = await Promise.all([
        this.prisma.communicationMessage.findUnique({ where: { providerInboundId: n.providerInboundId }, select: { id: true } }),
        this.prisma.communicationInboundEmailReview.findUnique({ where: { providerInboundId: n.providerInboundId }, select: { id: true } }),
      ]);
      if (msg || review) return true;
    }
    return false;
  }

  // --- append ----------------------------------------------------------------
  private async appendInboundMessage(conversation: CommunicationConversation, n: NormalizedInboundEmail): Promise<string | null> {
    const safeHtml = sanitizeInboundHtml(n.html);
    const text = (n.text && n.text.trim()) || htmlToPlainText(n.html);
    const preview = buildPreviewText(text, safeHtml || n.html);
    const receivedAt = this.trustedReceivedAt(n.receivedAt);
    const auto = n.autoSubmitted === true;

    let messageId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Dedup within a conversation by RFC Message-ID when no provider id was present.
        if (!n.providerInboundId && n.internetMessageId) {
          const dup = await tx.communicationMessage.findFirst({ where: { conversationId: conversation.id, messageId: n.internetMessageId }, select: { id: true } });
          if (dup) return null;
        }
        const message = await tx.communicationMessage.create({
          data: {
            conversationId: conversation.id,
            channel: "EMAIL",
            direction: "INBOUND",
            status: "RECEIVED",
            subject: n.subject ?? conversation.subject ?? null,
            textBody: text || null,
            htmlBody: safeHtml || null,
            previewText: preview || null,
            fromAddress: n.from.address,
            fromName: n.from.name ?? null,
            toAddress: n.primaryTo ?? null,
            messageId: n.internetMessageId ?? null,
            inReplyTo: n.inReplyTo ?? null,
            references: n.references ?? null,
            providerInboundId: n.providerInboundId ?? null,
            autoSubmitted: auto,
            receivedAt,
          },
        });
        await tx.communicationConversation.update({
          where: { id: conversation.id },
          data: {
            // A new inbound reply reopens an archived conversation.
            status: conversation.status === "ARCHIVED" ? "OPEN" : conversation.status,
            archivedAt: conversation.status === "ARCHIVED" ? null : conversation.archivedAt,
            lastMessageAt: receivedAt,
            latestDirection: "INBOUND",
            previewText: preview || conversation.previewText,
            // Auto-responders never mark a conversation as needing a reply.
            lastInboundAt: auto ? conversation.lastInboundAt : receivedAt,
          },
        });
        return message.id;
      });
      if (created === null) return null;
      messageId = created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // idempotent duplicate
      throw err;
    }

    await this.storeInboundAttachments(messageId, n);
    return conversation.id;
  }

  private async storeInboundAttachments(messageId: string, n: NormalizedInboundEmail): Promise<void> {
    const max = this.config.get("communicationsInboundMaxAttachments", { infer: true });
    const maxBytes = this.config.get("communicationsInboundMaxAttachmentBytes", { infer: true });
    let stored = 0;
    for (const att of n.attachments) {
      if (stored >= max) break;
      if (!isAllowedAttachmentType(att.mimeType)) continue; // silently skip disallowed types
      try {
        const buffer = await this.adapter.fetchAttachment(att, maxBytes);
        if (!buffer || buffer.byteLength > maxBytes) continue;
        const path = buildAttachmentPath(att.mimeType);
        await this.attachments.uploadBuffer(path, buffer, att.mimeType);
        await this.prisma.communicationMessageAttachment.create({
          data: { messageId, fileName: safeDisplayFilename(att.fileName), mimeType: att.mimeType, sizeBytes: buffer.byteLength, storagePath: path, providerAttachmentId: att.providerAttachmentId ?? null, contentId: att.contentId ?? null },
        });
        stored++;
      } catch (err) {
        this.logger.warn(`Inbound attachment skipped: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  // --- quarantine ------------------------------------------------------------
  private async quarantine(n: NormalizedInboundEmail, reason: CommunicationInboundReviewReason, linkedConversationId?: string): Promise<void> {
    const safeHtml = sanitizeInboundHtml(n.html);
    const text = (n.text && n.text.trim()) || htmlToPlainText(n.html);
    const data: Prisma.CommunicationInboundEmailReviewCreateInput = {
      provider: this.adapter.name,
      providerInboundId: n.providerInboundId ?? null,
      fromEmail: n.from.address,
      fromName: n.from.name ?? null,
      toAddress: n.primaryTo ?? null,
      subject: n.subject ?? null,
      textBody: text || null,
      sanitizedHtmlBody: safeHtml || null,
      previewText: buildPreviewText(text, safeHtml || n.html) || null,
      internetMessageId: n.internetMessageId ?? null,
      inReplyTo: n.inReplyTo ?? null,
      references: n.references ?? null,
      receivedAt: this.trustedReceivedAt(n.receivedAt),
      reason,
      linkedConversationId: linkedConversationId ?? null,
    };
    try {
      await this.prisma.communicationInboundEmailReview.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // duplicate quarantine
      throw err;
    }
  }

  private trustedReceivedAt(provided?: Date): Date {
    const now = new Date();
    if (!provided || Number.isNaN(provided.getTime())) return now;
    if (provided.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return now; // never trust a future clock
    return provided;
  }
}
