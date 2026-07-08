"use client";

import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldWrap } from "./FormField";
import type { Option } from "@/data/careTypes";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
  error?: string;
  hint?: string;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, hint, required, id, placeholder = "Select an option", className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrap label={label} htmlFor={fieldId} error={error} required={required} hint={hint} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          defaultValue=""
          className={cn(
            "w-full appearance-none rounded-xl border bg-[#fffdf9] px-4 py-3 pr-10 text-base text-navy",
            "transition-[border-color,box-shadow,background-color] duration-200 hover:border-navy/40 focus:outline-none focus:border-blue focus:bg-white focus:ring-4 focus:ring-mint/30",
            error ? "border-coral focus:border-coral focus:ring-coral/15" : "border-navy/25",
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-ink"
          aria-hidden
        />
      </div>
    </FieldWrap>
  );
});
