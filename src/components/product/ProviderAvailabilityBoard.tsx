"use client";

import { useRef } from "react";
import { BedDouble, MapPin, ShieldCheck, Star, Filter } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";
import { SpecialtyTag } from "@/components/ui/SpecialtyTag";

const FACILITIES = [
  { name: "Cedar Grove AFH", type: "Adult Family Home", beds: 2, price: "$$", funding: "Private · Medicaid", dist: "6 mi", score: 92, tone: "from-teal/25 to-blue/20", specialties: ["Behavioral Health", "Alzheimer's Care", "Psychiatric Support"] },
  { name: "Willow Bend Memory Care", type: "Memory Care", beds: 1, price: "$$$", funding: "Private", dist: "8 mi", score: 88, tone: "from-blue/25 to-navy/20", specialties: ["Alzheimer's Care", "Dementia"] },
  { name: "Harborlight Assisted Living", type: "Assisted Living", beds: 4, price: "$$$", funding: "Private · VA", dist: "9 mi", score: 84, tone: "from-coral/20 to-teal/20", specialties: ["Dementia", "Medication support"] },
  { name: "Rainier Skilled Nursing", type: "Skilled Nursing", beds: 3, price: "$$$$", funding: "Medicare · Medicaid", dist: "12 mi", score: 80, tone: "from-navy/25 to-blue/15", specialties: ["Psychiatric Support", "Medication protocols"] },
];

const FILTERS = ["Specialty", "Funding", "Price", "Distance", "Beds"];

/** Provider Availability Board — facility cards with beds, care type, price, funding, distance, match score + RN-reviewed badge. */
export function ProviderAvailabilityBoard({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      const cards = el.querySelectorAll<HTMLElement>("[data-card]");
      gsap.set(cards, { opacity: 0, y: 20 });
      return onInView(el, () => {
        gsap.to(cards, { opacity: 1, y: 0, stagger: 0.09, duration: 0.6, ease: "power3.out" });
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-3xl border shadow-card",
        dark ? "border-white/10 bg-midnight-800/90 backdrop-blur-xl" : "border-navy/10 bg-white",
        className,
      )}
    >
      <div className={cn("flex items-center justify-between gap-3 border-b px-5 py-3.5", dark ? "border-white/10" : "border-navy/10")}>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold", dark ? "bg-mint/15 text-mint" : "bg-navy text-white")}>
            <Filter className="h-3.5 w-3.5" aria-hidden /> Availability board
          </span>
          <span className={cn("text-xs", dark ? "text-white/40" : "text-slate-ink/70")}>Live near Tacoma, WA</span>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          {FILTERS.map((f) => (
            <span key={f} className={cn("rounded-full px-2.5 py-1 text-[0.7rem] font-medium", dark ? "bg-white/5 text-white/60" : "bg-ice text-slate-ink")}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {FACILITIES.map((f) => (
          <div
            key={f.name}
            data-card
            className={cn(
              "overflow-hidden rounded-2xl border transition-colors",
              dark ? "border-white/10 bg-white/[0.03] hover:border-mint/30" : "border-navy/10 bg-white hover:border-teal/40",
            )}
          >
            <div className={cn("relative h-16 bg-gradient-to-br", f.tone)}>
              <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-bold text-teal">
                <ShieldCheck className="h-3 w-3" aria-hidden /> RN Reviewed
              </span>
            </div>
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-semibold", dark ? "text-white" : "text-navy")}>{f.name}</p>
                  <p className={cn("text-xs", dark ? "text-white/50" : "text-slate-ink")}>{f.type}</p>
                </div>
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold", dark ? "bg-mint/15 text-mint" : "bg-teal/10 text-teal")}>
                  {f.score}
                </div>
              </div>
              <div className={cn("mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem]", dark ? "text-white/55" : "text-slate-ink")}>
                <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden /> {f.beds} open</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden /> {f.dist}</span>
                <span className="font-semibold">{f.price}</span>
                <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current" aria-hidden /> {f.funding}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {f.specialties.map((s) => (
                  <SpecialtyTag key={s} label={s} variant={dark ? "dark" : "default"} className="px-2 py-0.5 text-[0.62rem]" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
