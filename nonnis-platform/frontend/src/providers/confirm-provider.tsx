"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmVariant = "default" | "warning" | "danger";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const CONFIRM_CLASSES: Record<ConfirmVariant, string> = {
  default: "bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600",
  warning: "bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600",
  danger: "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600",
};

/**
 * One reusable, accessible confirmation system for the whole platform. Usage:
 * `const confirm = useConfirm(); if (await confirm({title, description, variant})) { … }`.
 * Never use `window.confirm`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }, []);

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
      // Return focus to the element that opened the dialog.
      window.setTimeout(() => returnFocusRef.current?.focus?.(), 0);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, settle]);

  const variant = pending?.variant ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby={pending.description ? "confirm-desc" : undefined}
          onClick={() => settle(false)}
        >
          <div className="w-full max-w-md rounded-lg border border-sage bg-ivory p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {variant !== "default" ? (
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${variant === "danger" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2 id="confirm-title" className="font-display text-base font-semibold text-umber">{pending.title}</h2>
                {pending.description ? <p id="confirm-desc" className="mt-1.5 text-sm text-slate-ink">{pending.description}</p> : null}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => settle(true)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${CONFIRM_CLASSES[variant]}`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
