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

/**
 * Convert a provider timestamp into a Date, or undefined when it is unusable.
 *
 * Numbers are epoch seconds, unless they are large enough to only make sense as
 * milliseconds. Strings that already carry a timezone are trusted as-is; a bare
 * "YYYY-MM-DD HH:MM:SS" is read as UTC so the parsed instant does not depend on
 * the server's local timezone.
 */
export function parseEventTimestamp(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Anything past ~2001 in milliseconds is far beyond a plausible seconds value.
    const date = new Date(value > 1e11 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const text = String(value).trim();
  if (/^\d+$/.test(text)) return parseEventTimestamp(Number(text));

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = hasZone ? text : `${text.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
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

  /**
   * Resolve a provider event timestamp to a real instant.
   *
   * Epoch fields are preferred because they are unambiguous. Brevo's `date` is
   * a bare "YYYY-MM-DD HH:MM:SS" in the *account's* timezone with no offset, so
   * parsing it yields an instant that is wrong by the account's UTC offset —
   * which is how a delivery could be recorded as happening hours before the
   * send. It is kept only as a last resort, and an offset-less string is
   * treated as UTC rather than as the server's local time, so the result at
   * least does not change with where the process runs.
   */
  buildFromBrevo(body: unknown): NormalizedEventInput[] {
    const events = Array.isArray(body) ? body : [body];
    const out: NormalizedEventInput[] = [];
    for (const e of events) {
      if (!e || typeof e !== "object") continue;
      const rec = e as Record<string, unknown>;
      const type = normalizeBrevoEvent(String(rec.event ?? ""));
      const providerMessageId = String(rec["message-id"] ?? rec.messageId ?? "");
      if (!type || !providerMessageId) continue;
      const ts = rec.ts_epoch ?? rec.ts_event ?? rec.tsEvent ?? rec.ts ?? rec.date;
      const occurredAt = parseEventTimestamp(ts);
      out.push({ providerMessageId, type, occurredAt, dedupKey: `${providerMessageId}:${type}:${String(ts ?? "")}` });
    }
    return out;
  }
}
