import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type CommunicationEmailCampaignRecipient } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "../providers/email-transport";
import { evaluateChannelEligibility } from "../eligibility";
import { renderForRecipient } from "./email-compiler";
import { generateUnsubscribeToken, resolveSender, unsubscribeUrl } from "./email-config";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;

/**
 * Communications-specific email delivery worker (NOT a generic automation
 * engine — it only moves CommunicationEmailCampaignRecipient rows through
 * delivery). Postgres-backed queue with FOR UPDATE SKIP LOCKED claiming so
 * multiple backend instances never send the same recipient twice.
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

  /** One poll cycle; guarded so overlapping timers never run concurrently. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(`Dispatch tick failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }

  /** Claim + process a single batch. Returns how many were processed (tests call this). */
  async runOnce(): Promise<number> {
    const batchSize = this.config.get("emailDispatchBatchSize", { infer: true });
    const concurrency = this.config.get("emailDispatchConcurrency", { infer: true });
    const claimed = await this.claim(batchSize);
    if (claimed.length === 0) return 0;

    // Mark the parent campaigns SENDING on first processing.
    const campaignIds = [...new Set(claimed.map((r) => r.campaignId))];
    await this.prisma.communicationEmailCampaign.updateMany({ where: { id: { in: campaignIds }, status: "QUEUED" }, data: { status: "SENDING", startedAt: new Date() } });

    await this.pool(claimed, concurrency, (r) => this.processRecipient(r));
    for (const id of campaignIds) await this.updateCampaignCompletion(id);
    return claimed.length;
  }

  /** Atomically claim QUEUED, due recipients of active campaigns (multi-instance safe). */
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
      await this.markCancelled(recipient.id, "CAMPAIGN_CANCELLED");
      return;
    }

    // SECOND eligibility check at send time — the contact may have opted out since queue.
    const contact = await this.prisma.communicationContact.findUnique({
      where: { id: recipient.contactId },
      select: { id: true, status: true, normalizedEmail: true, unsubscribeToken: true, firstName: true, lastName: true, organizationName: true, email: true, preferences: { where: { channel: "EMAIL" }, select: { consentStatus: true } } },
    });
    if (!contact || !contact.normalizedEmail) {
      await this.markCancelled(recipient.id, "NO_EMAIL");
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
      // If they unsubscribed/were suppressed, reflect it; otherwise cancel this recipient.
      const status = reason === "OPTED_OUT" || reason === "SUPPRESSED" ? "UNSUBSCRIBED" : "CANCELLED";
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: status, exclusionReason: reason, cancelledAt: new Date(), claimToken: null } });
      return;
    }

    // Ensure an opaque unsubscribe token exists for this contact.
    let token = contact.unsubscribeToken;
    if (!token) {
      token = generateUnsubscribeToken();
      await this.prisma.communicationContact.update({ where: { id: contact.id }, data: { unsubscribeToken: token } });
    }
    const unsub = unsubscribeUrl(this.config, token);
    const rendered = renderForRecipient({ html: campaign.htmlSnapshot, text: campaign.textSnapshot ?? "" }, { firstName: contact.firstName, lastName: contact.lastName, organizationName: contact.organizationName, email: contact.email }, unsub);
    const sender = resolveSender(this.config);

    const outcome = await this.transport.sendEmail({
      internalMessageId: recipient.internalMessageId,
      to: recipient.emailSnapshot,
      toName: [recipient.firstNameSnapshot, recipient.lastNameSnapshot].filter(Boolean).join(" ") || undefined,
      senderEmail: campaign.senderEmail ?? sender.email,
      senderName: campaign.senderName ?? sender.name,
      subject: campaign.subjectSnapshot ?? "",
      html: rendered.html,
      text: rendered.text,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [`campaign:${campaign.id}`],
    });

    if (outcome.ok) {
      await this.markSent(recipient, campaign.id, campaign.subjectSnapshot ?? "", rendered.html, rendered.text, outcome.providerMessageId);
      return;
    }
    await this.handleFailure(recipient, outcome);
  }

  private async markSent(recipient: CommunicationEmailCampaignRecipient, campaignId: string, subject: string, html: string, text: string, providerMessageId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // First outbound message in this contact's email thread (15C reads/extends it).
      const conversation = await tx.communicationConversation.create({ data: { contactId: recipient.contactId, channel: "EMAIL", subject, lastMessageAt: new Date() } });
      const message = await tx.communicationMessage.create({
        data: { conversationId: conversation.id, channel: "EMAIL", direction: "OUTBOUND", status: "SENT", subject, htmlBody: html, textBody: text, messageId: recipient.internalMessageId, providerMessageId, sentAt: new Date() },
      });
      await tx.communicationEmailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { deliveryStatus: "SENT", sentAt: new Date(), providerMessageId, attemptCount: { increment: 1 }, claimToken: null, leaseExpiresAt: null, conversationId: conversation.id, messageId: message.id, lastErrorCode: null, lastErrorMessageSafe: null },
      });
    });
  }

  private async handleFailure(recipient: CommunicationEmailCampaignRecipient, outcome: Extract<Awaited<ReturnType<EmailTransport["sendEmail"]>>, { ok: false }>): Promise<void> {
    const attempts = recipient.attemptCount + 1;
    if (outcome.classification === "AMBIGUOUS") {
      // Never blind-retry: the provider may have accepted. Flag for manual review.
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "DELIVERY_UNKNOWN", attemptCount: attempts, claimToken: null, leaseExpiresAt: null, lastErrorCode: outcome.code, lastErrorMessageSafe: outcome.message } });
      return;
    }
    const retryable = outcome.classification === "RATE_LIMIT" || outcome.classification === "TEMPORARY";
    if (retryable && attempts < MAX_ATTEMPTS) {
      const backoffMs = outcome.retryAfterMs ?? 5_000 * attempts;
      await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "QUEUED", queuedAt: new Date(Date.now() + backoffMs), attemptCount: attempts, claimToken: null, leaseExpiresAt: null, lastErrorCode: outcome.code, lastErrorMessageSafe: outcome.message } });
      return;
    }
    await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "FAILED", failedAt: new Date(), attemptCount: attempts, claimToken: null, leaseExpiresAt: null, lastErrorCode: outcome.code, lastErrorMessageSafe: outcome.message } });
  }

  private async markCancelled(recipientId: string, reason: string): Promise<void> {
    await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipientId }, data: { deliveryStatus: "CANCELLED", exclusionReason: reason, cancelledAt: new Date(), claimToken: null, leaseExpiresAt: null } });
  }

  /** Finalize a campaign once no recipients remain QUEUED/PROCESSING. */
  async updateCampaignCompletion(campaignId: string): Promise<void> {
    const pending = await this.prisma.communicationEmailCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["QUEUED", "PROCESSING"] } } });
    if (pending > 0) return;
    const campaign = await this.prisma.communicationEmailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign || campaign.status === "CANCELLED" || campaign.status === "COMPLETED" || campaign.status === "PARTIALLY_FAILED") return;
    const bad = await this.prisma.communicationEmailCampaignRecipient.count({ where: { campaignId, deliveryStatus: { in: ["FAILED", "BOUNCED", "DELIVERY_UNKNOWN"] } } });
    await this.prisma.communicationEmailCampaign.update({ where: { id: campaignId }, data: { status: bad > 0 ? "PARTIALLY_FAILED" : "COMPLETED", completedAt: new Date() } });
  }

  /** Operational dispatch snapshot for the campaign detail / status endpoint. */
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
          await fn(items[idx]);
        } catch (err) {
          this.logger.error(`Recipient send crashed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    });
    await Promise.all(workers);
  }
}
