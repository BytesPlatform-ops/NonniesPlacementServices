import { ShieldCheck, MapPin, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small marketplace primitives — care type, funding, RN-reviewed, availability, match ring. */

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

export function RNReviewedBadge({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
        tone === "dark" ? "bg-mint/20 text-mint" : "bg-teal text-white",
        className,
      )}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden /> RN Reviewed
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

export function AvailabilityBadge({ beds }: { beds: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] font-bold text-teal backdrop-blur">
      <BedDouble className="h-3.5 w-3.5" aria-hidden /> {beds} bed{beds === 1 ? "" : "s"}
    </span>
  );
}

/** Circular match-score ring. */
export function MatchScoreBadge({ score, size = 48, tone = "light" }: { score: number; size?: number; tone?: "light" | "dark" }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone === "dark" ? "rgba(255,255,255,0.12)" : "rgba(71,46,22,0.12)"} strokeWidth="3.5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#matchgrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <defs>
          <linearGradient id="matchgrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b56f28" />
            <stop offset="100%" stopColor="#d18f47" />
          </linearGradient>
        </defs>
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center font-display text-sm font-bold", tone === "dark" ? "text-mint" : "text-teal")}>
        {score}
      </span>
    </div>
  );
}
