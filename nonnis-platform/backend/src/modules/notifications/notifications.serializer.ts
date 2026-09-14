import { Prisma } from "@prisma/client";
import { NOTIFICATION_DEFINITIONS, type NotificationType } from "./notification-catalog";

export const recipientInclude = { notification: true } satisfies Prisma.NotificationRecipientInclude;
export type RecipientRow = Prisma.NotificationRecipientGetPayload<{ include: typeof recipientInclude }>;

export interface NotificationView {
  /** The RECIPIENT row id — what mark-read acts on, and what the client keys by. */
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  source: string;
  /** Advisory destination; the page it opens re-checks authorization itself. */
  route: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Projects a recipient row field by field.
 *
 * `organizationId`, `caseId`, `actorUserId` and `metadata` are carried on the
 * notification for routing and filtering but are deliberately not published:
 * they are internal scope, and a family member has no business learning an
 * organization id from a badge.
 */
export function toNotificationView(row: RecipientRow): NotificationView {
  const definition = NOTIFICATION_DEFINITIONS[row.notification.type as NotificationType];
  return {
    id: row.id,
    type: row.notification.type,
    priority: row.notification.priority,
    title: row.notification.title,
    message: row.notification.message,
    source: definition?.source ?? "Nonnis",
    route: row.notification.route,
    entityType: row.notification.entityType,
    entityId: row.notification.entityId,
    read: row.readAt !== null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
