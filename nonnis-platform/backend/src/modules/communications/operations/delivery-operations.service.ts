import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";

export type DeliverySource = "EMAIL_CAMPAIGN" | "EMAIL_REPLY" | "SMS_CAMPAIGN" | "SMS_REPLY";

export interface DeliveryFailureView {
  id: string;
  source: DeliverySource;
  channel: "EMAIL" | "SMS";
  status: string;
  recipient: string | null;
  contactName: string | null;
  contextId: string | null;
  contextName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  occurredAt: string | null;
  retry: RetryEligibility;
}

export interface RetryEligibility {
  allowed: boolean;
  /** True when re-sending could duplicate a message the provider may already have. */
  requiresConfirmation: boolean;
  reason: string;
}

export interface DeliveryFailureFilters {
  channel?: "EMAIL" | "SMS";
  source?: DeliverySource;
  status?: string;
  page: number;
  pageSize: number;
}

/**
 * Provider-neutral error codes that mean "the recipient/message is permanently bad".
 *
 * ATTACHMENT_UNAVAILABLE is deliberately NOT here: a file can be unreadable
 * because object storage was briefly unavailable, and blocking the retry left an
 * operator with a dead message and no way to recover it.
 */
const PERMANENT_CODES = new Set(["HARD_BOUNCE", "PROVIDER_FAILED", "MOCK_BOUNCE", "MOCK_INVALID", "21610", "SMS_SUPPRESSED", "NO_RECIPIENT", "NO_CONVERSATION"]);
/** Codes that mean nothing was ever sent because the provider was misconfigured. */
const CONFIGURATION_CODES = new Set(["AUTH", "NOT_CONFIGURED", "CONFIGURATION", "HTTP_401", "HTTP_403"]);

/**
 * Read-only operational view of communications that need a human. It surfaces ONLY
 * actionable delivery states across all four outboxes (email/SMS × campaign/reply) —
 * never the normal delivered traffic — plus a deterministic, honest retry policy.
 */
@Injectable()
export class DeliveryOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Retry safety. The rule that matters: an ambiguous send may ALREADY have been
   * accepted by the provider, so it is never a quiet one-click resend — the caller
   * must confirm that a duplicate is possible. A permanently-bad recipient is never
   * retryable at all.
   */
  private retryEligibility(status: string, errorCode: string | null): RetryEligibility {
    if (status === "DELIVERY_UNKNOWN") {
      return { allowed: true, requiresConfirmation: true, reason: "The provider may already have accepted this message. Re-sending could deliver it twice." };
    }
    if (status === "BOUNCED" || status === "UNDELIVERED") {
      return { allowed: false, requiresConfirmation: false, reason: "The carrier or mailbox rejected this recipient. Fix the address on the contact instead of retrying." };
    }
    if (errorCode && PERMANENT_CODES.has(errorCode)) {
      return { allowed: false, requiresConfirmation: false, reason: "This failure is permanent for the recipient and will fail again." };
    }
    if (errorCode && CONFIGURATION_CODES.has(errorCode)) {
      return { allowed: true, requiresConfirmation: false, reason: "Nothing was sent — the provider was not configured. Retry once the configuration is corrected." };
    }
    return { allowed: true, requiresConfirmation: false, reason: "This failure was transient and nothing reached the recipient." };
  }

  async list(filters: DeliveryFailureFilters): Promise<{ items: DeliveryFailureView[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const offset = (filters.page - 1) * filters.pageSize;
    const channel = filters.channel ?? null;
    const source = filters.source ?? null;
    const status = filters.status ?? null;

    // One UNION ALL across the four outboxes keeps pagination server-side and honest.
    const base = Prisma.sql`
      SELECT * FROM (
        SELECT r.id::text AS id, 'EMAIL_CAMPAIGN' AS source, 'EMAIL' AS channel, r."deliveryStatus"::text AS status,
               r."emailSnapshot" AS recipient,
               NULLIF(TRIM(CONCAT(COALESCE(r."firstNameSnapshot", ''), ' ', COALESCE(r."lastNameSnapshot", ''))), '') AS "contactName",
               r."campaignId"::text AS "contextId", c.name AS "contextName",
               r."lastErrorCode" AS "errorCode", r."lastErrorMessageSafe" AS "errorMessage",
               r."attemptCount" AS "attemptCount", COALESCE(r."failedAt", r."updatedAt") AS "occurredAt"
        FROM "communication_email_campaign_recipients" r
        JOIN "communication_email_campaigns" c ON c.id = r."campaignId"
        WHERE r."deliveryStatus" IN ('FAILED', 'BOUNCED', 'DELIVERY_UNKNOWN')

        UNION ALL
        SELECT m.id::text, 'EMAIL_REPLY', 'EMAIL', m.status::text,
               m."toAddress",
               NULLIF(TRIM(CONCAT(COALESCE(ct."firstName", ''), ' ', COALESCE(ct."lastName", ''))), ''),
               m."conversationId"::text, NULL,
               m."lastErrorCode", m."lastErrorMessageSafe", m."attemptCount", m."updatedAt"
        FROM "communication_messages" m
        JOIN "communication_conversations" cv ON cv.id = m."conversationId"
        JOIN "communication_contacts" ct ON ct.id = cv."contactId"
        WHERE m.direction = 'OUTBOUND' AND m.channel = 'EMAIL'
          AND m.status IN ('FAILED', 'BOUNCED', 'UNDELIVERED', 'DELIVERY_UNKNOWN')

        UNION ALL
        SELECT r.id::text, 'SMS_CAMPAIGN', 'SMS', r."deliveryStatus"::text,
               r."phoneSnapshot",
               NULLIF(TRIM(CONCAT(COALESCE(r."firstNameSnapshot", ''), ' ', COALESCE(r."lastNameSnapshot", ''))), ''),
               r."campaignId"::text, c.name,
               r."lastErrorCode", r."lastErrorMessageSafe", r."attemptCount", COALESCE(r."failedAt", r."updatedAt")
        FROM "communication_sms_campaign_recipients" r
        JOIN "communication_sms_campaigns" c ON c.id = r."campaignId"
        WHERE r."deliveryStatus" IN ('FAILED', 'UNDELIVERED', 'DELIVERY_UNKNOWN')

        UNION ALL
        SELECT m.id::text, 'SMS_REPLY', 'SMS', m.status::text,
               m."toAddress",
               NULLIF(TRIM(CONCAT(COALESCE(ct."firstName", ''), ' ', COALESCE(ct."lastName", ''))), ''),
               m."conversationId"::text, NULL,
               m."lastErrorCode", m."lastErrorMessageSafe", m."attemptCount", m."updatedAt"
        FROM "communication_messages" m
        JOIN "communication_conversations" cv ON cv.id = m."conversationId"
        JOIN "communication_contacts" ct ON ct.id = cv."contactId"
        WHERE m.direction = 'OUTBOUND' AND m.channel = 'SMS'
          AND m.status IN ('FAILED', 'UNDELIVERED', 'DELIVERY_UNKNOWN')
      ) f
      WHERE (${channel}::text IS NULL OR f.channel = ${channel})
        AND (${source}::text IS NULL OR f.source = ${source})
        AND (${status}::text IS NULL OR f.status = ${status})
    `;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        source: DeliverySource;
        channel: "EMAIL" | "SMS";
        status: string;
        recipient: string | null;
        contactName: string | null;
        contextId: string | null;
        contextName: string | null;
        errorCode: string | null;
        errorMessage: string | null;
        attemptCount: number;
        occurredAt: Date | null;
      }>
    >(Prisma.sql`${base} ORDER BY f."occurredAt" DESC NULLS LAST LIMIT ${filters.pageSize} OFFSET ${offset}`);

    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM (${base}) t`);
    const total = Number(countRows[0]?.count ?? 0n);

    return {
      items: rows.map((r) => ({
        ...r,
        attemptCount: Number(r.attemptCount),
        occurredAt: r.occurredAt ? r.occurredAt.toISOString() : null,
        retry: this.retryEligibility(r.status, r.errorCode),
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    };
  }

  /**
   * Re-queue one failed delivery. The same eligibility rules the list exposes are
   * re-evaluated here — the frontend is never trusted — and an ambiguous send needs
   * an explicit acknowledgement that it may duplicate.
   */
  async retry(user: RequestUser, source: DeliverySource, id: string, acknowledgeDuplicateRisk: boolean): Promise<{ ok: true }> {
    const isCampaign = source === "EMAIL_CAMPAIGN" || source === "SMS_CAMPAIGN";
    const current = isCampaign ? await this.loadRecipient(source, id) : await this.loadMessage(id);
    if (!current) throw new NotFoundException("Delivery record not found");

    const eligibility = this.retryEligibility(current.status, current.errorCode);
    if (!eligibility.allowed) throw new BadRequestException(eligibility.reason);
    if (eligibility.requiresConfirmation && !acknowledgeDuplicateRisk) {
      throw new BadRequestException("This message may already have been delivered. Confirm that a duplicate is acceptable before retrying.");
    }

    const now = new Date();
    if (source === "EMAIL_CAMPAIGN") {
      await this.prisma.$transaction([
        this.prisma.communicationEmailCampaignRecipient.update({
          where: { id },
          data: { deliveryStatus: "QUEUED", queuedAt: now, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, attemptCount: 0, lastErrorCode: null, lastErrorMessageSafe: null },
        }),
        // A finalized campaign must reopen or the dispatcher would never claim the row.
        this.prisma.communicationEmailCampaign.updateMany({ where: { id: current.contextId!, status: { in: ["COMPLETED", "PARTIALLY_FAILED"] } }, data: { status: "SENDING", completedAt: null } }),
      ]);
    } else if (source === "SMS_CAMPAIGN") {
      await this.prisma.$transaction([
        this.prisma.communicationSmsCampaignRecipient.update({
          where: { id },
          data: { deliveryStatus: "QUEUED", queuedAt: now, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, attemptCount: 0, lastErrorCode: null, lastErrorMessageSafe: null },
        }),
        this.prisma.communicationSmsCampaign.updateMany({ where: { id: current.contextId!, status: { in: ["COMPLETED", "PARTIALLY_FAILED"] } }, data: { status: "SENDING", completedAt: null } }),
      ]);
    } else {
      await this.prisma.communicationMessage.update({
        where: { id },
        data: { status: "QUEUED", nextAttemptAt: now, claimToken: null, leaseExpiresAt: null, dispatchedAt: null, attemptCount: 0, lastErrorCode: null, lastErrorMessageSafe: null },
      });
    }

    await this.audit.record({
      action: "communication.delivery.retried",
      entityType: "CommunicationDelivery",
      entityId: id,
      actorUserId: user.id,
      metadata: { source, previousStatus: current.status, acknowledgedDuplicateRisk: eligibility.requiresConfirmation },
    });
    return { ok: true };
  }

  private async loadRecipient(source: DeliverySource, id: string): Promise<{ status: string; errorCode: string | null; contextId: string | null } | null> {
    if (source === "EMAIL_CAMPAIGN") {
      const r = await this.prisma.communicationEmailCampaignRecipient.findUnique({ where: { id }, select: { deliveryStatus: true, lastErrorCode: true, campaignId: true } });
      return r ? { status: r.deliveryStatus, errorCode: r.lastErrorCode, contextId: r.campaignId } : null;
    }
    const r = await this.prisma.communicationSmsCampaignRecipient.findUnique({ where: { id }, select: { deliveryStatus: true, lastErrorCode: true, campaignId: true } });
    return r ? { status: r.deliveryStatus, errorCode: r.lastErrorCode, contextId: r.campaignId } : null;
  }

  private async loadMessage(id: string): Promise<{ status: string; errorCode: string | null; contextId: string | null } | null> {
    const m = await this.prisma.communicationMessage.findUnique({ where: { id }, select: { status: true, lastErrorCode: true, conversationId: true, direction: true } });
    if (!m || m.direction !== "OUTBOUND") return null;
    return { status: m.status, errorCode: m.lastErrorCode, contextId: m.conversationId };
  }
}
