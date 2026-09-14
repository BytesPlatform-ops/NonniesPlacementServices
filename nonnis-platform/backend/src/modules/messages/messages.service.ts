import { Injectable } from "@nestjs/common";
import { Prisma, type MessageScope } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import type { RequestUser } from "../auth/request-user";
import { MessageAccessService } from "./message-access";
import { PERMISSIONS } from "../../common/rbac";
import { NotificationsService } from "../notifications/notifications.service";
import { NOTIFICATION_TYPES, ROUTES, eventKey } from "../notifications/notification-catalog";
import { toMessageView, type MessageView } from "./messages.serializer";
import type { ListMessagesDto, SendMessageDto } from "./dto/messages.dto";

/**
 * Case-linked messaging. Four visibility scopes (CASE_TEAM / NONNIS_INTERNAL /
 * PROVIDER_REFERRAL / CARE_SEEKER) share this append-only service; access is
 * decided by MessageAccessService. Messages are timeline items themselves, so
 * no duplicate WorkflowEvent is emitted. Sender identity is always
 * server-derived.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MessageAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async resolveNames(ids: string[]): Promise<Map<string, string | null>> {
    const list = Array.from(new Set(ids));
    const map = new Map<string, string | null>();
    if (list.length === 0) return map;
    const users = await this.prisma.user.findMany({
      where: { id: { in: list } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    for (const u of users) map.set(u.id, u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
    return map;
  }

  private async page(where: Prisma.MessageWhereInput, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({ where, orderBy: { createdAt: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.message.count({ where }),
    ]);
    const names = await this.resolveNames(rows.map((m) => m.senderUserId));
    return {
      items: rows.map((m) => toMessageView(m, names)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  private async create(caseId: string, scope: MessageScope, senderUserId: string, body: string, referralId?: string): Promise<MessageView> {
    const created = await this.prisma.message.create({ data: { caseId, scope, senderUserId, body, referralId } });
    const names = await this.resolveNames([senderUserId]);
    return toMessageView(created, names);
  }

  // ---- Case-team ----

  async listCaseTeam(user: RequestUser, caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    await this.access.caseTeamAccess(user, caseId);
    return this.page({ caseId, scope: "CASE_TEAM" }, query);
  }

  async sendCaseTeam(user: RequestUser, caseId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.access.caseTeamAccess(user, caseId);
    return this.create(caseId, "CASE_TEAM", user.id, dto.body);
  }

  // ---- Nonnis internal notes ----

  async listInternal(user: RequestUser, caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    await this.access.internalAccess(user, caseId);
    return this.page({ caseId, scope: "NONNIS_INTERNAL" }, query);
  }

  async sendInternal(user: RequestUser, caseId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.access.internalAccess(user, caseId);
    return this.create(caseId, "NONNIS_INTERNAL", user.id, dto.body);
  }

  // ---- Provider referral thread ----

  async listReferral(user: RequestUser, referralId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    const ref = await this.access.referralAccess(user, referralId);
    return this.page({ referralId, scope: "PROVIDER_REFERRAL", caseId: ref.caseId }, query);
  }

  async sendReferral(user: RequestUser, referralId: string, dto: SendMessageDto): Promise<MessageView> {
    const ref = await this.access.referralAccess(user, referralId);
    return this.create(ref.caseId, "PROVIDER_REFERRAL", user.id, dto.body, referralId);
  }

  // ---- Family thread ----
  //
  // One thread per case between the family and the case/Nonnis side. It is a
  // scope on the existing Message model rather than a second chat system, so
  // the same append-only history, serializer and sender resolution apply.
  //
  // Providers are never a party to it: PROVIDER_REFERRAL remains the only
  // thread they can reach, and nothing here widens that.

  async listFamilyForStaff(user: RequestUser, caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    await this.access.caseTeamAccess(user, caseId);
    return this.page({ caseId, scope: "CARE_SEEKER" }, query);
  }

  async sendFamilyForStaff(user: RequestUser, caseId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.access.caseTeamAccess(user, caseId);
    const message = await this.create(caseId, "CARE_SEEKER", user.id, dto.body);
    await this.notifyFamilyThread(caseId, message.id, user.id, true);
    return message;
  }

  /**
   * The family's own view of the thread.
   *
   * Takes a case id the caller has ALREADY proven through
   * `SeekerCaseAccessService`, in the same way the documents and appointments
   * services do. A family member holds no organization membership, so the
   * organization-based checks in MessageAccessService cannot decide for them.
   */
  async listFamilyForSeeker(caseId: string, query: ListMessagesDto): Promise<PaginatedResult<MessageView>> {
    return this.page({ caseId, scope: "CARE_SEEKER" }, query);
  }

  async sendFamilyForSeeker(caseId: string, senderUserId: string, dto: SendMessageDto): Promise<MessageView> {
    const message = await this.create(caseId, "CARE_SEEKER", senderUserId, dto.body);
    await this.notifyFamilyThread(caseId, message.id, senderUserId, false);
    return message;
  }

  /**
   * Tells the other side of the family thread that a message arrived.
   *
   * Staff writing notifies the family; a family member writing notifies the
   * case team AND the other relatives on the case, who share the thread. The
   * sender is dropped by the notification service itself.
   *
   * The message id is the discriminator: every message is a real, separate
   * event, so these are never collapsed into one the way a repeated status
   * change is.
   */
  private async notifyFamilyThread(
    caseId: string,
    messageId: string,
    senderUserId: string,
    fromStaff: boolean,
  ): Promise<void> {
    const family = await this.notifications.for.caseFamilyUsers(caseId);
    const recipients = fromStaff
      ? family
      : [...family, ...(await this.notifications.for.caseTeamUsers(caseId, PERMISSIONS.MESSAGES_READ))];
    await this.notifications.raise({
      type: fromStaff
        ? NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_STAFF
        : NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_FAMILY,
      title: fromStaff ? "New message from your care team" : "New message from a family member",
      // The body is deliberately not copied into the notification: it is read
      // in the thread, behind the case check.
      message: "Open Messages to read it.",
      recipientUserIds: recipients,
      eventKey: eventKey(
        fromStaff ? NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_STAFF : NOTIFICATION_TYPES.FAMILY_MESSAGE_FROM_FAMILY,
        messageId,
      ),
      route: fromStaff ? ROUTES.seekerMessages() : ROUTES.staffCase(caseId),
      entityType: "Message",
      entityId: messageId,
      caseId,
      actorUserId: senderUserId,
    });
  }
}
