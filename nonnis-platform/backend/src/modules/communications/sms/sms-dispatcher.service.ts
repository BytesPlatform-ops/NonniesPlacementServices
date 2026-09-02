import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type CommunicationMessage, type CommunicationSmsCampaignRecipient } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { SMS_TRANSPORT, type SmsSendOutcome, type SmsTransport } from "../providers/sms-transport";
import { evaluateChannelEligibility } from "../eligibility";
import { classifySendResult, type SendAction } from "../dispatch/send-outcome";
import { DeliveryMaintenanceService } from "../dispatch/delivery-maintenance.service";
import { calculateSegments } from "./sms-segments";
import { statusCallbackUrl } from "./sms-config";
import { SmsConversationService } from "./sms-conversation.service";
import { SmsStatusService } from "./sms-status.service";

const LEASE_MS = 5 * 60_000;

/**
 * Communications SMS delivery worker. Mirrors the email dispatcher and shares the
 * SAME send-result policy (`classifySendResult`) so retry / ambiguous-timeout /
 * permanent-failure behaviour is identical across channels. Postgres-backed with
 * FOR UPDATE SKIP LOCKED claiming — two instances never send the same recipient.
 * Drives both outboxes:
 *   - campaign recipients (CommunicationSmsCampaignRecipient) — bulk
 *   - direct CRM replies (QUEUED outbound SMS CommunicationMessage) — 1:1
 */
@Injectable()
export class SmsDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("SmsDispatcher");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(SMS_TRANSPORT) private readonly transport: SmsTransport,
    private readonly conversations: SmsConversationService,
    private readonly status: SmsStatusService,
    private readonly maintenance: DeliveryMaintenanceService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get("smsDispatchEnabled", { infer: true })) {
      this.logger.log("SMS dispatcher disabled (SMS_DISPATCH_ENABLED=false).");
      return;
    }
    const pollMs = this.config.get("smsDispatchPollMs", { infer: true });
    this.timer = setInterval(() => void this.tick(), pollMs);
    this.logger.log(`SMS dispatcher started (poll ${pollMs}ms, provider ${this.transport.name}).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Shared queue recovery + campaign finalization (see DeliveryMaintenanceService).
      await this.maintenance.runMaintenance();
      await this.runOnce();
      await this.runRepliesOnce();
    } catch (err) {
      this.logger.error(`SMS dispatch tick failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }

  // ===========================================================================
  // Campaign recipient outbox
  // ===========================================================================
  async runOnce(): Promise<number> {
    const batchSize = this.config.get("smsDispatchBatchSize", { infer: true });
    const concurrency = this.config.get("smsDispatchConcurrency", { infer: true });
    const claimed = await this.claim(batchSize);
    if (claimed.length === 0) return 0;

    const campaignIds = [...new Set(claimed.map((r) => r.campaignId))];
    await this.prisma.communicationSmsCampaign.updateMany({ where: { id: { in: campaignIds }, status: "QUEUED" }, data: { status: "SENDING", startedAt: new Date() } });

    await this.pool(claimed, concurrency, (r) => this.processRecipient(r));
    for (const id of campaignIds) await this.updateCampaignCompletion(id);
    return claimed.length;
  }

  private async claim(batch: number): Promise<CommunicationSmsCampaignRecipient[]> {
    const token = randomUUID();
    const lease = new Date(Date.now() + LEASE_MS);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "communication_sms_campaign_recipients" r
      SET "deliveryStatus" = 'PROCESSING', "processingAt" = now(), "claimToken" = ${token}, "leaseExpiresAt" = ${lease}, "updatedAt" = now()
      WHERE r.id IN (
        SELECT r2.id FROM "communication_sms_campaign_recipients" r2
        JOIN "communication_sms_campaigns" c ON c.id = r2."campaignId"
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
    return this.prisma.communicationSmsCampaignRecipient.findMany({ where: { id: { in: rows.map((r) => r.id) }, claimToken: token } });
  }

  private async processRecipient(recipient: CommunicationSmsCampaignRecipient): Promise<void> {
    const campaign = await this.prisma.communicationSmsCampaign.findUnique({ where: { id: recipient.campaignId }, select: { id: true, status: true } });
    if (!campaign || campaign.status === "CANCELLED") {
      await this.markRecipientCancelled(recipient.id, "CAMPAIGN_CANCELLED");
      return;
    }

    // SECOND eligibility check immediately before the provider call — a recipient
    // who texted STOP after queueing must NOT be sent to.
    const eligible = await this.recheckEligibility(recipient.contactId, recipient.phoneSnapshot);
    if (!eligible.ok) {
      await this.prisma.communicationSmsCampaignRecipient.update({
        where: { id: recipient.id },
        data: { deliveryStatus: "CANCELLED", exclusionReason: eligible.reason, cancelledAt: new Date(), claimToken: null, leaseExpiresAt: null },
      });
      return;
    }

    // Mark the exact moment we hand this to the provider — see DeliveryMaintenanceService.
    await this.prisma.communicationSmsCampaignRecipient.update({ where: { id: recipient.id }, data: { dispatchedAt: new Date() } });

    const outcome = await this.transport.sendSms({
      internalMessageId: recipient.internalMessageId,
      to: recipient.phoneSnapshot,
      body: recipient.bodySnapshot,
      statusCallbackUrl: statusCallbackUrl(this.config),
      correlationMetadata: { campaignId: recipient.campaignId },
    });

    const action = classifySendResult(outcome, recipient.attemptCount);
    if (action.kind === "sent" && outcome.ok) {
      await this.markRecipientAccepted(recipient, outcome);
      return;
    }
    await this.applyRecipientFailure(recipient, action, outcome);
  }

  /** Re-run the shared 15A policy against CURRENT consent + suppression. */
  private async recheckEligibility(contactId: string, phone: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const contact = await this.prisma.communicationContact.findUnique({
      where: { id: contactId },
      select: { status: true, normalizedPhoneE164: true, preferences: { where: { channel: "SMS" }, select: { consentStatus: true } } },
    });
    if (!contact || !contact.normalizedPhoneE164) return { ok: false, reason: "NO_PHONE" };
    const suppressed = await this.prisma.communicationSuppression.findFirst({ where: { channel: "SMS", normalizedAddress: phone, active: true }, select: { id: true } });
    const result = evaluateChannelEligibility({
      channel: "SMS",
      archived: contact.status === "ARCHIVED",
      hasAddress: true,
      addressValid: true,
      consentStatus: contact.preferences[0]?.consentStatus ?? "UNKNOWN",
      suppressed: !!suppressed,
    });
    return result.eligible ? { ok: true } : { ok: false, reason: result.reasons[0] ?? "INELIGIBLE" };
  }

  private async markRecipientAccepted(recipient: CommunicationSmsCampaignRecipient, outcome: Extract<SmsSendOutcome, { ok: true }>): Promise<void> {
    const businessNumber = outcome.fromNumber ?? null;
    // Reuse/create the SMS conversation for this contact + business number.
    const conversation = await this.conversations.findOrCreate(recipient.contactId, businessNumber, { originSmsCampaignId: recipient.campaignId });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const message = await tx.communicationMessage.create({
        data: {
          conversationId: conversation.id,
          channel: "SMS",
          direction: "OUTBOUND",
          status: "ACCEPTED",
          textBody: recipient.bodySnapshot,
          previewText: recipient.bodySnapshot.slice(0, 160),
          fromAddress: businessNumber,
          toAddress: recipient.phoneSnapshot,
          providerMessageId: outcome.providerMessageId,
          encoding: recipient.encodingSnapshot,
          segmentCount: recipient.estimatedSegmentCount,
          providerSegmentCount: outcome.providerSegmentCount ?? null,
          sentAt: now,
        },
      });
      await tx.communicationSmsCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: "ACCEPTED",
          sentAt: now,
          providerMessageId: outcome.providerMessageId,
          actualFromNumber: businessNumber,
          providerSegmentCount: outcome.providerSegmentCount ?? null,
          attemptCount: { increment: 1 },
          claimToken: null,
          leaseExpiresAt: null,
          conversationId: conversation.id,
          messageId: message.id,
          lastErrorCode: null,
          lastErrorMessageSafe: null,
        },
      });
      await tx.communicationConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now, lastOutboundAt: now, latestDirection: "OUTBOUND", previewText: recipient.bodySnapshot.slice(0, 160), businessNumber: conversation.businessNumber ?? businessNumber },
      });
    });
  }

  private async applyRecipientFailure(recipient: CommunicationSmsCampaignRecipient, action: SendAction, outcome: SmsSendOutcome): Promise<void> {
    // A provider opt-out block is authoritative — synchronize CRM suppression.
    if (!outcome.ok && outcome.classification === "PROVIDER_OPT_OUT_BLOCK") {
      await this.status.applyProviderOptOut(recipient.phoneSnapshot);
    }
    if (action.kind === "unknown") {
      await this.prisma.communicationSmsCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "DELIVERY_UNKNOWN", attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    if (action.kind === "retry") {
      await this.prisma.communicationSmsCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "QUEUED", queuedAt: new Date(Date.now() + action.backoffMs), attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
      return;
    }
    if (action.kind === "failed") {
      await this.prisma.communicationSmsCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "FAILED", failedAt: new Date(), attemptCount: action.attempt, claimToken: null, leaseExpiresAt: null, lastErrorCode: action.code, lastErrorMessageSafe: action.message } });
    }
  }

  private async markRecipientCancelled(recipientId: string, reason: string): Promise<void> {
    await this.prisma.communicationSmsCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "CANCELLED", exclusionReason: reason, cancelledAt: new Date(), claimToken: null, leaseExpiresAt: null } });
  }

  /** Finalize once nothing remains QUEUED/PROCESSING. */
  async updateCampaignCompletion(campaignId: string): Promise<void> {
    const pending = await this.prisma.communicationSmsCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["QUEUED", "PROCESSING"] } } });
    if (pending > 0) return;
    const campaign = await this.prisma.communicationSmsCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign || campaign.status === "CANCELLED" || campaign.status === "COMPLETED" || campaign.status === "PARTIALLY_FAILED") return;
    const bad = await this.prisma.communicationSmsCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["FAILED", "UNDELIVERED", "DELIVERY_UNKNOWN"] } } });
    await this.prisma.communicationSmsCampaign.update({ where: { id: campaignId }, data: { status: bad > 0 ? "PARTIALLY_FAILED" : "COMPLETED", completedAt: new Date() } });
  }

  // ===========================================================================
  // Direct SMS reply outbox — same claim + classify policy
  // ===========================================================================
  async runRepliesOnce(): Promise<number> {
    const batchSize = this.config.get("smsDispatchBatchSize", { infer: true });
    const concurrency = this.config.get("smsDispatchConcurrency", { infer: true });
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
        WHERE m2."direction" = 'OUTBOUND' AND m2."status" = 'QUEUED' AND m2."channel" = 'SMS'
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
    const conversation = await this.prisma.communicationConversation.findUnique({ where: { id: message.conversationId }, select: { id: true, contactId: true, businessNumber: true } });
    if (!conversation) {
      await this.applyReplyFailure(message.id, { kind: "failed", attempt: message.attemptCount + 1, code: "NO_CONVERSATION", message: "Conversation missing." });
      return;
    }
    const to = message.toAddress;
    if (!to) {
      await this.applyReplyFailure(message.id, { kind: "failed", attempt: message.attemptCount + 1, code: "NO_RECIPIENT", message: "The contact has no valid phone number." });
      return;
    }

    // STOP / suppression always blocks an outgoing SMS, including a human reply.
    const blocked = await this.prisma.communicationSuppression.findFirst({ where: { channel: "SMS", normalizedAddress: to, active: true }, select: { id: true } });
    if (blocked) {
      await this.applyReplyFailure(message.id, { kind: "failed", attempt: message.attemptCount + 1, code: "SMS_SUPPRESSED", message: "This number has opted out of SMS." });
      return;
    }

    await this.prisma.communicationMessage.update({ where: { id: message.id }, data: { dispatchedAt: new Date() } });
    const outcome = await this.transport.sendSms({
      internalMessageId: message.id,
      to,
      body: message.textBody ?? "",
      statusCallbackUrl: statusCallbackUrl(this.config),
      correlationMetadata: { conversationId: conversation.id },
    });

    const action = classifySendResult(outcome, message.attemptCount);
    if (action.kind === "sent" && outcome.ok) {
      const now = new Date();
      const info = calculateSegments(message.textBody ?? "");
      await this.prisma.$transaction(async (tx) => {
        await tx.communicationMessage.update({
          where: { id: message.id },
          data: {
            status: "ACCEPTED",
            providerMessageId: outcome.providerMessageId,
            fromAddress: outcome.fromNumber ?? message.fromAddress,
            encoding: info.encoding,
            segmentCount: info.segmentCount,
            providerSegmentCount: outcome.providerSegmentCount ?? null,
            sentAt: now,
            attemptCount: { increment: 1 },
            claimToken: null,
            leaseExpiresAt: null,
            lastErrorCode: null,
            lastErrorMessageSafe: null,
          },
        });
        await tx.communicationConversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: now, lastOutboundAt: now, latestDirection: "OUTBOUND", previewText: message.previewText ?? undefined, businessNumber: conversation.businessNumber ?? outcome.fromNumber ?? null },
        });
      });
      return;
    }
    if (!outcome.ok && outcome.classification === "PROVIDER_OPT_OUT_BLOCK") {
      await this.status.applyProviderOptOut(to);
    }
    await this.applyReplyFailure(message.id, action);
  }

  private async applyReplyFailure(messageId: string, action: SendAction): Promise<void> {
    if (action.kind === "sent") return;
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

  private async pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let i = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await fn(items[idx]!);
        } catch (err) {
          this.logger.error(`SMS send crashed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    });
    await Promise.all(workers);
  }
}
