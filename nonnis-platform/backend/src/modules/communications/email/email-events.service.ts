import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type NormalizedEmailEvent } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { SuppressionsService } from "../suppressions/suppressions.service";

/** Map Brevo transactional-webhook event names to provider-neutral types. */
export function normalizeBrevoEvent(event: string): NormalizedEmailEvent | null {
  switch (event) {
    case "delivered":
      return "DELIVERED";
    case "hard_bounce":
      return "BOUNCED_HARD";
    case "soft_bounce":
    case "deferred":
      return "BOUNCED_SOFT";
    case "blocked":
      return "BLOCKED";
    case "spam":
    case "complaint":
      return "COMPLAINT";
    case "unsubscribed":
    case "unsubscribe":
      return "UNSUBSCRIBED";
    case "error":
    case "invalid_email":
      return "FAILED";
    case "request":
    case "sent":
      return "ACCEPTED";
    default:
      return null;
  }
}

export interface NormalizedEventInput {
  providerMessageId: string;
  type: NormalizedEmailEvent;
  occurredAt?: Date;
  dedupKey: string;
}

@Injectable()
export class EmailEventsService {
  private readonly logger = new Logger("EmailEvents");

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionsService,
  ) {}

  /**
   * Apply one normalized event idempotently (retried webhooks are no-ops). A single
   * provider message id maps to either a bulk campaign recipient OR a direct CRM
   * reply message (both carry providerMessageId) — this updates whichever exists, so
   * one delivery-webhook implementation serves both outbound paths.
   */
  async apply(input: NormalizedEventInput): Promise<{ applied: boolean }> {
    const [recipient, message] = input.providerMessageId
      ? await Promise.all([
          this.prisma.communicationEmailCampaignRecipient.findFirst({ where: { providerMessageId: input.providerMessageId }, orderBy: { createdAt: "desc" } }),
          this.prisma.communicationMessage.findFirst({ where: { providerMessageId: input.providerMessageId, direction: "OUTBOUND" }, orderBy: { createdAt: "desc" } }),
        ])
      : [null, null];

    try {
      await this.prisma.communicationEmailEvent.create({
        data: { recipientId: recipient?.id ?? null, providerMessageId: input.providerMessageId, normalizedType: input.type, dedupKey: input.dedupKey, occurredAt: input.occurredAt ?? null },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { applied: false }; // duplicate webhook
      throw err;
    }

    if (!recipient && !message) {
      this.logger.warn(`Email event ${input.type} for unknown provider message id.`);
      return { applied: true };
    }

    // Resolve the affected contact + address from whichever record we have.
    const contactId = recipient?.contactId ?? (message ? (await this.prisma.communicationConversation.findUnique({ where: { id: message.conversationId }, select: { contactId: true } }))?.contactId : undefined);
    const contact = contactId ? await this.prisma.communicationContact.findUnique({ where: { id: contactId }, select: { id: true, normalizedEmail: true } }) : null;
    const address = contact?.normalizedEmail ?? recipient?.emailSnapshot.trim().toLowerCase() ?? message?.toAddress?.trim().toLowerCase() ?? "";
    const now = input.occurredAt ?? new Date();

    const setRecipient = (data: Prisma.CommunicationEmailCampaignRecipientUpdateInput) => (recipient ? this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data }) : Promise.resolve());
    const setMessage = (status: "DELIVERED" | "BOUNCED" | "FAILED", extra?: Partial<Prisma.CommunicationMessageUpdateInput>) => (message ? this.prisma.communicationMessage.update({ where: { id: message.id }, data: { status, ...extra } }) : Promise.resolve());

    switch (input.type) {
      case "DELIVERED":
        await Promise.all([setRecipient({ deliveryStatus: "DELIVERED", deliveredAt: now }), setMessage("DELIVERED", { deliveredAt: now })]);
        break;
      case "BOUNCED_HARD":
        await Promise.all([setRecipient({ deliveryStatus: "BOUNCED", bouncedAt: now, lastErrorCode: "HARD_BOUNCE" }), setMessage("BOUNCED", { lastErrorCode: "HARD_BOUNCE" })]);
        if (address) await this.suppressions.suppressSystem("EMAIL", address, "HARD_BOUNCE", "delivery-webhook");
        break;
      case "COMPLAINT":
        if (address) await this.suppressions.suppressSystem("EMAIL", address, "SPAM_COMPLAINT", "delivery-webhook");
        if (contact) await this.optOut(contact.id, now);
        break;
      case "UNSUBSCRIBED":
        await setRecipient({ deliveryStatus: "UNSUBSCRIBED", unsubscribedAt: now });
        if (address) await this.suppressions.suppressSystem("EMAIL", address, "USER_OPT_OUT", "delivery-webhook");
        if (contact) await this.optOut(contact.id, now);
        break;
      case "FAILED":
        await Promise.all([setRecipient({ deliveryStatus: "FAILED", failedAt: now, lastErrorCode: "PROVIDER_FAILED" }), setMessage("FAILED", { lastErrorCode: "PROVIDER_FAILED" })]);
        break;
      case "BOUNCED_SOFT":
      case "BLOCKED":
      case "ACCEPTED":
        // Recorded only — a single soft bounce never permanently suppresses.
        break;
    }
    return { applied: true };
  }

  private async optOut(contactId: string, at: Date): Promise<void> {
    await this.prisma.contactChannelPreference.upsert({
      where: { contactId_channel: { contactId, channel: "EMAIL" } },
      create: { contactId, channel: "EMAIL", consentStatus: "OPTED_OUT", optOutAt: at },
      update: { consentStatus: "OPTED_OUT", optOutAt: at },
    });
  }

  /** Parse + normalize a Brevo webhook body (single event or array). */
  buildFromBrevo(body: unknown): NormalizedEventInput[] {
    const events = Array.isArray(body) ? body : [body];
    const out: NormalizedEventInput[] = [];
    for (const e of events) {
      if (!e || typeof e !== "object") continue;
      const rec = e as Record<string, unknown>;
      const type = normalizeBrevoEvent(String(rec.event ?? ""));
      const providerMessageId = String(rec["message-id"] ?? rec.messageId ?? "");
      if (!type || !providerMessageId) continue;
      const ts = rec.date ?? rec.ts ?? rec.tsEvent;
      const occurredAt = ts ? new Date(typeof ts === "number" ? ts * 1000 : String(ts)) : undefined;
      out.push({ providerMessageId, type, occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : undefined, dedupKey: `${providerMessageId}:${type}:${String(ts ?? "")}` });
    }
    return out;
  }
}
