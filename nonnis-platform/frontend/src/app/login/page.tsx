"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

          <form onSubmit={mode === "signin" ? onSignIn : onReset} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </label>

            {mode === "signin" ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </label>
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
