"use client";

import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { isCareSeeker } from "@/lib/landing";
import { AppShell } from "./AppShell";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { loading, me, loadError, reload, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  // The account could not be loaded, and the session is not the reason — the
  // API is down or unreachable. Saying "no organization access" here sends
  // someone to their administrator over a stopped server, so the failure is
  // named and offered a retry instead.
  if (loadError && !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-semibold text-slate-900">Can&apos;t reach the platform</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your sign-in is fine — the API did not answer, so your account could not be loaded.
          </p>
          <p className="mt-2 text-xs text-slate-400">{loadError.message}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A family member legitimately has no organization membership — their access
  // is a grant on a case. Without this the shell would show them the "no
  // organization access" screen, which describes a different problem.
  const hasAccess = !!me && me.provisioned && (me.memberships.length > 0 || isCareSeeker(me));

  if (!hasAccess) {
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
