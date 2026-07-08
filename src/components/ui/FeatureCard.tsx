import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = "light",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      data-reveal
      className={cn(
        "group h-full rounded-3xl border p-6 transition-all duration-300",
        tone === "dark"
          ? "border-white/10 bg-white/[0.04] hover:border-mint/30 hover:bg-white/[0.07]"
          : "border-navy/10 bg-white shadow-soft hover:-translate-y-1.5 hover:border-coral/40 hover:shadow-[0_30px_70px_-32px_rgba(181,111,40,0.45)]",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-105",
          tone === "dark"
            ? "bg-mint/15 text-mint group-hover:bg-mint/25"
            : "bg-ice text-blue group-hover:bg-gradient-to-br group-hover:from-coral group-hover:to-coral-600 group-hover:text-white group-hover:shadow-soft",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className={cn("mt-5 font-display text-xl font-medium", tone === "dark" ? "text-white" : "text-navy")}>
        {title}
      </h3>
      <p className={cn("mt-2 text-[0.95rem] leading-relaxed", tone === "dark" ? "text-white/65" : "text-slate-ink")}>
        {description}
      </p>
    </div>
  );
}
