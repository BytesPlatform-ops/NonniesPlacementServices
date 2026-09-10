"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isRecoveryFragment } from "@/lib/auth-recovery";

type Phase = "checking" | "ready" | "expired";

const MIN_LENGTH = 8;

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/**
 * Sets a password for an invited user, or for someone who followed a password
 * recovery link.
 *
 * Both arrive here holding a Supabase session that authorizes exactly one thing:
 * changing their own password. The page therefore proves that session exists
 * before showing the form — otherwise `updateUser` fails and the only feedback
 * is a generic error on a form the visitor should never have seen.
 *
 * A recovery link can arrive two ways, and both are handled:
 *  - `?code=` (PKCE), which `/auth/callback` exchanges server-side before
 *    redirecting here with a session cookie already set;
 *  - `#access_token=…&type=recovery` (implicit), which only the browser can
 *    read. The Supabase browser client consumes that fragment on creation and
 *    emits PASSWORD_RECOVERY, which is what the listener below waits for.
 *
 * Nothing here is ever logged: not the password, not the tokens, not the
 * fragment that carries them.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [isRecovery, setIsRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let settled = false;

    // Reading the fragment before any await: the client consumes it, so this is
    // the last moment the link type is still visible.
    if (typeof window !== "undefined" && isRecoveryFragment(window.location.hash)) {
      setIsRecovery(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        settled = true;
        setPhase("ready");
        return;
      }
      if (session) {
        settled = true;
        setPhase("ready");
      }
    });

    // An invite handled by `/auth/callback` already has a session cookie, so
    // there is no event to wait for — check directly as well.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setPhase("ready");
      }
    });

    // No session and no recovery event means the link was already used, has
    // expired, or the page was opened directly.
    const timer = setTimeout(() => {
      if (!settled) setPhase("expired");
    }, 2500);

    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      // The fragment is cleared from the address bar so the tokens do not sit
      // in history or get copied out of the URL bar.
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
  }, []);

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
                {isRecovery ? "Set a new password" : "Set your password"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isRecovery
                  ? "Choose a new password for your account."
                  : "Choose a password to finish setting up your account."}
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
