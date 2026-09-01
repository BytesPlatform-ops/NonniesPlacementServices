import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CommunicationInboundReviewStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { generateThreadToken } from "./email-config";
import { buildPreviewText } from "./inbound-sanitize";
import { type InboundReviewView, toInboundReviewView } from "./inbox.serializer";
import type { Paginated } from "./conversation.service";

@Injectable()
export class InboundReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(status: CommunicationInboundReviewStatus | undefined, page: number, pageSize: number): Promise<Paginated<InboundReviewView>> {
    const where = { status: status ?? "PENDING" };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationInboundEmailReview.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.communicationInboundEmailReview.count({ where }),
    ]);
    return { items: rows.map(toInboundReviewView), page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
  }

  async pendingCount(): Promise<number> {
    return this.prisma.communicationInboundEmailReview.count({ where: { status: "PENDING" } });
  }

  /**
   * Link a quarantined inbound email to an existing conversation, or to an existing
   * contact (creating a fresh conversation). NEVER creates a contact — the target
   * contact must already exist.
   */
  async link(user: RequestUser, reviewId: string, target: { conversationId?: string; contactId?: string }): Promise<{ ok: true; conversationId: string }> {
    const review = await this.prisma.communicationInboundEmailReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException("Review item not found");
    if (review.status !== "PENDING") throw new BadRequestException("This item has already been resolved.");

    let conversationId = target.conversationId ?? null;
    if (!conversationId) {
      if (!target.contactId) throw new BadRequestException("Provide a conversation or a contact to link to.");
      const contact = await this.prisma.communicationContact.findUnique({ where: { id: target.contactId }, select: { id: true } });
      if (!contact) throw new NotFoundException("Contact not found");
      const conversation = await this.prisma.communicationConversation.create({
        data: { contactId: contact.id, channel: "EMAIL", subject: review.subject, threadToken: generateThreadToken() },
      });
      conversationId = conversation.id;
    } else {
      const conversation = await this.prisma.communicationConversation.findUnique({ where: { id: conversationId }, select: { id: true } });
      if (!conversation) throw new NotFoundException("Conversation not found");
    }

    const receivedAt = review.receivedAt ?? new Date();
    const preview = review.previewText ?? buildPreviewText(review.textBody, review.sanitizedHtmlBody);
    await this.prisma.$transaction(async (tx) => {
      await tx.communicationMessage.create({
        data: {
          conversationId: conversationId!,
          channel: "EMAIL",
          direction: "INBOUND",
          status: "RECEIVED",
          subject: review.subject,
          textBody: review.textBody,
          htmlBody: review.sanitizedHtmlBody,
          previewText: preview,
          fromAddress: review.fromEmail,
          fromName: review.fromName,
          toAddress: review.toAddress,
          messageId: review.internetMessageId,
          inReplyTo: review.inReplyTo,
          references: review.references,
          providerInboundId: review.providerInboundId,
          receivedAt,
        },
      });
      await tx.communicationConversation.update({
        where: { id: conversationId! },
        data: { status: "OPEN", archivedAt: null, lastMessageAt: receivedAt, lastInboundAt: receivedAt, latestDirection: "INBOUND", previewText: preview },
      });
      await tx.communicationInboundEmailReview.update({ where: { id: reviewId }, data: { status: "LINKED", linkedConversationId: conversationId, reviewedByUserId: user.id, reviewedAt: new Date() } });
    });

    await this.audit.record({ action: "communication.inbound_review.linked", entityType: "CommunicationInboundEmailReview", entityId: reviewId, actorUserId: user.id, metadata: { conversationId } });
    return { ok: true, conversationId: conversationId! };
  }

  async dismiss(user: RequestUser, reviewId: string): Promise<{ ok: true }> {
    const review = await this.prisma.communicationInboundEmailReview.findUnique({ where: { id: reviewId }, select: { id: true, status: true } });
    if (!review) throw new NotFoundException("Review item not found");
    if (review.status !== "PENDING") throw new BadRequestException("This item has already been resolved.");
    await this.prisma.communicationInboundEmailReview.update({ where: { id: reviewId }, data: { status: "DISMISSED", reviewedByUserId: user.id, reviewedAt: new Date() } });
    await this.audit.record({ action: "communication.inbound_review.dismissed", entityType: "CommunicationInboundEmailReview", entityId: reviewId, actorUserId: user.id });
    return { ok: true };
  }
}
