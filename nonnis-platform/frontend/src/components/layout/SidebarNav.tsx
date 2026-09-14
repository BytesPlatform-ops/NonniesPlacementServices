"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeNavHref } from "@/lib/active-nav";
import { visibleNav, visibleProviderNav, visibleSeekerNav } from "@/lib/navigation";
import { activeOrgIsProvider, isCareSeeker } from "@/lib/landing";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { useUnreadMessages } from "@/providers/unread-messages-provider";
import { NAV_ICONS } from "./nav-icons";

/**
 * The navigation list itself, shared by the desktop sidebar and the mobile
 * drawer so the two can never drift apart.
 *
 * It owns its own scroll. That is what makes the position survive navigation:
 * this element stays mounted across route changes, so its `scrollTop` is simply
 * never reset — no scroll-restoration bookkeeping, and nothing fighting the
 * router. The only deliberate movement is bringing an off-screen active item
 * into view, and that runs on a route change and on nothing else.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { count: unreadMessages } = useUnreadMessages();
  // The same context the header bell reads, so the two counts cannot drift.
  const { unread: unreadNotifications } = useNotifications();
  const { permissions, me, activeOrganizationId } = useAuth();
  const activeItem = useRef<HTMLAnchorElement>(null);

  // A family member is checked first: they have no organization, so the
  // provider check below would fall through to the staff navigation.
  const seeker = isCareSeeker(me);
  const isProvider = !seeker && activeOrgIsProvider(me, activeOrganizationId);
  const groups = useMemo(
    () => (seeker ? visibleSeekerNav(permissions) : isProvider ? visibleProviderNav(permissions) : visibleNav(permissions)),
    [seeker, isProvider, permissions],
  );

  // Exactly one item is active — the most specific match. See `activeNavHref`.
  const activeHref = useMemo(
    () => activeNavHref(groups.flatMap((group) => group.items), pathname),
    [groups, pathname],
  );

  useEffect(() => {
    const element = activeItem.current;
    if (!element) return;
    // `block: "nearest"` does nothing when the item is already fully visible,
    // so an ordinary click never moves the list. It only scrolls when the
    // destination was off-screen — arriving straight at a URL near the bottom.
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    // Route changes only. A notification count arriving must never move the list.
  }, [pathname]);

  return (
    <nav
      aria-label="Main"
      // `min-h-0` is what lets a flex child actually scroll instead of growing
      // its parent; `overscroll-contain` stops a bottomed-out scroll from
      // continuing into the page behind it.
      className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 py-4"
    >
      {groups.map((group, index) => (
        <div key={group.title ?? `group-${index}`}>
          {group.title ? (
            <p className="px-2.5 pb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon: LucideIcon = NAV_ICONS[item.label] ?? ClipboardList;
              const active = item.href === activeHref;
              const badge =
                item.href === "/notifications"
                  ? unreadNotifications
                  : item.href === "/communications/inbox"
                    ? unreadMessages
                    : null;
              const badgeLabel =
                item.href === "/notifications"
                  ? `${badge} unread notifications`
                  : `${badge} unread conversations`;

              return (
                <li key={item.href}>
                  <Link
                    ref={active ? activeItem : undefined}
                    href={item.href}
                    onClick={onNavigate}
                    // Announced as the current page, not merely coloured.
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md py-2 pl-2.5 pr-2 text-sm transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 focus-visible:ring-offset-ivory",
                      active
                        ? "bg-brand-50 font-semibold text-brand-800"
                        : "font-medium text-slate-ink hover:bg-brand-50 hover:text-umber",
                    )}
                  >
                    {/* A shape, not just a colour: the active item is also
                        marked by a rail and a heavier weight, so it reads
                        without relying on hue. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full",
                        active ? "bg-brand-700" : "bg-transparent",
                      )}
                    />
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {/* Truncated with the full label on hover, so a long name
                        never clips mid-word or widens the sidebar. */}
                    <span className="min-w-0 flex-1 truncate" title={item.label}>
                      {item.label}
                    </span>
                    {badge !== null && badge > 0 ? (
                      <span
                        aria-label={badgeLabel}
                        // Fixed minimum width and tabular figures: the row does
                        // not shift when a count appears or ticks over.
                        className="ml-auto inline-flex min-w-[1.375rem] shrink-0 justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
