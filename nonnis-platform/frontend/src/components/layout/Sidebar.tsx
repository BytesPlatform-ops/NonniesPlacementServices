"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  List,
  BarChart3,
  Boxes,
  Building2,
  Contact,
  LayoutTemplate,
  MessageSquare,
  MessagesSquare,
  Upload,
  Clock,
  CreditCard,
  Gauge,
  IdCard,
  LayoutDashboard,
  Languages as LanguagesIcon,
  MapPin,
  ClipboardList,
  CheckSquare,
  FileText,
  Inbox,
  Quote,
  Radar,
  Send,
  Stethoscope,
  Tags,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleNav, visibleProviderNav } from "@/lib/navigation";
import { activeOrgIsProvider } from "@/lib/landing";
import { useAuth } from "@/providers/auth-provider";

const ICONS: Record<string, LucideIcon> = {
  Operations: Radar,
  "Form Submissions": Inbox,
  Tasks: CheckSquare,
  Cases: ClipboardList,
  Providers: Stethoscope,
  Reports: BarChart3,
  Inbox: Inbox,
  Contacts: Contact,
  Lists: List,
  "Email Templates": LayoutTemplate,
  "Email Campaigns": Send,
  "SMS Templates": MessageSquare,
  "SMS Campaigns": MessagesSquare,
  Imports: Upload,
  Blog: FileText,
  "Short Videos": Video,
  Testimonials: Quote,
  Organizations: Building2,
  Users,
  Facilities: Boxes,
  "Service Categories": Tags,
  Overview: LayoutDashboard,
  Referrals: Send,
  Profile: IdCard,
  Services: Stethoscope,
  Coverage: MapPin,
  "Payment / Insurance": CreditCard,
  Languages: LanguagesIcon,
  Hours: Clock,
  Capacity: Gauge,
  Team: Users,
};

export function Sidebar() {
  const pathname = usePathname();
  const { permissions, me, activeOrganizationId } = useAuth();
  const isProvider = activeOrgIsProvider(me, activeOrganizationId);
  const groups = isProvider ? visibleProviderNav(permissions) : visibleNav(permissions);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sage bg-ivory lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sage px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
          <Activity className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-umber">Nonnis Platform</span>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-4">
        {groups.map((group, index) => (
          <div key={group.title ?? `group-${index}`}>
            {group.title ? (
              <p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.label] ?? ClipboardList;
                // "/provider" is the portal root; match it exactly so it doesn't
                // stay highlighted on its sub-routes.
                const active =
                  item.href === "/provider"
                    ? pathname === "/provider"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        active ? "bg-brand-50 text-brand-800" : "text-slate-ink hover:bg-brand-50 hover:text-umber",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
