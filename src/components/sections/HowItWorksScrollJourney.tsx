"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { howItWorksSteps, ACCENT_STYLES, type HowItWorksStep } from "@/data/howItWorks";

const ease = [0.22, 1, 0.36, 1] as const;
const N = howItWorksSteps.length;
// Shared scroll breakpoints — one per step, kept strictly within [0,1] so the
// derived transforms never feed Motion an out-of-range keyframe offset.
const BREAK = Array.from({ length: N }, (_, j) => j / (N - 1));

/**
 * How it works — a premium scroll journey. A tall section pins a sticky stage;
 * as the reader scrolls, each placement "document" card slides to the centre
 * while the previous drifts up-left and the next waits down-right. Left column
 * holds the editorial heading + a live progress rail. Reduced-motion and mobile
 * fall back to a clean stacked reveal. Transform/opacity only — no layout shift.
 */
export function HowItWorksScrollJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(N - 1, Math.max(0, Math.round(v * (N - 1))));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  return (
    <>
      {/* Desktop — pinned scroll journey */}
      <section
        ref={ref}
        id="how-it-works"
        aria-label="How placement works — five coordinated steps"
        className={cn("relative bg-ivory", reduce ? "hidden" : "hidden md:block")}
        style={{ height: "500vh", scrollMarginTop: "5rem" }}
      >
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          {/* soft paper grain / warm radial */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(1200px 600px at 78% 40%, rgba(209,143,71,0.10), transparent 60%)" }} />
          <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-12">
            {/* Left — editorial + progress rail */}
            <div className="max-w-md">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
                <span className="h-px w-8 bg-coral" aria-hidden /> How it works
              </span>
              <h2 className="mt-5 font-display text-[clamp(2rem,3.4vw,3.1rem)] font-medium leading-[1.06] text-navy">
                From a stressful moment<br className="hidden sm:block" /> to a settled placement
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-ink">
                Five coordinated steps, one Registered Nurse guiding the way — the product does the heavy lifting, the RN makes the call.
              </p>

              <ol className="mt-9 space-y-1.5">
                {howItWorksSteps.map((s, i) => {
                  const on = i === active;
                  return (
                    <li key={s.step}>
                      <button
                        type="button"
                        aria-current={on}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-colors",
                          on ? "bg-white shadow-soft" : "hover:bg-white/50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold tabular-nums transition-all",
                            on ? "bg-coral text-white" : "bg-navy/8 text-navy/50",
                          )}
                        >
                          {s.step}
                        </span>
                        <span className={cn("font-display text-[15px] transition-colors", on ? "text-navy" : "text-navy/45")}>
                          {s.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Right — card stage */}
            <div className="relative h-[500px] w-full">
              {howItWorksSteps.map((step, i) => (
                <JourneyCard key={step.step} step={step} index={i} active={active} progress={scrollYProgress} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile / reduced-motion — stacked reveal */}
      <section
        id={reduce ? "how-it-works" : undefined}
        aria-label="How placement works"
        className={cn("relative bg-ivory py-16", reduce ? "block" : "block md:hidden")}
        style={{ scrollMarginTop: "5rem" }}
      >
        <div className="mx-auto max-w-2xl px-5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
            <span className="h-px w-8 bg-coral" aria-hidden /> How it works
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,7vw,2.6rem)] font-medium leading-tight text-navy">
            From a stressful moment to a settled placement
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-ink">
            Five coordinated steps, one Registered Nurse guiding the way — the product does the heavy lifting, the RN makes the call.
          </p>

          <div className="mt-9 space-y-5">
            {howItWorksSteps.map((step) => (
              <motion.div
                key={step.step}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease }}
              >
                <PaperCard step={step} active />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function JourneyCard({ step, index: i, active, progress }: { step: HowItWorksStep; index: number; active: number; progress: MotionValue<number> }) {
  // At breakpoint j the active card is j; this card (i) sits centred when i===j,
  // waits down-right when it's upcoming (i>j), drifts up-left once passed (i<j).
  const x = useTransform(progress, BREAK, BREAK.map((_, j) => (i > j ? 80 : i < j ? -80 : 0)));
  const y = useTransform(progress, BREAK, BREAK.map((_, j) => (i > j ? 70 : i < j ? -36 : 0)));
  const rotate = useTransform(progress, BREAK, BREAK.map((_, j) => (i > j ? 3 : i < j ? -3 : 0)));
  const scale = useTransform(progress, BREAK, BREAK.map((_, j) => (i === j ? 1 : 0.9)));
  const opacity = useTransform(progress, BREAK, BREAK.map((_, j) => {
    const d = Math.abs(i - j);
    return d === 0 ? 1 : d === 1 ? 0.5 : 0.15;
  }));
  const dist = Math.abs(i - active);
  const zIndex = dist === 0 ? 30 : dist === 1 ? 20 : 10;

  return (
    <div className="absolute left-1/2 top-1/2 w-[min(92%,460px)] -translate-x-1/2 -translate-y-1/2" style={{ zIndex }}>
      <motion.div style={{ x, y, rotate, scale, opacity }} className="will-change-transform">
        <PaperCard step={step} active={i === active} />
      </motion.div>
    </div>
  );
}

/** The placement "document" card — ivory paper, faint serif number, warm accent. */
function PaperCard({ step, active = false }: { step: HowItWorksStep; active?: boolean }) {
  const Icon = step.icon;
  const a = ACCENT_STYLES[step.accent];
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[34px] border bg-[linear-gradient(160deg,#fffefb,#faf6ef)] p-7 sm:p-9",
        active ? cn("border-transparent", a.ring) : "border-navy/10 shadow-[0_20px_50px_-32px_rgba(71,46,22,0.4)]",
      )}
    >
      {/* faint serif number watermark */}
      <span className={cn("pointer-events-none absolute -right-2 -top-6 select-none font-display text-[9rem] font-semibold leading-none", a.num)} aria-hidden>
        {step.step}
      </span>

      <div className="relative flex items-center gap-3">
        <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", a.chip)}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-ink/60">Step {step.step}</span>
      </div>

      <h3 className="relative mt-6 font-display text-2xl font-medium text-navy sm:text-[1.7rem]">{step.title}</h3>
      <p className="relative mt-3 max-w-md text-[15px] leading-relaxed text-slate-ink">{step.description}</p>

      <span className={cn("relative mt-7 block h-1 w-16 rounded-full", a.line)} aria-hidden />
    </article>
  );
}
