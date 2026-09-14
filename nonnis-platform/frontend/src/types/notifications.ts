export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface AppNotification {
  /** The recipient-row id: what mark-read acts on. */
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  source: string;
  route: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export type NotificationFilter = "all" | "unread" | "read";
