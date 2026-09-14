import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import type { RequestUser } from "../auth/request-user";
import { NotificationAudienceService } from "./notification-audience.service";
import { NOTIFICATION_DEFINITIONS, type NotificationType } from "./notification-catalog";
import { recipientInclude, toNotificationView, type NotificationView } from "./notifications.serializer";
import type { ListNotificationsQueryDto } from "./dto/notifications.dto";

export interface RaiseNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  recipientUserIds: string[];
  /** Stable per-occurrence key. Omit only for events that cannot repeat. */
  eventKey?: string;
  route?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  organizationId?: string | null;
  caseId?: string | null;
  /** Whoever caused it. Excluded from the audience — nobody notifies themselves. */
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date | null;
}

/**
 * The single place notifications are created and read.
 *
 * Callers describe the business event and who it concerns; everything else —
 * priority, de-duplication, fan-out, read state — is decided here, so a new
 * event is one call and cannot invent its own rules.
 *
 * Raising a notification must never be able to fail the action that caused it.
 * A provider accepting an order has done something real; a notification that
 * could not be written is a problem for the log, not a reason to reject the
 * acceptance. Every `raise` is therefore internally guarded.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: NotificationAudienceService,
  ) {}

  /** The audience resolver, for callers that need to work out recipients first. */
  get for(): NotificationAudienceService {
    return this.audience;
  }

  /**
   * Create one notification and deliver it to the given users.
   *
   * De-duplication is the unique `eventKey`: a replayed event finds the row
   * already there and stops, so the same acceptance cannot notify anyone twice
   * however many times the request is processed. Recipients are written with
   * `skipDuplicates`, so a person reachable by two routes is still notified
   * once.
   */
  async raise(input: RaiseNotificationInput): Promise<{ notificationId: string; delivered: number } | null> {
    // The actor is always dropped: acting on something is not news to yourself.
    const recipients = [...new Set(input.recipientUserIds)].filter((id) => id && id !== input.actorUserId);
    if (recipients.length === 0) return null;

    try {
      const definition = NOTIFICATION_DEFINITIONS[input.type];
      return await this.prisma.$transaction(async (tx) => {
        if (input.eventKey) {
          const existing = await tx.notification.findUnique({
            where: { eventKey: input.eventKey },
            select: { id: true },
          });
          if (existing) return { notificationId: existing.id, delivered: 0 };
        }

        const notification = await tx.notification.create({
          data: {
            type: input.type,
            priority: definition?.priority ?? "NORMAL",
            title: input.title,
            message: input.message,
            route: input.route ?? null,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            organizationId: input.organizationId ?? null,
            caseId: input.caseId ?? null,
            actorUserId: input.actorUserId ?? null,
            metadata: input.metadata,
            eventKey: input.eventKey ?? null,
            expiresAt: input.expiresAt ?? null,
          },
          select: { id: true },
        });

        const delivered = await tx.notificationRecipient.createMany({
          data: recipients.map((recipientUserId) => ({ notificationId: notification.id, recipientUserId })),
          skipDuplicates: true,
        });
        return { notificationId: notification.id, delivered: delivered.count };
      });
    } catch (error) {
      // Never let a notification failure roll back the business action that
      // produced it. The event itself is already recorded elsewhere.
      const reason = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Notification ${input.type} was not raised: ${reason}`);
      return null;
    }
  }

  /** Convenience for a single recipient. */
  async raiseForUser(input: Omit<RaiseNotificationInput, "recipientUserIds"> & { recipientUserId: string }) {
    const { recipientUserId, ...rest } = input;
    return this.raise({ ...rest, recipientUserIds: [recipientUserId] });
  }

  // -------------------------------------------------------------------------
  // Reading — always the caller's own feed, never anyone else's
  // -------------------------------------------------------------------------

  async list(user: RequestUser, query: ListNotificationsQueryDto): Promise<PaginatedResult<NotificationView>> {
    const { page, pageSize } = query;
    const where: Prisma.NotificationRecipientWhereInput = {
      // The only scoping that matters, and it is not optional anywhere.
      recipientUserId: user.id,
      ...(query.filter === "unread" ? { readAt: null } : {}),
      ...(query.filter === "read" ? { readAt: { not: null } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.findMany({
        where,
        include: recipientInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notificationRecipient.count({ where }),
    ]);

    return {
      items: rows.map(toNotificationView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /** The number behind both the bell and the sidebar badge. */
  async unreadCount(user: RequestUser): Promise<{ count: number }> {
    const count = await this.prisma.notificationRecipient.count({
      where: { recipientUserId: user.id, readAt: null },
    });
    return { count };
  }

  /**
   * Mark one notification read or unread.
   *
   * Scoped by `recipientUserId` in the same statement that writes, so another
   * person's row cannot be touched even with a valid id — and a row that is
   * not the caller's is reported as not found rather than forbidden.
   */
  async setRead(user: RequestUser, id: string, read: boolean): Promise<NotificationView> {
    const updated = await this.prisma.notificationRecipient.updateMany({
      where: { id, recipientUserId: user.id },
      data: { readAt: read ? new Date() : null },
    });
    if (updated.count !== 1) throw new NotFoundException(`Notification ${id} not found`);

    const row = await this.prisma.notificationRecipient.findFirstOrThrow({
      where: { id, recipientUserId: user.id },
      include: recipientInclude,
    });
    return toNotificationView(row);
  }

  /** Clears the caller's own badge in one statement. */
  async markAllRead(user: RequestUser): Promise<{ count: number }> {
    const updated = await this.prisma.notificationRecipient.updateMany({
      where: { recipientUserId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: updated.count };
  }
}
