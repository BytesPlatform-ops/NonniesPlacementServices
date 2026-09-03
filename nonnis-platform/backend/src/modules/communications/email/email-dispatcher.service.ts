import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type CommunicationEmailCampaignRecipient, type CommunicationMessage } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport, type OutboundEmailAttachment, type OutboundEmailMessage } from "../providers/email-transport";
import { evaluateChannelEligibility } from "../eligibility";
import { renderForRecipient } from "./email-compiler";
import { generateUnsubscribeToken, resolveSender, unsubscribeUrl } from "./email-config";
import { formatReplyAddress, inboundDomain } from "./reply-address";
import { generateInternetMessageId } from "./thread-headers";
import { isTransientInfrastructureError } from "../transient-error";
import { classifySendResult } from "../dispatch/send-outcome";
import { DeliveryMaintenanceService } from "../dispatch/delivery-maintenance.service";
import { AttachmentStorageService } from "./attachment-storage.service";

const LEASE_MS = 5 * 60_000;

/**
 * Communications email delivery worker (NOT a generic automation engine). One
 * Postgres-backed, multi-instance-safe worker drives BOTH outboxes through the
 * SAME shared send/classify policy:
 *   - campaign recipients (CommunicationEmailCampaignRecipient) — bulk
 *   - direct CRM replies (QUEUED outbound CommunicationMessage) — 1:1
 * Claiming uses FOR UPDATE SKIP LOCKED so two instances never send the same row.
 */
@Injectable()
export class EmailDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("EmailDispatcher");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly attachments: AttachmentStorageService,
    private readonly maintenance: DeliveryMaintenanceService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get("emailDispatchEnabled", { infer: true })) {
      this.logger.log("Email dispatcher disabled (EMAIL_DISPATCH_ENABLED=false).");
      return;
    }
    const pollMs = this.config.get("emailDispatchPollMs", { infer: true });
    this.timer = setInterval(() => void this.tick(), pollMs);
    this.logger.log(`Email dispatcher started (poll ${pollMs}ms, provider ${this.transport.name}).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Repair crashed-worker leftovers and finalize terminal campaigns first, so a
      // recovered row can be picked up by the very same pass.
      await this.maintenance.runMaintenance();
      await this.runOnce();
      await this.runRepliesOnce();
    } catch (err) {
      this.logger.error(`Dispatch tick failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }

  // ===========================================================================
  // Campaign recipient outbox (15B)
  // ===========================================================================
  async runOnce(): Promise<number> {
    const batchSize = this.config.get("emailDispatchBatchSize", { infer: true });
    const concurrency = this.config.get("emailDispatchConcurrency", { infer: true });
    const claimed = await this.claim(batchSize);
    if (claimed.length === 0) return 0;

    const campaignIds = [...new Set(claimed.map((r) => r.campaignId))];
    await this.prisma.communicationEmailCampaign.updateMany({ where: { id: { in: campaignIds }, status: "QUEUED" }, data: { status: "SENDING", startedAt: new Date() } });

    await this.pool(claimed, concurrency, (r) => this.processRecipient(r));
    for (const id of campaignIds) await this.updateCampaignCompletion(id);
    return claimed.length;
  }

  private async claim(batch: number): Promise<CommunicationEmailCampaignRecipient[]> {
    const token = randomUUID();
    const lease = new Date(Date.now() + LEASE_MS);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "communication_email_campaign_recipients" r
      SET "deliveryStatus" = 'PROCESSING', "processingAt" = now(), "claimToken" = ${token}, "leaseExpiresAt" = ${lease}, "updatedAt" = now()
      WHERE r.id IN (
        SELECT r2.id FROM "communication_email_campaign_recipients" r2
        JOIN "communication_email_campaigns" c ON c.id = r2."campaignId"
        WHERE r2."deliveryStatus" = 'QUEUED'
          AND (r2."queuedAt" IS NULL OR r2."queuedAt" <= now())
          AND c.status IN ('QUEUED', 'SENDING')
        ORDER BY r2."queuedAt" ASC NULLS FIRST
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING r.id
    `);
    if (rows.length === 0) return [];
    return this.prisma.communicationEmailCampaignRecipient.findMany({ where: { id: { in: rows.map((r) => r.id) }, claimToken: token } });
  }

  private async processRecipient(recipient: CommunicationEmailCampaignRecipient): Promise<void> {
    const campaign = await this.prisma.communicationEmailCampaign.findUnique({ where: { id: recipient.campaignId } });
    if (!campaign || !campaign.htmlSnapshot || campaign.status === "CANCELLED") {
      await this.markRecipientCancelled(recipient.id, "CAMPAIGN_CANCELLED");
      return;
    }

    const contact = await this.prisma.communicationContact.findUnique({
      where: { id: recipient.contactId },
      select: { id: true, status: true, normalizedEmail: true, unsubscribeToken: true, firstName: true, lastName: true, organizationName: true, email: true, preferences: { where: { channel: "EMAIL" }, select: { consentStatus: true } } },
    });
    if (!contact || !contact.normalizedEmail) {
      await this.markRecipientCancelled(recipient.id, "NO_EMAIL");
      return;
    }
    const suppressed = await this.prisma.communicationSuppression.findFirst({ where: { channel: "EMAIL", normalizedAddress: contact.normalizedEmail, active: true }, select: { id: true } });
    const eligibility = evaluateChannelEligibility({
      channel: "EMAIL",
      archived: contact.status === "ARCHIVED",
      hasAddress: true,
      addressValid: true,
      consentStatus: contact.preferences[0]?.consentStatus ?? "UNKNOWN",
      suppressed: !!suppressed,
    });
    if (!eligibility.eligible) {
      const reason = eligibility.reasons[0] ?? "INELIGIBLE";
      const status = reason === "OPTED_OUT" || reason === "SUPPRESSED" ? "UNSUBSCRIBED" : "CANCELLED";
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: status, exclusionReason: reason, cancelledAt: new Date(), claimToken: null } });
      return;
    }

    let token = contact.unsubscribeToken;
    if (!token) {
      token = generateUnsubscribeToken();
      await this.prisma.communicationContact.update({ where: { id: contact.id }, data: { unsubscribeToken: token } });
    }
    const unsub = unsubscribeUrl(this.config, token);
    const rendered = renderForRecipient({ html: campaign.htmlSnapshot, text: campaign.textSnapshot ?? "" }, { firstName: contact.firstName, lastName: contact.lastName, organizationName: contact.organizationName, email: contact.email }, unsub);
    const sender = resolveSender(this.config);
    // Conversation-specific Reply-To so a recipient's normal Reply routes back to the CRM.
    const replyTo = formatReplyAddress(this.config, recipient.threadToken);
    const internetMessageId = generateInternetMessageId(inboundDomain(this.config));

    // Mark the exact moment we hand this to the provider. If the worker dies after
    // this point the row becomes DELIVERY_UNKNOWN rather than being resent.
    await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { dispatchedAt: new Date() } });

    const outcome = await this.transport.sendEmail({
      internalMessageId: recipient.internalMessageId,
      to: recipient.emailSnapshot,
      toName: [recipient.firstNameSnapshot, recipient.lastNameSnapshot].filter(Boolean).join(" ") || undefined,
      senderEmail: campaign.senderEmail ?? sender.email,
      senderName: campaign.senderName ?? sender.name,
      replyTo,
      subject: campaign.subjectSnapshot ?? "",
      html: rendered.html,
      text: rendered.text,
      headers: { "Message-Id": internetMessageId, "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [`campaign:${campaign.id}`],
    });

    const action = classifySendResult(outcome, recipient.attemptCount);
    if (action.kind === "sent") {
      await this.markRecipientSent(recipient, campaign.id, campaign.subjectSnapshot ?? "", rendered.html, rendered.text, action.providerMessageId, internetMessageId, replyTo, sender.email);
      return;
    }
    await this.applyRecipientFailure(recipient.id, action);
  }

  private async markRecipientSent(recipient: CommunicationEmailCampaignRecipient, campaignId: string, subject: string, html: string, text: string, providerMessageId: string, internetMessageId: string, replyTo: string, fromAddress: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.communicationConversation.create({
        data: { contactId: recipient.contactId, channel: "EMAIL", subject, lastMessageAt: new Date(), lastOutboundAt: new Date(), latestDirection: "OUTBOUND", threadToken: recipient.threadToken, originCampaignId: campaignId, previewText: subject },
      });
      const message = await tx.communicationMessage.create({
        data: { conversationId: conversation.id, channel: "EMAIL", direction: "OUTBOUND", status: "SENT", subject, htmlBody: html, textBody: text, messageId: internetMessageId, providerMessageId, fromAddress, toAddress: recipient.emailSnapshot, replyToAddress: replyTo, sentAt: new Date() },
      });
      await tx.communicationEmailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { deliveryStatus: "SENT", sentAt: new Date(), providerMessageId, attemptCount: { increment: 1 }, claimToken: null, leaseExpiresAt: null, conversationId: conversation.id, messageId: message.id, lastErrorCode: null, lastErrorMessageSafe: null },
      });
    });
  }

  private async applyRecipientFailure(recipientId: string, action: Extract<ReturnType<typeof classifySendResult>, { kind: "retry" | "unknown" | "failed" }>): Promise<void> {
    if (action.kind === "unknown") {
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "DELIVERY_UNKNOWN", attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    if (action.kind === "retry") {
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "QUEUED", queuedAt: new Date(Date.now() + action.backoffMs), attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "FAILED", failedAt: new Date(), attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
  }

  private async markRecipientCancelled(recipientId: string, reason: string): Promise<void> {
    await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "CANCELLED", exclusionReason: reason, cancelledAt: new Date(), claimToken: null, leaseExpiresAt: null } });
  }

  async updateCampaignCompletion(campaignId: string): Promise<void> {
    const pending = await this.prisma.communicationEmailCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["QUEUED", "PROCESSING"] } } });
    if (pending > 0) return;
    const campaign = await this.prisma.communicationEmailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign || campaign.status === "CANCELLED" || campaign.status === "COMPLETED" || campaign.status === "PARTIALLY_FAILED") return;
    const bad = await this.prisma.communicationEmailCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["FAILED", "BOUNCED", "DELIVERY_UNKNOWN"] } } });
    await this.prisma.communicationEmailCampaign.update({ where: { id: campaignId }, data: { status: bad > 0 ? "PARTIALLY_FAILED" : "COMPLETED", completedAt: new Date() } });
  }

  // ===========================================================================
  // Direct reply outbox (15C) — same claim + classify policy, one message at a time
  // ===========================================================================
  async runRepliesOnce(): Promise<number> {
    const batchSize = this.config.get("emailDispatchBatchSize", { infer: true });
    const concurrency = this.config.get("emailDispatchConcurrency", { infer: true });
    const claimed = await this.claimReplies(batchSize);
    if (claimed.length === 0) return 0;
    await this.pool(claimed, concurrency, (m) => this.processReply(m));
    return claimed.length;
  }

  private async claimReplies(batch: number): Promise<CommunicationMessage[]> {
    const token = randomUUID();
    const lease = new Date(Date.now() + LEASE_MS);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "communication_messages" m
      SET "status" = 'PROCESSING', "claimToken" = ${token}, "leaseExpiresAt" = ${lease}, "updatedAt" = now()
      WHERE m.id IN (
        SELECT m2.id FROM "communication_messages" m2
        WHERE m2."direction" = 'OUTBOUND' AND m2."status" = 'QUEUED' AND m2."channel" = 'EMAIL'
          AND (m2."nextAttemptAt" IS NULL OR m2."nextAttemptAt" <= now())
        ORDER BY m2."nextAttemptAt" ASC NULLS FIRST
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING m.id
    `);
    if (rows.length === 0) return [];
    return this.prisma.communicationMessage.findMany({ where: { id: { in: rows.map((r) => r.id) }, claimToken: token } });
  }

  private async processReply(message: CommunicationMessage): Promise<void> {
    const conversation = await this.prisma.communicationConversation.findUnique({ where: { id: message.conversationId }, select: { id: true, contactId: true, threadToken: true } });
    if (!conversation) {
      await this.applyReplyFailure(message.id, { kind: "failed", attempt: message.attemptCount + 1, code: "NO_CONVERSATION", message: "Conversation missing." });
      return;
    }
    const contact = await this.prisma.communicationContact.findUnique({ where: { id: conversation.contactId }, select: { email: true, normalizedEmail: true } });
    const to = contact?.email ?? message.toAddress;
    if (!to || !contact?.normalizedEmail) {
      await this.applyReplyFailure(message.id, { kind: "failed", attempt: message.attemptCount + 1, code: "NO_RECIPIENT", message: "The contact has no valid email." });
      return;
    }

    let attachments: OutboundEmailAttachment[] | undefined;
    try {
      attachments = await this.loadOutboundAttachments(message.id);
    } catch (err) {
      // Reading attachment rows starts with a database query, so a connection
      // blip surfaces here too. Treating that as a missing attachment kills the
      // reply permanently for a fault that would pass on the next attempt — and
      // reports a cause that has nothing to do with what went wrong.
      const action = isTransientInfrastructureError(err)
        ? classifySendResult(
            { ok: false, classification: "TEMPORARY", code: "ATTACHMENT_LOOKUP_UNAVAILABLE", message: "Attachments could not be read; retrying." },
            message.attemptCount,
          )
        : ({ kind: "failed", attempt: message.attemptCount + 1, code: "ATTACHMENT_UNAVAILABLE", message: "An attachment could not be retrieved." } as const);
      await this.applyReplyFailure(message.id, action as Exclude<ReturnType<typeof classifySendResult>, { kind: "sent" }>);
      return;
    }

    const sender = resolveSender(this.config);
    const replyTo = message.replyToAddress ?? (conversation.threadToken ? formatReplyAddress(this.config, conversation.threadToken) : undefined);
    const headers: Record<string, string> = {};
    if (message.messageId) headers["Message-Id"] = message.messageId;
    if (message.inReplyTo) headers["In-Reply-To"] = message.inReplyTo;
    if (message.references) headers["References"] = message.references;

    const out: OutboundEmailMessage = {
      internalMessageId: message.id,
      to,
      senderEmail: sender.email,
      senderName: sender.name,
      replyTo,
      subject: message.subject ?? "",
      html: message.htmlBody ?? "",
      text: message.textBody ?? "",
      headers,
      tags: ["reply", `conversation:${conversation.id}`],
      attachments,
    };

    await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { dispatchedAt: new Date() } });
    const outcome = await this.transport.sendEmail(out);
    const action = classifySendResult(outcome, message.attemptCount);
    if (action.kind === "sent") {
      await this.prisma.$transaction(async (tx) => {
        await tx.communicationMessage.update({ where: { id: message.id }, data: { status: "SENT", providerMessageId: action.providerMessageId, sentAt: new Date(), attemptCount: { increment: 1 }, claimToken: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessageSafe: null } });
        await tx.communicationConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), lastOutboundAt: new Date(), latestDirection: "OUTBOUND", previewText: message.previewText ?? undefined } });
      });
      return;
    }
    await this.applyReplyFailure(message.id, action);
  }

  private async loadOutboundAttachments(messageId: string): Promise<OutboundEmailAttachment[] | undefined> {
    const rows = await this.prisma.communicationMessageAttachment.findMany({ where: { messageId }, select: { fileName: true, mimeType: true, storagePath: true } });
    if (rows.length === 0) return undefined;
    const out: OutboundEmailAttachment[] = [];
    for (const r of rows) {
      const buf = await this.attachments.downloadBuffer(r.storagePath);
      if (!buf) throw new Error(`attachment ${r.fileName} unavailable`);
      out.push({ fileName: r.fileName, mimeType: r.mimeType, contentBase64: buf.toString("base64") });
    }
    return out;
  }

  private async applyReplyFailure(messageId: string, action: Extract<ReturnType<typeof classifySendResult>, { kind: "retry" | "unknown" | "failed" }>): Promise<void> {
    if (action.kind === "unknown") {
      await this.prisma.communicationMessage.update({ where: { id: messageId }, data: { status: "DELIVERY_UNKNOWN", attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    if (action.kind === "retry") {
      await this.prisma.communicationMessage.update({ where: { id: messageId }, data: { status: "QUEUED", nextAttemptAt: new Date(Date.now() + action.backoffMs), attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    await this.prisma.communicationMessage.update({ where: { id: messageId }, data: { status: "FAILED", attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
  }

  // ===========================================================================
  async dispatchStatus(): Promise<{ provider: string; enabled: boolean; queued: number; processing: number; failed: number; deliveryUnknown: number }> {
    const [queued, processing, failed, deliveryUnknown] = await this.prisma.$transaction([
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "QUEUED" } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "PROCESSING" } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "FAILED" } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "DELIVERY_UNKNOWN" } }),
    ]);
    return { provider: this.transport.name, enabled: this.config.get("emailDispatchEnabled", { infer: true }), queued, processing, failed, deliveryUnknown };
  }

  private async pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let i = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await fn(items[idx]!);
        } catch (err) {
          this.logger.error(`Send crashed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    });
    await Promise.all(workers);
  }
}
