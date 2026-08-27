"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Boxes, Building2, ClipboardList, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [{ label: "Discharge Cases", href: "/cases", icon: ClipboardList }];

// Future operational areas — shown for orientation, not yet linkable.
const FUTURE_NAV = [
  { label: "Referrals", icon: Send },
  { label: "Providers", icon: Boxes },
  { label: "Organizations", icon: Building2 },
  { label: "Users", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
          <Activity className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-slate-900">Nonnis Platform</span>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-4">
        <div>
          <p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Operations</p>
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Coming soon</p>
          <ul className="space-y-0.5">
            {FUTURE_NAV.map((item) => (
              <li key={item.label}>
                <span className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-300">
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
