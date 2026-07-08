"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

type FieldWrapProps = {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

/** Shared label + error scaffold. Errors are linked to the control via aria-describedby (§21). */
export function FieldWrap({ label, htmlFor, error, required, hint, children, className }: FieldWrapProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-navy">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-ink/80">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

// Clearly-visible fields: explicit sage-green border + subtle tinted fill so the
// input reads as a recessed control on white/ivory cards (contrast, §Forms).
const controlBase =
  "w-full rounded-xl border border-navy/25 bg-[#fffdf9] px-4 py-3 text-base text-navy placeholder:text-slate-ink/55 " +
  "transition-[border-color,box-shadow,background-color] duration-200 focus:outline-none focus-visible:outline-none " +
  "hover:border-navy/40 focus:border-blue focus:bg-white focus:ring-4 focus:ring-mint/30";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const FormField = forwardRef<HTMLInputElement, InputProps>(function FormField(
  { label, error, hint, required, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrap label={label} htmlFor={fieldId} error={error} required={required} hint={hint} className={className}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        aria-describedby={cn(error && `${fieldId}-error`, hint && `${fieldId}-hint`) || undefined}
        className={cn(controlBase, error && "border-coral focus:border-coral focus:ring-coral/15")}
        {...props}
      />
    </FieldWrap>
  );
});
