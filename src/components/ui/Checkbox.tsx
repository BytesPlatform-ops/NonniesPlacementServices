"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, required, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-navy/30 text-teal accent-teal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral"
          {...props}
        />
        <label htmlFor={fieldId} className="text-sm leading-relaxed text-slate-ink">
          {label}
          {required && <span className="ml-0.5 text-coral">*</span>}
        </label>
      </div>
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
});
