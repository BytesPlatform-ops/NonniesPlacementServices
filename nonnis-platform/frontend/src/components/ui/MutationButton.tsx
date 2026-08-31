"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import type { ConfirmOptions } from "@/providers/confirm-provider";

export type MutationButtonVariant = "primary" | "secondary" | "danger" | "link" | "danger-link";

const VARIANTS: Record<MutationButtonVariant, string> = {
  primary: "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60",
  secondary: "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60",
  danger: "rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60",
  link: "text-sm font-medium text-slate-500 hover:text-umber disabled:opacity-50",
  "danger-link": "text-sm font-medium text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50",
};

/**
 * A button that runs a consequential mutation with the standard
 * confirm → pending → run → toast flow. It disables itself while pending, so a
 * repeated click can never duplicate the mutation.
 */
export function MutationButton<T>({
  children,
  pendingLabel,
  action,
  confirm,
  successToast,
  errorToast,
  onSuccess,
  variant = "link",
  className,
  disabled,
  title,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  pendingLabel?: string;
  action: () => Promise<T>;
  confirm?: ConfirmOptions;
  successToast?: string;
  errorToast?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  variant?: MutationButtonVariant;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}) {
  const runAction = useAction();
  const [pending, setPending] = useState(false);

  const onClick = () => {
    if (pending) return; // duplicate-click protection
    void runAction<T>({ confirm, run: action, success: successToast, error: errorToast, onSuccess, setPending });
  };

  const showSpinner = pending && (variant === "primary" || variant === "danger" || variant === "secondary");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={title}
      aria-label={ariaLabel}
      aria-busy={pending}
      className={cn("inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors", VARIANTS[variant], className)}
    >
      {showSpinner ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
