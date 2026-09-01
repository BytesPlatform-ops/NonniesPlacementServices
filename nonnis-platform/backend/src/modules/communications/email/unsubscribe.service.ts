import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { SuppressionsService } from "../suppressions/suppressions.service";

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const shown = local.slice(0, 1);
  return `${shown}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppressions: SuppressionsService,
  ) {}

  async status(token: string): Promise<{ valid: boolean; email?: string | null; alreadyUnsubscribed?: boolean }> {
    const contact = await this.prisma.communicationContact.findFirst({
      where: { unsubscribeToken: token },
      select: { id: true, email: true, preferences: { where: { channel: "EMAIL" }, select: { consentStatus: true } } },
    });
    if (!contact) return { valid: false };
    return { valid: true, email: maskEmail(contact.email), alreadyUnsubscribed: contact.preferences[0]?.consentStatus === "OPTED_OUT" };
  }

  /** Idempotent public unsubscribe: opt out of EMAIL + active suppression. */
  async unsubscribe(token: string): Promise<{ ok: boolean }> {
    const contact = await this.prisma.communicationContact.findFirst({ where: { unsubscribeToken: token }, select: { id: true, normalizedEmail: true } });
    if (!contact) return { ok: false };
    const now = new Date();
    await this.prisma.contactChannelPreference.upsert({
      where: { contactId_channel: { contactId: contact.id, channel: "EMAIL" } },
      create: { contactId: contact.id, channel: "EMAIL", consentStatus: "OPTED_OUT", optOutAt: now, consentSource: "Public unsubscribe" },
      update: { consentStatus: "OPTED_OUT", optOutAt: now, consentSource: "Public unsubscribe" },
    });
    if (contact.normalizedEmail) await this.suppressions.suppressSystem("EMAIL", contact.normalizedEmail, "USER_OPT_OUT", "public-unsubscribe");
    return { ok: true };
  }
}
