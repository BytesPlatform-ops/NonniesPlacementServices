"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { priorityClasses, relativeTime } from "@/lib/notifications";
import { useNotifications } from "@/providers/notifications-provider";
import { listNotifications } from "@/services/notifications.service";
import type { AppNotification, NotificationFilter } from "@/types/notifications";

const PAGE_SIZE = 20;
const FILTERS: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

/**
 * The notification centre.
 *
 * Reads the same records as the header bell and shares its unread state, so
 * marking something read here changes the badge above without either component
 * knowing about the other. The filter is a server query, not a client-side
 * hide, which is what keeps "unread" correct across pages.
 */
export function NotificationsView() {
  const router = useRouter();
  const { unread, setRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listNotifications({ page, pageSize: PAGE_SIZE, filter });
      setItems(result.items);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (notification: AppNotification) => {
    if (!notification.read) await setRead(notification.id, true);
    // Advisory only — the destination performs its own authorization check.
    if (notification.route) router.push(notification.route);
    else await load();
  };

  const toggleRead = async (notification: AppNotification) => {
    await setRead(notification.id, !notification.read);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Notifications"
        description={unread && unread > 0 ? `${unread} unread` : "You are all caught up."}
        actions={
          <button
            type="button"
            onClick={() => void markAllRead().then(() => load())}
            disabled={!unread}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Mark all read
          </button>
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-sage">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              filter === f.value ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-umber",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel>
        {loading ? (
          <LoadingState label="Loading notifications…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            title={filter === "unread" ? "Nothing unread" : "No notifications"}
            message="Updates about your cases, referrals and orders appear here."
          />
        ) : (
          <ul className="divide-y divide-sage/70">
            {items.map((n) => {
              const tone = priorityClasses(n.priority);
              return (
                <li key={n.id} className={cn("flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0", !n.read && "bg-brand-50/30")}>
                  <span
                    aria-hidden
                    className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")}
                  />
                  <button type="button" onClick={() => void open(n)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      {tone ? (
                        <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold uppercase", tone)}>{n.priority}</span>
                      ) : null}
                      <span className={cn("text-sm", n.read ? "text-slate-700" : "font-semibold text-umber")}>{n.title}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {n.source} · {relativeTime(n.createdAt)} · {formatDateTime(n.createdAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleRead(n)}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-umber"
                  >
                    {n.read ? "Mark unread" : "Mark read"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-sage pt-3 text-sm">
            <span className="text-slate-500">
              Page {page} of {totalPages} · {total} total
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </span>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
