import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { AppNotification, NotificationFilter } from "@/types/notifications";

export function listNotifications(
  params: { page?: number; pageSize?: number; filter?: NotificationFilter } = {},
): Promise<PaginatedResult<AppNotification>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  // Server-side, so the unread view stays correct across pages.
  if (params.filter && params.filter !== "all") query.set("filter", params.filter);
  const qs = query.toString();
  return apiGet<PaginatedResult<AppNotification>>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
}

export function notificationsUnreadCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>("/api/v1/notifications/unread-count");
}

export function setNotificationRead(id: string, read: boolean): Promise<AppNotification> {
  return apiPatch<AppNotification>(`/api/v1/notifications/${id}/read`, { read });
}

export function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiPost<{ count: number }>("/api/v1/notifications/mark-all-read");
}
