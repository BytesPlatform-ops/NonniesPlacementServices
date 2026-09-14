"use client";

import { Activity } from "lucide-react";
import { SidebarNav } from "./SidebarNav";

/**
 * The desktop sidebar.
 *
 * Fixed for the life of the session: it is a full-height column beside the
 * scrolling content, not a block inside the page, so the page scrolling can no
 * longer carry it away. The brand bar is pinned; only the navigation inside
 * scrolls, and it keeps its position because this component stays mounted
 * across route changes.
 */
export function Sidebar() {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sage bg-ivory lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sage px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
          <Activity className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate text-sm font-semibold tracking-tight text-umber">Nonnis Platform</span>
      </div>
      <SidebarNav />
    </aside>
  );
}
