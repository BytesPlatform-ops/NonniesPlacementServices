"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authFragmentType, isPasswordSetupFragment } from "@/lib/auth-recovery";
import { establishPasswordSetupSession } from "@/lib/auth-session-setup";

type Phase = "checking" | "ready" | "expired";

const MIN_LENGTH = 8;

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Sets a password for an invited user, or for someone who followed a password
 * recovery link.
 *
 * Both arrive holding a Supabase session that authorises exactly one thing:
 * changing their own password. The page therefore establishes and confirms that
 * session before showing the form — otherwise `updateUser` fails and the only
 * feedback is a generic error on a form the visitor should never have seen.
 *
 * Establishing it is explicit, not hopeful. `createBrowserClient` pins
 * `flowType: "pkce"`, and auth-js refuses an implicit callback in that mode —
 * so a Supabase invitation, which is always implicit, is never picked up by
 * `detectSessionInUrl` no matter how fresh its tokens are. The token pair is
 * read from the fragment and handed to `setSession` instead; see
 * `auth-session-setup`.
 *
 * Nothing here is logged: not the password, not the tokens, not the fragment
 * that carries them.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [isRecovery, setIsRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // React runs effects twice in development. Establishing the session is not
  // idempotent-free — the second run would find the fragment already cleared —
  // so it happens once per mount cycle.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Captured before the client is touched, and before anything clears it.
    // Read straight off `window` rather than through `useSearchParams`: both
    // values are client-only, this effect already needs the fragment that no
    // hook exposes, and the hook would force a Suspense boundary around a page
    // that has nothing to stream.
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    const flowParam =
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("flow");

    // A fragment declaring some other type — a magic link — carries a session
    // but is not a request to choose a password, so it is passed straight on
    // rather than interrupted here.
    const fragmentType = authFragmentType(hash);
    if (fragmentType && !isPasswordSetupFragment(hash)) {
      router.replace("/home");
      return;
    }

    let active = true;
    void (async () => {
      const outcome = await establishPasswordSetupSession(supabaseBrowser().auth, { hash, flowParam });
      if (!active) return;

      if (outcome.status === "invalid") {
        setPhase("expired");
        return;
      }

      setIsRecovery(outcome.flow === "recovery");
      // Cleared only now that the session exists. Doing it earlier destroyed
      // the one copy of the tokens, leaving nothing to retry with.
      if (outcome.fragmentConsumed && typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setPhase("ready");
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (password.length < MIN_LENGTH) {
        setError(`Password must be at least ${MIN_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("The two passwords do not match.");
        return;
      }

      setBusy(true);
      const supabase = supabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setBusy(false);
        // The message is deliberately generic: it must not reveal whether the
        // account exists, only that this link can no longer be used.
        setError("Could not set your password. Your link may have expired — request a new one.");
        return;
      }

      if (isRecovery) {
        // End the session the emailed link created, so the link cannot be
        // reused and the new password is proved by signing in with it.
        await supabase.auth.signOut();
        setBusy(false);
        router.replace("/login?reset=1");
        return;
      }

      setBusy(false);
      // An invited user stays signed in. `/home` sends them to the landing page
      // for their role, so the destination is never hardcoded here.
      router.replace("/home");
    },
    [password, confirmPassword, isRecovery, router],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">Nonnis Platform</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          {phase === "checking" ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking your link…
            </div>
          ) : phase === "expired" ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900">This link is no longer valid</h1>
              <p className="mt-1 text-sm text-slate-500">
                Password links can only be used once, and they expire. Request a new one and it will arrive in a moment.
              </p>
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="mt-5 flex w-full items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900">
                {isRecovery ? "Set a new password" : "Welcome — set your password"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isRecovery
                  ? "Choose a new password for your account."
                  : "Choose a password to finish setting up your account, then you will be taken straight in."}
              </p>

              {error ? (
                <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">New password</span>
                  <input
                    type="password"
                    required
                    minLength={MIN_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Confirm new password</span>
                  <input
                    type="password"
                    required
                    minLength={MIN_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </label>
                <p className="text-xs text-slate-500">At least {MIN_LENGTH} characters.</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
