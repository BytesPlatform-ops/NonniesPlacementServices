"use client";

import { cn } from "@/lib/utils";

export type SegmentOption = { value: string; label: string };

/**
 * Accessible segmented toggle with an animated sliding indicator (§F, §17).
 * Equal-width segments; the indicator translates on `transform` only.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  tone = "light",
  className,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const pct = 100 / options.length;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex w-full max-w-xl rounded-full p-1.5",
        tone === "dark" ? "bg-white/10 ring-1 ring-white/15" : "bg-ice ring-1 ring-navy/10",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-1.5 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          tone === "dark" ? "bg-mint" : "bg-white shadow-soft",
        )}
        style={{
          width: `calc(${pct}% - 0.375rem)`,
          transform: `translateX(calc(${activeIndex} * (100% + 0.375rem)))`,
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex-1 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
              active
                ? tone === "dark"
                  ? "text-midnight"
                  : "text-navy"
                : tone === "dark"
                  ? "text-white/70 hover:text-white"
                  : "text-slate-ink hover:text-navy",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
