"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, Menu, X } from "lucide-react";
import { SidebarNav } from "./SidebarNav";

/**
 * The same navigation on small screens, in a drawer.
 *
 * It renders `SidebarNav` rather than a second copy of the list, so role
 * visibility, active state and the unread badges are identical to the desktop
 * sidebar by construction.
 *
 * While the drawer is open the page behind it is locked, so a scroll gesture
 * moves the navigation and not the content underneath. The lock is released on
 * close and on unmount, and the drawer closes on navigation, on Escape and on a
 * tap outside.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating away closes it — the destination is what the user asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      // Always restored, including if the component unmounts while open.
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-umber lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/30"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-sage bg-ivory shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sage px-4">
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <span className="truncate text-sm font-semibold tracking-tight text-umber">Nonnis Platform</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
