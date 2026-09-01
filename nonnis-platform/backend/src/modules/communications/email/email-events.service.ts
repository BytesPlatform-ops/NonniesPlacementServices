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

  /** Apply one normalized event idempotently (retried webhooks are no-ops). */
  async apply(input: NormalizedEventInput): Promise<{ applied: boolean }> {
    const recipient = input.providerMessageId
      ? await this.prisma.communicationEmailCampaignRecipient.findFirst({ where: { providerMessageId: input.providerMessageId }, orderBy: { createdAt: "desc" } })
      : null;

    try {
      await this.prisma.communicationEmailEvent.create({
        data: { recipientId: recipient?.id ?? null, providerMessageId: input.providerMessageId, normalizedType: input.type, dedupKey: input.dedupKey, occurredAt: input.occurredAt ?? null },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { applied: false }; // duplicate webhook
      throw err;
    }

    if (!recipient) {
      this.logger.warn(`Email event ${input.type} for unknown provider message id.`);
      return { applied: true };
    }

    const contact = await this.prisma.communicationContact.findUnique({ where: { id: recipient.contactId }, select: { id: true, normalizedEmail: true } });
    const address = contact?.normalizedEmail ?? recipient.emailSnapshot.trim().toLowerCase();
    const now = input.occurredAt ?? new Date();

    switch (input.type) {
      case "DELIVERED":
        await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "DELIVERED", deliveredAt: now } });
        break;
      case "BOUNCED_HARD":
        await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "BOUNCED", bouncedAt: now, lastErrorCode: "HARD_BOUNCE" } });
        await this.suppressions.suppressSystem("EMAIL", address, "HARD_BOUNCE", "delivery-webhook");
        break;
      case "COMPLAINT":
        await this.suppressions.suppressSystem("EMAIL", address, "SPAM_COMPLAINT", "delivery-webhook");
        if (contact) await this.optOut(contact.id, now);
        break;
      case "UNSUBSCRIBED":
        await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "UNSUBSCRIBED", unsubscribedAt: now } });
        await this.suppressions.suppressSystem("EMAIL", address, "USER_OPT_OUT", "delivery-webhook");
        if (contact) await this.optOut(contact.id, now);
        break;
      case "FAILED":
        await this.prisma.communicationEmailCampaignRecipient.update({ where: { id: recipient.id }, data: { deliveryStatus: "FAILED", failedAt: now, lastErrorCode: "PROVIDER_FAILED" } });
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
