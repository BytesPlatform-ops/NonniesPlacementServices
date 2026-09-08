import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small marketplace primitives — care type, funding, location.
 *
 * The availability, RN-reviewed and match-score badges that used to live here
 * were removed with the demo listings they were built for: bed counts are
 * private in the public provider serializer, and match scores and RN-review
 * status have no public source at all, so nothing on the site can render them
 * truthfully.
 */

export function CareTypePill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-teal/10 px-2.5 py-1 text-[0.7rem] font-semibold text-teal", className)}>
      {label}
    </span>
  );
}

export function FundingPill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-sand/70 px-2.5 py-1 text-[0.7rem] font-medium text-navy/80", className)}>
      {label}
    </span>
  );
}

export function LocationChip({ city, tone = "light" }: { city: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone === "dark" ? "text-white/60" : "text-slate-ink")}>
      <MapPin className="h-3.5 w-3.5 text-blue" aria-hidden /> {city}
    </span>
  );
}
