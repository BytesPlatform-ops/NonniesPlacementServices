import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpecialtyTagVariant = "default" | "gold" | "dark" | "outline";

/**
 * Reusable specialty / capability chip used across cards, dashboards, and
 * provider mockups (memory care, dementia, behavioral health, etc.). Consistent
 * warm-ivory + bronze system so specialty positioning reads the same everywhere.
 */
export function SpecialtyTag({
  label,
  variant = "default",
  icon: Icon,
  className,
}: {
  label: string;
  variant?: SpecialtyTagVariant;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "specialty-tag inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium leading-none transition-[transform,border-color,box-shadow] duration-200",
        variant === "default" &&
          "border-[rgba(181,111,40,0.28)] bg-[rgba(250,247,242,0.82)] text-[#472E16]",
        variant === "gold" &&
          "border-[rgba(209,143,71,0.45)] bg-[rgba(209,143,71,0.16)] text-[#472E16]",
        variant === "dark" &&
          "border-[rgba(209,143,71,0.35)] bg-[rgba(250,247,242,0.10)] text-[#FAF7F2]",
        variant === "outline" &&
          "border-[rgba(209,143,71,0.4)] bg-transparent text-[#472E16]",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
      {label}
    </span>
  );
}
