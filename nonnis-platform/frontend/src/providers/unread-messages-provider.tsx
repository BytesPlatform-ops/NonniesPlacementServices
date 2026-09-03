"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { unreadCount } from "@/services/communications-inbox.service";

/** How often the unread count is refreshed while the tab is in the foreground. */
const POLL_MS = 30_000;

interface UnreadMessagesValue {
  /** Unread conversations, or null before the first successful reading. */
  count: number | null;
  /** Re-check immediately (e.g. right after reading a conversation). */
  refresh: () => void;
}

const UnreadMessagesContext = createContext<UnreadMessagesValue>({ count: null, refresh: () => undefined });

/**
 * Keeps one unread-conversation count for the whole app, so staff learn a reply
 * arrived without sitting on the Inbox page.
 *
 * It polls rather than holding a socket open: the API runs on short-lived
 * serverless instances where a long-lived connection has nowhere to live, and
 * one small count query every half minute is far cheaper than the database
 * connection a socket would pin open.
 *
 * Polling pauses while the tab is hidden and re-checks on return, so a browser
 * left open overnight stops querying. The first reading only establishes a
 * baseline — a backlog that was already waiting is never announced as new.
 */
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [count, setCount] = useState<number | null>(null);
  const previous = useRef<number | null>(null);
  const canRead = hasPermission(PERMISSIONS.COMMUNICATIONS_READ);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const { count: next } = await unreadCount();
      setCount(next);
      const before = previous.current;
      previous.current = next;
      if (before !== null && next > before) {
        const arrived = next - before;
        toast.info(arrived === 1 ? "New reply received — open the Inbox" : `${arrived} new replies received — open the Inbox`);
      }
    } catch {
      // A failed poll is not worth interrupting anyone over; the next one retries.
    }
  }, [toast]);

  useEffect(() => {
    if (!canRead) return;
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canRead, check]);

  const value = useMemo<UnreadMessagesValue>(() => ({ count: canRead ? count : null, refresh: () => void check() }), [canRead, count, check]);
  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages(): UnreadMessagesValue {
  return useContext(UnreadMessagesContext);
}
