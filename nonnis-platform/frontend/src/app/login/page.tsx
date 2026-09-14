"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { PasswordField } from "@/components/ui/PasswordField";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isPasswordSetupFragment } from "@/lib/auth-recovery";

type Mode = "signin" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // An invitation or a recovery link arrives in the implicit form, carrying
    // its tokens in the URL fragment. A fragment never reaches the server, so
    // neither `/auth/callback` nor middleware can act on it — middleware sees no
    // session cookie and funnels the visitor here, fragment still attached.
    // Without this an invited user is shown a sign-in form and asked for a
    // password they have never set.
    //
    // Read before this page touches the Supabase client at all: creating the
    // client consumes the fragment, and then the link type is gone.
    const hash = window.location.hash;
    if (isPasswordSetupFragment(hash)) {
      window.location.replace(`/auth/update-password${hash}`);
      return;
    }

    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      setNotice("Your password has been updated. Sign in with your new password.");
    }
  }, []);

  const onSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError("Invalid email or password.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    router.replace(params.get("redirectTo") || "/home");
  };

  const onReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setBusy(false);
    if (resetError) {
      setError("Could not send the reset email. Please try again.");
      return;
    }
    setNotice("If an account exists for that email, a password reset link is on its way.");
    setMode("signin");
  };

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
          <h1 className="text-lg font-semibold text-slate-900">
            {mode === "signin" ? "Sign in" : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "signin" ? "Access the discharge operations console." : "We'll email you a reset link."}
          </p>

          {notice ? (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
          ) : null}
          {error ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          {/*
            Password managers identify a credential from the field's identity,
            not from its label: a stable `id`/`name` pair plus the autocomplete
            token. Without a `name` the browser has nothing to key the saved
            credential on, which is why the save prompt was unreliable even
            though the autocomplete tokens were already present.

            `username` rather than `email` on the identifier: that is the token
            the specification defines for a sign-in identifier, and
            `username` + `current-password` is the pairing Chrome, Safari and
            1Password look for when deciding a form is a login form. The input
            stays `type="email"` so mobile keyboards and validation are
            unchanged.
          */}
          {/*
            `method="post"` is a security control, not a style: it must never be
            removed. Submission is handled in JavaScript, but if the form is
            submitted before React has hydrated — Enter pressed on a slow load —
            the browser performs a NATIVE submit with the handler not yet
            attached. A form with no method defaults to GET, which would put
            every named field, the password included, into the address bar,
            browser history and any server access log. POST puts them in a body
            that goes nowhere instead.
          */}
          <form
            id={mode === "signin" ? "signin-form" : "reset-form"}
            name={mode === "signin" ? "signin" : "reset"}
            method="post"
            onSubmit={mode === "signin" ? onSignIn : onReset}
            className="mt-5 space-y-4"
          >
            <label className="block" htmlFor="email">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>

            {mode === "signin" ? (
              <PasswordField
                id="current-password"
                name="password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
              />
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === "signin" ? "Sign in" : "Send reset link"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "reset" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 text-sm text-brand-700 hover:underline"
          >
            {mode === "signin" ? "Forgot your password?" : "Back to sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
