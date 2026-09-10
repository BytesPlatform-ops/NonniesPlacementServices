"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { isPasswordSetupFragment } from "@/lib/auth-recovery";

/**
 * Root entry point.
 *
 * This was a one-line server redirect to `/home`, and it stays that in effect —
 * but it has to run in the browser, because a Supabase invitation or recovery
 * link can land here carrying its tokens in the URL fragment, and a fragment is
 * never sent to the server. A server redirect would hand the visitor to
 * middleware, which cannot see the fragment either and would bounce them to
 * `/login` as an ordinary unauthenticated visitor — silently skipping the
 * "set a password" step the link was for.
 *
 * Checking here keeps that path deterministic instead of relying on the browser
 * to carry a fragment through two consecutive redirects.
 */
export default function RootPage() {
  useEffect(() => {
    const hash = window.location.hash;
    // `location.replace`, not the router: the fragment has to survive, and it
    // leaves no history entry pointing at a URL that still holds the tokens.
    window.location.replace(isPasswordSetupFragment(hash) ? `/auth/update-password${hash}` : "/home");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
