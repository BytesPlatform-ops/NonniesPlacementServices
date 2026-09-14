"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A password input with a show/hide control.
 *
 * The toggle flips the `type` of the SAME element and nothing else. It does not
 * swap one input for another, and it does not remount anything — doing either
 * would destroy the DOM node a password manager has been tracking, which is
 * exactly the failure mode this form was recently fixed for. `id`, `name` and
 * `autoComplete` stay constant across the toggle for the same reason.
 *
 * The button is `type="button"`: inside a form, a bare button submits, and
 * revealing a password must never sign anyone in.
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  required = false,
  minLength,
  className,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `current-password` when signing in, `new-password` when setting one. */
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  className?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="block">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          // The only thing the toggle changes.
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            // Room on the right so a long password never runs under the button.
            "w-full rounded-md border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600",
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // The label says what pressing it will do, which is what a screen
          // reader user needs; `aria-pressed` carries the current state.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-600"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
