import { Injectable } from "@nestjs/common";
import type { CommunicationConversation } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";

/**
 * SMS conversation correlation. SMS has no RFC threading, so a conversation is
 * identified deterministically by (contact, Nonnis business number) — never by
 * message text. Keeping the business number per conversation means a Messaging
 * Service that later holds several senders stays correct.
 */
@Injectable()
export class SmsConversationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find the SMS conversation for a contact on a business number, or create it. */
  async findOrCreate(contactId: string, businessNumber: string | null, opts: { originSmsCampaignId?: string | null } = {}): Promise<CommunicationConversation> {
    const existing = await this.prisma.communicationConversation.findFirst({
      where: { contactId, channel: "SMS", businessNumber },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return this.prisma.communicationConversation.create({
      data: { contactId, channel: "SMS", businessNumber, originSmsCampaignId: opts.originSmsCampaignId ?? null },
    });
  }
}
