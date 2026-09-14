"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  markAllNotificationsRead,
  notificationsUnreadCount,
  setNotificationRead,
} from "@/services/notifications.service";

/** Matches the inbox poll: one small count query, not a held-open socket. */
const POLL_MS = 30_000;

interface NotificationsValue {
  /** Unread count, or null before the first successful reading. */
  unread: number | null;
  /** Re-read the count from the server. */
  refresh: () => Promise<void>;
  /** Mark one read/unread and reconcile the shared count. */
  setRead: (id: string, read: boolean) => Promise<void>;
  /** Clear the badge everywhere at once. */
  markAllRead: () => Promise<number>;
}

const NotificationsContext = createContext<NotificationsValue>({
  unread: null,
  refresh: async () => undefined,
  setRead: async () => undefined,
  markAllRead: async () => 0,
});

/**
 * The single source of truth for notification state.
 *
 * The header bell, the sidebar badge and the notification centre all read this
 * one context, so they cannot disagree: there is only one count and only one
 * place that changes it. Reading a notification updates the count optimistically
 * and then re-reads from the server, so an optimistic guess never becomes the
 * lasting answer.
 *
 * It polls rather than opening a socket, for the same reason the inbox does —
 * the API runs on short-lived serverless instances with nowhere to keep a
 * connection. Polling pauses while the tab is hidden.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  const [unread, setUnread] = useState<number | null>(null);
  const canRead = hasPermission(PERMISSIONS.NOTIFICATIONS_READ);

  const refresh = useCallback(async () => {
    if (!canRead) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const { count } = await notificationsUnreadCount();
      setUnread(count);
    } catch {
      // A failed poll is not worth interrupting anyone over; the next retries.
    }
  }, [canRead]);

  const setRead = useCallback(
    async (id: string, read: boolean) => {
      // Optimistic, then reconciled — the server remains the authority.
      setUnread((current) => (current === null ? current : Math.max(0, current + (read ? -1 : 1))));
      try {
        await setNotificationRead(id, read);
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setUnread(0);
    try {
      const { count } = await markAllNotificationsRead();
      return count;
    } finally {
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!canRead) return;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canRead, refresh]);

  const value = useMemo<NotificationsValue>(
    () => ({ unread: canRead ? unread : null, refresh, setRead, markAllRead }),
    [canRead, unread, refresh, setRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  return useContext(NotificationsContext);
}
