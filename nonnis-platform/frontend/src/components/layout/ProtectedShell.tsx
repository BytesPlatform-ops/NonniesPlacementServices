"use client";

import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { AppShell } from "./AppShell";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { loading, me, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!me || !me.provisioned || me.memberships.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-semibold text-slate-900">No organization access</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account is authenticated but not yet linked to an organization. Please contact your administrator.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
