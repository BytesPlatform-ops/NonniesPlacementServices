import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/animation/AnimatedCounter";

export function StatCard({
  value,
  prefix,
  suffix,
  label,
  tone = "light",
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      data-reveal
      className={cn(
        "rounded-3xl border p-6 text-center sm:text-left",
        tone === "dark" ? "border-white/10 bg-white/[0.04]" : "border-navy/10 bg-ice/60",
        className,
      )}
    >
      <div
        className={cn(
          "font-display text-[clamp(2.25rem,5vw,3.25rem)] font-semibold leading-none tracking-tight",
          tone === "dark" ? "text-mint" : "text-teal",
        )}
      >
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
      </div>
      <p className={cn("mt-2 text-sm font-medium", tone === "dark" ? "text-white/65" : "text-slate-ink")}>
        {label}
      </p>
    </div>
  );
}
