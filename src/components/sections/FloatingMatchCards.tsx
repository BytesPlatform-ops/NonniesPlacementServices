"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { Activity, CircleDollarSign, MapPin, Clock, Heart, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type FloatCard = {
  title: string;
  detail: string;
  icon: LucideIcon;
  /** settled anchor in a normalised 100×100 stage (matches the connector lines) */
  at: { x: number; y: number };
  /** entrance offset in px */
  from: { x: number; y: number };
  /** desktop placement classes */
  pos: string;
};

const CARDS: FloatCard[] = [
  { title: "A safer, more supportive fit", detail: "Memory care · behavioral support · medication protocol", icon: Activity, at: { x: 17, y: 22 }, from: { x: -120, y: 0 }, pos: "left-[2%] top-[8%]" },
  { title: "Funding fit", detail: "Medicaid + private contribution", icon: CircleDollarSign, at: { x: 83, y: 20 }, from: { x: 120, y: 0 }, pos: "right-[2%] top-[6%]" },
  { title: "Urgency window", detail: "Hospital discharge · 3 days", icon: Clock, at: { x: 85, y: 68 }, from: { x: 100, y: -90 }, pos: "right-[3%] bottom-[16%]" },
  { title: "Location radius", detail: "Tacoma, WA · 15 miles", icon: MapPin, at: { x: 15, y: 72 }, from: { x: 0, y: 120 }, pos: "left-[3%] bottom-[14%]" },
  { title: "Family preference", detail: "Quiet home · familiar routines", icon: Heart, at: { x: 50, y: 90 }, from: { x: -90, y: 100 }, pos: "left-1/2 -translate-x-1/2 bottom-[1%]" },
];

const badgeVariant: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease } },
};

export function FloatingMatchCards() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section aria-label="Why the match works" className="relative overflow-hidden bg-ice py-16 sm:py-24" style={{ scrollMarginTop: "5rem" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(700px 500px at 50% 55%, rgba(209,143,71,0.12), transparent 65%)" }} />
      <div className="relative mx-auto max-w-6xl px-6 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
            <span className="h-px w-8 bg-coral" aria-hidden /> Why the match works
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.7rem)] font-medium leading-[1.08] text-navy">
            Clinical context becomes clear placement options.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-ink">
            The platform organizes care level, funding, urgency, distance, and provider fit — while the RN keeps the decision human.
          </p>
        </div>

        {/* Desktop — orbit composition */}
        <div className="relative mt-10 hidden h-[540px] md:block">
          {/* connector lines */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {CARDS.map((c, i) => (
              <motion.line
                key={c.title}
                x1={c.at.x} y1={c.at.y} x2={50} y2={50}
                stroke="rgba(181,111,40,0.35)" strokeWidth={0.25} strokeDasharray="1.4 1.4"
                initial={reduce ? { pathLength: 1, opacity: 0.5 } : { pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.55 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, ease, delay: 0.3 + i * 0.08 }}
              />
            ))}
          </svg>

          {/* central RN badge */}
          <motion.div
            variants={badgeVariant}
            initial={reduce ? "show" : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative grid h-36 w-36 place-items-center rounded-full border border-mint/40 bg-midnight text-center shadow-[0_30px_80px_-24px_rgba(71,46,22,0.7)]">
              {!reduce && <span className="absolute inset-0 animate-ping rounded-full border border-mint/30" style={{ animationDuration: "3s" }} aria-hidden />}
              <div>
                <ShieldCheck className="mx-auto h-7 w-7 text-mint" aria-hidden />
                <p className="mt-1.5 font-display text-base font-medium text-white">RN Reviewed</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-mint/80">Cleared to connect</p>
              </div>
            </div>
          </motion.div>

          {/* orbiting cards */}
          {CARDS.map((c, i) => (
            <motion.div
              key={c.title}
              className={cn("absolute z-10 w-[230px]", c.pos)}
              initial={reduce ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: c.from.x, y: c.from.y }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.1 }}
            >
              <FloatCardBody card={c} />
            </motion.div>
          ))}
        </div>

        {/* Mobile — badge + stacked cards */}
        <div className="mt-10 md:hidden">
          <div className="mx-auto mb-6 grid h-28 w-28 place-items-center rounded-full border border-mint/40 bg-midnight text-center shadow-card">
            <div>
              <ShieldCheck className="mx-auto h-6 w-6 text-mint" aria-hidden />
              <p className="mt-1 font-display text-sm font-medium text-white">RN Reviewed</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-mint/80">Cleared to connect</p>
            </div>
          </div>
          <div className="space-y-3">
            {CARDS.map((c, i) => (
              <motion.div
                key={c.title}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, ease, delay: i * 0.05 }}
              >
                <FloatCardBody card={c} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatCardBody({ card }: { card: FloatCard }) {
  const Icon = card.icon;
  return (
    <article className="group rounded-2xl border border-navy/10 bg-[linear-gradient(160deg,#fffefb,#faf6ef)] p-4 shadow-[0_18px_44px_-28px_rgba(71,46,22,0.45)] transition-all duration-300 hover:-translate-y-1.5 hover:border-coral/40 hover:shadow-[0_26px_60px_-30px_rgba(181,111,40,0.5)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/12 text-coral transition-colors group-hover:bg-coral group-hover:text-white">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="font-display text-[15px] font-medium text-navy">{card.title}</p>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-ink">{card.detail}</p>
    </article>
  );
}
