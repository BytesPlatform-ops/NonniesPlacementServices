import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { MAX_SEND_ATTEMPTS } from "./send-outcome";

export interface MaintenanceResult {
  requeued: number;
  markedUnknown: number;
  exhausted: number;
  campaignsFinalized: number;
}

const SAFE_MESSAGE = "A worker stopped before this message reached the provider; it was safely re-queued.";
const AMBIGUOUS_MESSAGE = "A worker stopped after the message was handed to the provider. Delivery is uncertain, so it was NOT resent.";
const EXHAUSTED_MESSAGE = "Recovery attempts were exhausted without reaching the provider.";

/**
 * Delivery-queue maintenance shared by the email and SMS dispatchers. This is
 * queue recovery, NOT a workflow-automation engine: it only repairs rows a crashed
 * worker left behind and finalizes campaigns whose recipients are all terminal.
 *
 * CRASH SAFETY — the central rule. `dispatchedAt` is stamped immediately BEFORE the
 * provider call, so an expired lease is unambiguous:
 *   - dispatchedAt IS NULL      → the worker died before the provider saw anything,
 *                                 so re-queueing cannot duplicate a message.
 *   - dispatchedAt IS NOT NULL  → the provider may have accepted it. We can never
 *                                 know, so it becomes DELIVERY_UNKNOWN for human
 *                                 review and is NEVER automatically resent.
 * Rows already in DELIVERY_UNKNOWN are never touched, and a repeatedly-crashing row
 * exhausts the shared attempt cap instead of looping forever.
 */
@Injectable()
export class DeliveryMaintenanceService {
  private readonly logger = new Logger("DeliveryMaintenance");

  constructor(private readonly prisma: PrismaService) {}

  async runMaintenance(): Promise<MaintenanceResult> {
    const [recovery, campaignsFinalized] = await Promise.all([this.recoverExpiredLeases(), this.reconcileCampaigns()]);
    if (recovery.requeued || recovery.markedUnknown || recovery.exhausted || campaignsFinalized) {
      this.logger.warn(`Delivery maintenance: requeued=${recovery.requeued} unknown=${recovery.markedUnknown} exhausted=${recovery.exhausted} campaignsFinalized=${campaignsFinalized}`);
    }
    return { ...recovery, campaignsFinalized };
  }

  /** Repair rows whose PROCESSING lease expired because a worker died. */
  async recoverExpiredLeases(): Promise<{ requeued: number; markedUnknown: number; exhausted: number }> {
    const max = MAX_SEND_ATTEMPTS;

    // 1) Dispatched but unresolved → ambiguous. Never resent automatically.
    const unknownEmail = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_email_campaign_recipients"
      SET "deliveryStatus" = 'DELIVERY_UNKNOWN', "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_EXPIRED_AFTER_DISPATCH', "lastErrorMessageSafe" = ${AMBIGUOUS_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NOT NULL
    `);
    const unknownSms = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_sms_campaign_recipients"
      SET "deliveryStatus" = 'DELIVERY_UNKNOWN', "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_EXPIRED_AFTER_DISPATCH', "lastErrorMessageSafe" = ${AMBIGUOUS_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NOT NULL
    `);
    const unknownMessages = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_messages"
      SET "status" = 'DELIVERY_UNKNOWN', "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_EXPIRED_AFTER_DISPATCH', "lastErrorMessageSafe" = ${AMBIGUOUS_MESSAGE}, "updatedAt" = now()
      WHERE "direction" = 'OUTBOUND' AND "status" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NOT NULL
    `);

    // 2) Never dispatched and still under the attempt cap → safe to re-queue exactly once more.
    const requeuedEmail = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_email_campaign_recipients"
      SET "deliveryStatus" = 'QUEUED', "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "queuedAt" = now(), "lastErrorCode" = 'LEASE_RECOVERED', "lastErrorMessageSafe" = ${SAFE_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 < ${max}
    `);
    const requeuedSms = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_sms_campaign_recipients"
      SET "deliveryStatus" = 'QUEUED', "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "queuedAt" = now(), "lastErrorCode" = 'LEASE_RECOVERED', "lastErrorMessageSafe" = ${SAFE_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 < ${max}
    `);
    const requeuedMessages = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_messages"
      SET "status" = 'QUEUED', "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "nextAttemptAt" = now(), "lastErrorCode" = 'LEASE_RECOVERED', "lastErrorMessageSafe" = ${SAFE_MESSAGE}, "updatedAt" = now()
      WHERE "direction" = 'OUTBOUND' AND "status" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 < ${max}
    `);

    // 3) Never dispatched but out of attempts → terminal failure, not an endless loop.
    const exhaustedEmail = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_email_campaign_recipients"
      SET "deliveryStatus" = 'FAILED', "failedAt" = now(), "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_RECOVERY_EXHAUSTED', "lastErrorMessageSafe" = ${EXHAUSTED_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 >= ${max}
    `);
    const exhaustedSms = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_sms_campaign_recipients"
      SET "deliveryStatus" = 'FAILED', "failedAt" = now(), "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_RECOVERY_EXHAUSTED', "lastErrorMessageSafe" = ${EXHAUSTED_MESSAGE}, "updatedAt" = now()
      WHERE "deliveryStatus" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 >= ${max}
    `);
    const exhaustedMessages = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_messages"
      SET "status" = 'FAILED', "attemptCount" = "attemptCount" + 1, "claimToken" = NULL, "leaseExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_RECOVERY_EXHAUSTED', "lastErrorMessageSafe" = ${EXHAUSTED_MESSAGE}, "updatedAt" = now()
      WHERE "direction" = 'OUTBOUND' AND "status" = 'PROCESSING' AND "leaseExpiresAt" < now() AND "dispatchedAt" IS NULL AND "attemptCount" + 1 >= ${max}
    `);

    return {
      requeued: requeuedEmail + requeuedSms + requeuedMessages,
      markedUnknown: unknownEmail + unknownSms + unknownMessages,
      exhausted: exhaustedEmail + exhaustedSms + exhaustedMessages,
    };
  }

  /**
   * Finalize campaigns whose recipients are all terminal. Without this a campaign
   * could stay SENDING forever if a worker restarted between the last send and its
   * completion check. PARTIALLY_FAILED when anything failed/bounced/undelivered or
   * is delivery-unknown; COMPLETED otherwise.
   */
  async reconcileCampaigns(): Promise<number> {
    const email = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_email_campaigns" c
      SET status = (CASE WHEN EXISTS (
              SELECT 1 FROM "communication_email_campaign_recipients" r
              WHERE r."campaignId" = c.id AND r."deliveryStatus" IN ('FAILED', 'BOUNCED', 'DELIVERY_UNKNOWN')
            ) THEN 'PARTIALLY_FAILED' ELSE 'COMPLETED' END)::"CommunicationEmailCampaignStatus",
          "completedAt" = now(), "updatedAt" = now()
      WHERE c.status IN ('QUEUED', 'SENDING')
        AND EXISTS (SELECT 1 FROM "communication_email_campaign_recipients" r WHERE r."campaignId" = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM "communication_email_campaign_recipients" r
          WHERE r."campaignId" = c.id AND r."deliveryStatus" IN ('QUEUED', 'PROCESSING')
        )
    `);
    const sms = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "communication_sms_campaigns" c
      SET status = (CASE WHEN EXISTS (
              SELECT 1 FROM "communication_sms_campaign_recipients" r
              WHERE r."campaignId" = c.id AND r."deliveryStatus" IN ('FAILED', 'UNDELIVERED', 'DELIVERY_UNKNOWN')
            ) THEN 'PARTIALLY_FAILED' ELSE 'COMPLETED' END)::"CommunicationSmsCampaignStatus",
          "completedAt" = now(), "updatedAt" = now()
      WHERE c.status IN ('QUEUED', 'SENDING')
        AND EXISTS (SELECT 1 FROM "communication_sms_campaign_recipients" r WHERE r."campaignId" = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM "communication_sms_campaign_recipients" r
          WHERE r."campaignId" = c.id AND r."deliveryStatus" IN ('QUEUED', 'PROCESSING')
        )
    `);
    return email + sms;
  }
}
