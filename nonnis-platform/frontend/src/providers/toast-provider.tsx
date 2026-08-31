"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 4;
const DURATIONS: Record<ToastType, number> = { success: 4000, info: 4000, warning: 5000, error: 6000 };

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

/** Platform-wide toast notifications. Concise, auto-dismissing, screen-reader friendly. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, type, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[type]));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
      warning: (m) => push("warning", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-card ${STYLES[t.type]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="flex-1 leading-snug">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
