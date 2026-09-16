import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type CommunicationInboundReviewReason } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { SuppressionsService } from "../suppressions/suppressions.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { NotificationAudienceService } from "../../notifications/notification-audience.service";
import { NOTIFICATION_TYPES, ROUTES, eventKey } from "../../notifications/notification-catalog";
import { PERMISSIONS } from "../../../common/rbac";
import { normalizePhoneE164 } from "../normalization";
import type { InboundOptOutType, NormalizedInboundSms } from "../providers/sms-inbound-adapter";
import { SmsConversationService } from "./sms-conversation.service";
import { classifyKeywordFallback } from "./sms-keywords";

const FUTURE_TOLERANCE_MS = 5 * 60_000;

export type InboundSmsResult =
  | { status: "linked"; conversationId: string; optOutType?: InboundOptOutType }
  | { status: "review"; reason: CommunicationInboundReviewReason }
  | { status: "duplicate" }
  | { status: "ignored" };

/**
 * Inbound SMS ingestion. Correlation is deterministic on the contact's normalized
 * E.164 number (never message text). Unknown numbers are safely quarantined for
 * human review — a stranger texting the business number NEVER becomes a contact.
 *
 * STOP / START / HELP are handled from the provider's authoritative classification
 * where available. Twilio has already sent its own confirmation reply in that case,
 * so the CRM never sends a duplicate response, and this service never emits TwiML.
 */
@Injectable()
export class InboundSmsService {
  private readonly logger = new Logger("InboundSms");

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: SmsConversationService,
    private readonly suppressions: SuppressionsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly audience: NotificationAudienceService,
  ) {}

  async ingest(input: NormalizedInboundSms): Promise<InboundSmsResult> {
    if (!input.providerMessageId || !input.fromPhone) return { status: "ignored" };

    // Idempotency: Twilio may retry the same MessageSid.
    if (await this.alreadyProcessed(input.providerMessageId)) return { status: "duplicate" };

    const fromPhone = normalizePhoneE164(input.fromPhone, "US");
    const toPhone = normalizePhoneE164(input.toPhone, "US");
    if (!fromPhone || !toPhone) {
      await this.quarantine(input, "INVALID_PROVIDER_PAYLOAD");
      return { status: "review", reason: "INVALID_PROVIDER_PAYLOAD" };
    }

    const contacts = await this.prisma.communicationContact.findMany({ where: { normalizedPhoneE164: fromPhone }, select: { id: true } });
    if (contacts.length === 0) {
      await this.quarantine(input, "UNKNOWN_PHONE");
      return { status: "review", reason: "UNKNOWN_PHONE" };
    }
    if (contacts.length > 1) {
      await this.quarantine(input, "PHONE_CONFLICT");
      return { status: "review", reason: "PHONE_CONFLICT" };
    }
    const contactId = contacts[0]!.id;

    // Provider classification wins; the keyword fallback is a conservative backstop.
    const optOutType = input.optOutType ?? classifyKeywordFallback(input.body);
    if (optOutType) await this.applyOptOutEvent(contactId, fromPhone, optOutType);

    const conversationId = await this.appendInboundMessage(contactId, fromPhone, toPhone, input, optOutType);
    if (!conversationId) return { status: "duplicate" };
    // A STOP/START/HELP keyword is machine traffic, not a person waiting for a
    // reply, so it never raises a notification.
    if (!optOutType) await this.notifyInbound(conversationId, contactId, fromPhone, input);
    return { status: "linked", conversationId, optOutType };
  }

  // --- opt-in / opt-out ------------------------------------------------------
  /**
   * STOP  → consent OPTED_OUT + an active USER_OPT_OUT suppression (blocks bulk AND
   *         direct sending immediately).
   * START → releases ONLY the USER_OPT_OUT suppression and restores consent, with a
   *         traceable audit trail. Never clears ADMIN_BLOCK or other reasons.
   * HELP  → recorded only; consent is untouched.
   */
  private async applyOptOutEvent(contactId: string, phone: string, type: InboundOptOutType): Promise<void> {
    const now = new Date();
    if (type === "STOP") {
      await this.suppressions.suppressSystem("SMS", phone, "USER_OPT_OUT", "sms-inbound-stop");
      await this.prisma.contactChannelPreference.upsert({
        where: { contactId_channel: { contactId, channel: "SMS" } },
        create: { contactId, channel: "SMS", consentStatus: "OPTED_OUT", optOutAt: now, consentSource: "SMS_STOP" },
        update: { consentStatus: "OPTED_OUT", optOutAt: now, consentSource: "SMS_STOP" },
      });
      await this.audit.record({ action: "communication.sms.opted_out", entityType: "CommunicationContact", entityId: contactId, actorRef: "system:sms-inbound-stop", metadata: { channel: "SMS" } });
      return;
    }
    if (type === "START") {
      await this.suppressions.releaseSystem("SMS", phone, ["USER_OPT_OUT"], "sms-inbound-start");
      await this.prisma.contactChannelPreference.upsert({
        where: { contactId_channel: { contactId, channel: "SMS" } },
        create: { contactId, channel: "SMS", consentStatus: "OPTED_IN", consentAt: now, consentSource: "TWILIO_START" },
        update: { consentStatus: "OPTED_IN", consentAt: now, optOutAt: null, consentSource: "TWILIO_START" },
      });
      // Re-opt-in must be traceable — never a silent state change.
      await this.audit.record({ action: "communication.sms.opted_in", entityType: "CommunicationContact", entityId: contactId, actorRef: "system:sms-inbound-start", metadata: { channel: "SMS", source: "TWILIO_START" } });
      return;
    }
    // HELP: provider already answered; record nothing beyond the stored message.
  }

  /**
   * Tell the people who staff the inbox that a contact replied.
   *
   * Entirely best-effort: a notification failure must never roll back an inbound
   * message that has already been stored, and must never make the webhook answer
   * non-2xx, which would make Twilio redeliver a message we already hold.
   *
   * The audience is derived from the permission that actually governs the inbox,
   * so it follows the role definitions rather than a second, drifting list. The
   * event key is the provider message id, so webhook retries and any future
   * reprocessing collapse onto one notification.
   */
  private async notifyInbound(conversationId: string, contactId: string, fromPhone: string, input: NormalizedInboundSms): Promise<void> {
    try {
      const recipients = await this.audience.platformUsers(PERMISSIONS.COMMUNICATIONS_READ);
      if (recipients.length === 0) return;

      const contact = await this.prisma.communicationContact.findUnique({
        where: { id: contactId },
        select: { firstName: true, lastName: true },
      });
      const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim() || fromPhone;
      const preview = (input.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140);

      await this.notifications.raise({
        type: NOTIFICATION_TYPES.INBOUND_SMS_RECEIVED,
        title: "New message",
        message: preview ? `${name}: ${preview}` : `${name} sent a message.`,
        recipientUserIds: recipients,
        eventKey: eventKey(NOTIFICATION_TYPES.INBOUND_SMS_RECEIVED, input.providerMessageId),
        route: ROUTES.inboxConversation(conversationId),
        entityType: "CommunicationConversation",
        entityId: conversationId,
      });
    } catch (err) {
      this.logger.error(`Inbound SMS stored, but its notification could not be raised: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // --- persistence -----------------------------------------------------------
  private async alreadyProcessed(providerMessageId: string): Promise<boolean> {
    const [msg, review] = await Promise.all([
      this.prisma.communicationMessage.findUnique({ where: { providerInboundId: providerMessageId }, select: { id: true } }),
      this.prisma.communicationInboundEmailReview.findUnique({ where: { providerInboundId: providerMessageId }, select: { id: true } }),
    ]);
    return !!msg || !!review;
  }

  private async appendInboundMessage(contactId: string, fromPhone: string, toPhone: string, input: NormalizedInboundSms, optOutType?: InboundOptOutType): Promise<string | null> {
    const conversation = await this.conversations.findOrCreate(contactId, toPhone);
    const receivedAt = this.trustedReceivedAt(input.receivedAt);
    // MMS is out of scope for this phase: media is never fetched or stored, only noted.
    const body = input.numMedia > 0 ? `${input.body}${input.body ? "\n\n" : ""}[${input.numMedia} media attachment${input.numMedia > 1 ? "s" : ""} received — media is not stored]` : input.body;
    const preview = body.replace(/\s+/g, " ").trim().slice(0, 160);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.communicationMessage.create({
          data: {
            conversationId: conversation.id,
            channel: "SMS",
            direction: "INBOUND",
            status: "RECEIVED",
            textBody: body,
            previewText: preview,
            fromAddress: fromPhone,
            toAddress: toPhone,
            providerInboundId: input.providerMessageId,
            smsOptOutType: optOutType ?? null,
            receivedAt,
          },
        });
        await tx.communicationConversation.update({
          where: { id: conversation.id },
          data: {
            // A new inbound message reopens an archived conversation.
            status: conversation.status === "ARCHIVED" ? "OPEN" : conversation.status,
            archivedAt: conversation.status === "ARCHIVED" ? null : conversation.archivedAt,
            lastMessageAt: receivedAt,
            latestDirection: "INBOUND",
            previewText: preview,
            // STOP/START/HELP are system keywords, not a conversation needing a reply.
            lastInboundAt: optOutType ? conversation.lastInboundAt : receivedAt,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // idempotent duplicate
      throw err;
    }
    return conversation.id;
  }

  private async quarantine(input: NormalizedInboundSms, reason: CommunicationInboundReviewReason): Promise<void> {
    const body = (input.body ?? "").slice(0, 2000);
    try {
      await this.prisma.communicationInboundEmailReview.create({
        data: {
          provider: "sms",
          channel: "SMS",
          providerInboundId: input.providerMessageId,
          fromEmail: input.fromPhone,
          toAddress: input.toPhone,
          textBody: body,
          previewText: body.replace(/\s+/g, " ").trim().slice(0, 160),
          receivedAt: this.trustedReceivedAt(input.receivedAt),
          reason,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // duplicate quarantine
      throw err;
    }
  }

  private trustedReceivedAt(provided?: Date): Date {
    const now = new Date();
    if (!provided || Number.isNaN(provided.getTime())) return now;
    return provided.getTime() > now.getTime() + FUTURE_TOLERANCE_MS ? now : provided;
  }
}
