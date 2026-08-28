"use client";

import { useState } from "react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

export function TopBar() {
  const { me, activeOrganizationId, switchOrganization, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const memberships = me?.memberships ?? [];
  const active = memberships.find((m) => m.organizationId === activeOrganizationId) ?? memberships[0];
  const userLabel =
    me?.user?.displayName ||
    `${me?.user?.firstName ?? ""} ${me?.user?.lastName ?? ""}`.trim() ||
    me?.user?.email ||
    "Account";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-sage bg-ivory px-5">
      <div className="flex items-center gap-3">
        {memberships.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Organization</span>
            <select
              value={activeOrganizationId ?? ""}
              onChange={(e) => void switchOrganization(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          </label>
        ) : active ? (
          <span className="text-sm font-medium text-slate-700">{active.organizationName}</span>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden max-w-[12rem] truncate sm:inline">{userLabel}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">{userLabel}</p>
              <p className="truncate text-xs text-slate-500">{me?.user?.email}</p>
              {active ? (
                <p className="mt-1 text-xs text-slate-500">
                  {active.roleName} · {active.organizationName}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
