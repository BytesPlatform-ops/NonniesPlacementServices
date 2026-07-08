"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Check, Loader2, Star, FileText, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { placementGallery, type PlacementGalleryCard } from "@/data/placementGallery";

const ease = [0.22, 1, 0.36, 1] as const;
const ROT = [-5, 4, -3, 6, -4, 3, -5];
const WIDTH = { sm: "w-[280px]", md: "w-[330px]", lg: "w-[380px]" } as const;

/**
 * Placement gallery — a Lando-style horizontal deck driven by vertical scroll.
 * A sticky stage translates a track of mixed cards (documents, UI, photos,
 * rankings) left as the reader scrolls; each card sits at a gentle angle and
 * straightens on hover. Mobile falls back to a scroll-snap carousel.
 */
export function PlacementGallery() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["3%", "-52%"]);

  return (
    <>
      {/* Desktop — sticky horizontal scroll */}
      <section ref={ref} aria-label="Placement journey gallery" className={cn("relative bg-ivory", reduce ? "hidden" : "hidden md:block")} style={{ height: "260vh" }}>
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          {/* faint background word */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-0 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[24vw] font-semibold leading-none text-navy/[0.035]">
            PLACEMENT
          </span>
          {/* contour glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(1100px 500px at 40% 30%, rgba(209,143,71,0.08), transparent 62%)" }} />

          <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
              <span className="h-px w-8 bg-coral" aria-hidden /> Placement journey
            </span>
            <h2 className="mt-4 max-w-xl font-display text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium leading-[1.08] text-navy">
              Every placement has moving parts. We make them visible.
            </h2>
          </div>

          <motion.div style={{ x }} className="relative mt-10 flex w-max items-center gap-6 px-6 lg:px-12">
            {placementGallery.map((card, i) => (
              <motion.div
                key={card.title}
                className={cn("shrink-0", WIDTH[card.size ?? "md"])}
                initial={{ rotate: reduce ? 0 : ROT[i % ROT.length] }}
                animate={{ rotate: reduce ? 0 : ROT[i % ROT.length] }}
                whileHover={reduce ? undefined : { rotate: 0, y: -12, scale: 1.03, transition: { duration: 0.35, ease } }}
              >
                <GalleryCard card={card} />
              </motion.div>
            ))}
          </motion.div>

          <p className="relative mx-auto mt-8 max-w-7xl px-6 text-[13px] text-slate-ink/70 lg:px-12">
            From discharge timing to provider fit — scroll to follow the journey.
          </p>
        </div>
      </section>

      {/* Mobile — scroll-snap carousel */}
      <section aria-label="Placement journey gallery" className="bg-ivory py-16 md:hidden">
        <div className="px-5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
            <span className="h-px w-8 bg-coral" aria-hidden /> Placement journey
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,7vw,2.4rem)] font-medium leading-tight text-navy">
            Every placement has moving parts. We make them visible.
          </h2>
        </div>
        <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
          {placementGallery.map((card) => (
            <div key={card.title} className="w-[78vw] shrink-0 snap-center">
              <GalleryCard card={card} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function GalleryCard({ card }: { card: PlacementGalleryCard }) {
  return (
    <article className="overflow-hidden rounded-[26px] border border-navy/10 bg-white shadow-[0_26px_60px_-34px_rgba(71,46,22,0.5)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ice">
        <CardVisual card={card} />
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy backdrop-blur">
          {card.title}
        </span>
      </div>
      <div className="border-t border-navy/8 p-4">
        <p className="text-[13px] leading-snug text-slate-ink">{card.caption}</p>
        <span className="mt-2.5 block h-0.5 w-8 rounded-full bg-coral/70" aria-hidden />
      </div>
    </article>
  );
}

/** Per-type mini visual for each gallery card. */
function CardVisual({ card }: { card: PlacementGalleryCard }) {
  if (card.image) {
    return (
      <>
        <Image src={card.image} alt={card.title} fill className="object-cover" sizes="(max-width:768px) 78vw, 380px" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2b1b0e]/45 to-transparent" />
      </>
    );
  }
  switch (card.type) {
    case "document":
      return (
        <div className="flex h-full flex-col justify-center gap-2.5 p-6">
          <FileText className="h-7 w-7 text-coral" aria-hidden />
          {[92, 78, 64, 84].map((w, i) => (
            <span key={i} className="block h-2 rounded-full bg-navy/10" style={{ width: `${w}%` }} aria-hidden />
          ))}
        </div>
      );
    case "ui":
      return (
        <div className="flex h-full flex-col gap-2 bg-midnight p-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" />
            <span className="ml-auto rounded-full bg-mint/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-mint">Live</span>
          </div>
          <div className="mt-1 rounded-lg bg-white/[0.05] p-2.5">
            <div className="flex items-center justify-between text-[11px] text-white/60">Match confidence <span className="font-display text-lg text-mint">92%</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full w-[92%] rounded-full bg-gradient-to-r from-coral to-mint" /></div>
          </div>
        </div>
      );
    case "ranking":
      return (
        <div className="flex h-full flex-col justify-center gap-2 p-4">
          {[{ s: 92, best: true }, { s: 87 }, { s: 81 }].map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-navy/8 bg-white p-2 shadow-soft">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral/12 text-[11px] font-semibold text-coral">{r.s}</span>
              <span className="h-1.5 flex-1 rounded-full bg-navy/10" />
              {r.best && <Star className="h-3.5 w-3.5 text-mint" aria-hidden />}
            </div>
          ))}
        </div>
      );
    case "calendar":
      return (
        <div className="flex h-full flex-col p-5">
          <CalendarDays className="h-6 w-6 text-coral" aria-hidden />
          <div className="mt-3 grid flex-1 grid-cols-5 gap-1.5">
            {Array.from({ length: 15 }).map((_, i) => (
              <span key={i} className={cn("rounded-md", [3, 7, 11].includes(i) ? "bg-coral/70" : "bg-navy/8")} aria-hidden />
            ))}
          </div>
        </div>
      );
    case "progress":
      return (
        <div className="flex h-full items-center justify-center gap-1.5 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center">
              <span className={cn("grid h-7 w-7 place-items-center rounded-full border-2", i < 3 ? "border-coral bg-coral text-white" : i === 3 ? "border-coral bg-white text-coral" : "border-navy/15 bg-white text-navy/30")}>
                {i < 3 ? <Check className="h-3.5 w-3.5" /> : i === 3 ? <Loader2 className="h-3.5 w-3.5" /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              {i < 4 && <span className={cn("h-0.5 w-3", i < 3 ? "bg-coral" : "bg-navy/12")} aria-hidden />}
            </div>
          ))}
        </div>
      );
    default:
      return <div className="h-full bg-ice" />;
  }
}
