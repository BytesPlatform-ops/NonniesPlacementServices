import { Injectable, Logger } from "@nestjs/common";
import type { CommunicationSmsRecipientStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { SuppressionsService } from "../suppressions/suppressions.service";

/** Twilio outbound message statuses → provider-neutral CRM states. */
export function normalizeTwilioStatus(status: string): CommunicationSmsRecipientStatus | null {
  switch (status.trim().toLowerCase()) {
    case "queued":
      return "QUEUED";
    case "accepted":
    case "sending":
      return "ACCEPTED";
    case "sent":
      return "SENT";
    case "delivered":
      return "DELIVERED";
    case "undelivered":
      return "UNDELIVERED";
    case "failed":
      return "FAILED";
    default:
      return null; // scheduled / read / canceled etc. are not meaningful here
  }
}

/**
 * Monotonic ranking so out-of-order provider callbacks can never regress state:
 * a late "sent" must not overwrite "delivered". DELIVERY_UNKNOWN ranks low on
 * purpose — a later authoritative callback SHOULD resolve an ambiguous send.
 * CANCELLED/EXCLUDED rank highest: we never sent, so nothing may overwrite them.
 */
const RANK: Record<CommunicationSmsRecipientStatus, number> = {
  QUEUED: 0,
  PROCESSING: 1,
  DELIVERY_UNKNOWN: 2,
  ACCEPTED: 3,
  SENT: 4,
  UNDELIVERED: 5,
  FAILED: 5,
  DELIVERED: 6,
  CANCELLED: 9,
  EXCLUDED: 9,
};

export function isForwardTransition(current: CommunicationSmsRecipientStatus, next: CommunicationSmsRecipientStatus): boolean {
  return RANK[next] > RANK[current];
}

/** Twilio: the recipient replied STOP; we are blocked until they text START. */
const ERROR_OPTED_OUT = "21610";

export interface NormalizedSmsStatus {
  providerMessageId: string;
  status: CommunicationSmsRecipientStatus;
  errorCode?: string;
  errorMessageSafe?: string;
  occurredAt?: Date;
}

@Injectable()
export class SmsStatusService {
  private readonly logger = new Logger("SmsStatus");

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionsService,
  ) {}

  /**
   * Apply one delivery status callback. Idempotent by construction: a repeated or
   * out-of-order callback fails the forward-transition check and becomes a no-op,
   * so no duplicate history or audit noise is produced.
   */
  async apply(input: NormalizedSmsStatus): Promise<{ applied: boolean }> {
    const [recipient, message] = await Promise.all([
      this.prisma.communicationSmsCampaignRecipient.findFirst({ where: { providerMessageId: input.providerMessageId }, orderBy: { createdAt: "desc" } }),
      this.prisma.communicationMessage.findFirst({ where: { providerMessageId: input.providerMessageId, channel: "SMS", direction: "OUTBOUND" }, orderBy: { createdAt: "desc" } }),
    ]);
    if (!recipient && !message) {
      this.logger.warn(`SMS status ${input.status} for an unknown provider message id.`);
      return { applied: false };
    }

    const now = input.occurredAt ?? new Date();
    let applied = false;

    if (recipient && isForwardTransition(recipient.deliveryStatus, input.status)) {
      await this.prisma.communicationSmsCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: input.status,
          sentAt: input.status === "SENT" ? (recipient.sentAt ?? now) : recipient.sentAt,
          deliveredAt: input.status === "DELIVERED" ? now : recipient.deliveredAt,
          undeliveredAt: input.status === "UNDELIVERED" ? now : recipient.undeliveredAt,
          failedAt: input.status === "FAILED" ? now : recipient.failedAt,
          lastErrorCode: input.errorCode ?? recipient.lastErrorCode,
          lastErrorMessageSafe: input.errorMessageSafe ?? recipient.lastErrorMessageSafe,
        },
      });
      applied = true;
    }

    if (message) {
      const messageStatus = this.toMessageStatus(input.status);
      if (messageStatus && this.messageMovesForward(message.status, input.status)) {
        await this.prisma.communicationMessage.update({
          where: { id: message.id },
          data: {
            status: messageStatus,
            deliveredAt: input.status === "DELIVERED" ? now : message.deliveredAt,
            undeliveredAt: input.status === "UNDELIVERED" ? now : message.undeliveredAt,
            lastErrorCode: input.errorCode ?? message.lastErrorCode,
            lastErrorMessageSafe: input.errorMessageSafe ?? message.lastErrorMessageSafe,
          },
        });
        applied = true;
      }
    }

    // A provider opt-out block is documented, authoritative opt-out semantics —
    // synchronize CRM suppression + consent so nothing else is sent to that number.
    if (input.errorCode === ERROR_OPTED_OUT) {
      const phone = recipient?.phoneSnapshot ?? message?.toAddress ?? null;
      if (phone) await this.applyProviderOptOut(phone);
    }
    return { applied };
  }

  /** Suppress + opt out a number the provider reports as blocked (Twilio 21610). */
  async applyProviderOptOut(normalizedPhone: string): Promise<void> {
    await this.suppressions.suppressSystem("SMS", normalizedPhone, "USER_OPT_OUT", "sms-provider-opt-out");
    const contact = await this.prisma.communicationContact.findFirst({ where: { normalizedPhoneE164: normalizedPhone }, select: { id: true } });
    if (!contact) return;
    await this.prisma.contactChannelPreference.upsert({
      where: { contactId_channel: { contactId: contact.id, channel: "SMS" } },
      create: { contactId: contact.id, channel: "SMS", consentStatus: "OPTED_OUT", optOutAt: new Date(), consentSource: "PROVIDER_OPT_OUT" },
      update: { consentStatus: "OPTED_OUT", optOutAt: new Date(), consentSource: "PROVIDER_OPT_OUT" },
    });
  }

  private toMessageStatus(status: CommunicationSmsRecipientStatus): "ACCEPTED" | "SENT" | "DELIVERED" | "UNDELIVERED" | "FAILED" | null {
    switch (status) {
      case "ACCEPTED":
        return "ACCEPTED";
      case "SENT":
        return "SENT";
      case "DELIVERED":
        return "DELIVERED";
      case "UNDELIVERED":
        return "UNDELIVERED";
      case "FAILED":
        return "FAILED";
      default:
        return null;
    }
  }

  /** Map the message's own status onto the recipient rank scale to compare safely. */
  private messageMovesForward(current: string, next: CommunicationSmsRecipientStatus): boolean {
    const asRecipient: Record<string, CommunicationSmsRecipientStatus> = {
      QUEUED: "QUEUED",
      PROCESSING: "PROCESSING",
      ACCEPTED: "ACCEPTED",
      SENT: "SENT",
      DELIVERED: "DELIVERED",
      UNDELIVERED: "UNDELIVERED",
      FAILED: "FAILED",
      DELIVERY_UNKNOWN: "DELIVERY_UNKNOWN",
    };
    const mapped = asRecipient[current];
    return mapped ? isForwardTransition(mapped, next) : true;
  }
}
