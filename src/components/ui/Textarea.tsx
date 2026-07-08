"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldWrap } from "./FormField";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, id, className, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrap label={label} htmlFor={fieldId} error={error} required={required} hint={hint} className={className}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(
          "w-full resize-y rounded-xl border bg-[#fffdf9] px-4 py-3 text-base text-navy placeholder:text-slate-ink/55",
          "transition-[border-color,box-shadow,background-color] duration-200 hover:border-navy/40 focus:outline-none focus:border-blue focus:bg-white focus:ring-4 focus:ring-mint/30",
          error ? "border-coral focus:border-coral focus:ring-coral/15" : "border-navy/25",
        )}
        {...props}
      />
    </FieldWrap>
  );
});
