"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { priorityClasses, relativeTime } from "@/lib/notifications";
import { listNotifications } from "@/services/notifications.service";
import type { AppNotification } from "@/types/notifications";

const PAGE_SIZE = 8;

/**
 * The header bell.
 *
 * Its badge is the shared unread count — the same number the sidebar shows,
 * because both read one context. The list is fetched when the popover opens
 * rather than polled, so a closed bell costs one small count query.
 */
export function NotificationBell() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { unread, setRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listNotifications({ page: 1, pageSize: PAGE_SIZE, filter: unreadOnly ? "unread" : "all" });
      setItems(page.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Close on an outside click or Escape, like the account menu above it.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hasPermission(PERMISSIONS.NOTIFICATIONS_READ)) return null;

  /** Opening a notification is what marks it read — then it navigates. */
  const openNotification = async (notification: AppNotification) => {
    setOpen(false);
    if (!notification.read) {
      await setRead(notification.id, true);
      setItems((current) => current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    }
    // The destination re-checks authorization itself; this is only a link.
    if (notification.route) router.push(notification.route);
  };

  const badge = unread ?? 0;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={badge > 0 ? `Notifications, ${badge} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-umber"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {badge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-brand-600 px-1 py-px text-[10px] font-semibold leading-tight text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-sage px-3 py-2">
            <span className="text-sm font-semibold text-umber">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead().then(() => load())}
              disabled={badge === 0}
              className="text-xs font-medium text-brand-700 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>

          <div className="flex gap-1 border-b border-sage px-3 py-1.5">
            {([false, true] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setUnreadOnly(value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  unreadOnly === value ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:text-umber",
                )}
              >
                {value ? "Unread" : "All"}
              </button>
            ))}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {unreadOnly ? "Nothing unread." : "No notifications yet."}
              </p>
            ) : (
              <ul className="divide-y divide-sage/70">
                {items.map((n) => {
                  const tone = priorityClasses(n.priority);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className={cn(
                          "flex w-full gap-2 px-3 py-2.5 text-left hover:bg-slate-50",
                          !n.read && "bg-brand-50/40",
                        )}
                      >
                        {/* A dot, not a colour wash: unread should be findable
                            without making the list shout. */}
                        <span
                          aria-hidden
                          className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {tone ? (
                              <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold uppercase", tone)}>
                                {n.priority}
                              </span>
                            ) : null}
                            <span className={cn("truncate text-sm", n.read ? "text-slate-700" : "font-semibold text-umber")}>
                              {n.title}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{n.message}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {n.source} · {relativeTime(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-sage px-3 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
