"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { Button } from "@/components/ui/Button";
import { journeyFrames } from "@/data/journey";

const ease = [0.22, 1, 0.36, 1] as const;

// Wide, overlapping opacity windows so neighbouring frames blend for a long
// stretch of scroll — a soft dissolve, never a hard cut.
const opacityWindows: [number[], number[]][] = [
  [[0, 0.2, 0.36], [1, 1, 0]],
  [[0.16, 0.34, 0.48, 0.62], [0, 1, 1, 0]],
  [[0.46, 0.6, 0.72, 0.85], [0, 1, 1, 0]],
  [[0.7, 0.85, 1], [0, 1, 1]],
];

export function ResidentJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = v >= 0.72 ? 3 : v >= 0.48 ? 2 : v >= 0.24 ? 1 : 0;
    setActive((prev) => (prev === idx ? prev : idx));
  });

  const zoom = useTransform(scrollYProgress, [0, 1], [1.12, 1.0]);
  const barScaleX = scrollYProgress;

  return (
    <>
      {/* Desktop — full-bleed sticky morph */}
      <section
        ref={ref}
        className="relative hidden md:block"
        style={{ height: "420vh" }}
        aria-label="From uncertainty to comfort — a resident's journey"
      >
        <div className="sticky top-0 h-screen overflow-hidden bg-midnight">
          <motion.div className="absolute inset-0" style={{ scale: reduce ? 1 : zoom }}>
            {journeyFrames.map((frame, i) => (
              <ImageLayer key={frame.id} frame={frame} progress={scrollYProgress} windows={opacityWindows[i]} priority={i === 0} reduce={!!reduce} />
            ))}
          </motion.div>

          {/* Readability scrims */}
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(43,27,14,0.9) 0%, rgba(43,27,14,0.6) 34%, rgba(43,27,14,0.15) 62%, rgba(43,27,14,0) 82%)" }} />
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(43,27,14,0.5) 0%, rgba(43,27,14,0) 42%)" }} />

          <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-5 sm:px-8 lg:px-12">
            <div className="max-w-xl text-white">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-mint">
                <span className="h-px w-8 bg-mint" aria-hidden /> A Resident&apos;s Journey
              </span>
              <h2 className="mt-5 font-display text-[clamp(2.2rem,3.6vw,3.6rem)] font-medium leading-[1.05]">
                From uncertainty to comfort — one careful step at a time.
              </h2>

              {/* Progress rail */}
              <div className="mt-8 flex items-center gap-4">
                <span className="font-display text-2xl">0{active + 1}</span>
                <div className="relative h-px flex-1 overflow-hidden bg-white/25">
                  <motion.div className="absolute inset-y-0 left-0 w-full origin-left bg-mint" style={{ scaleX: barScaleX }} />
                </div>
                <span className="font-display text-2xl text-white/50">04</span>
              </div>

              {/* Morphing text block */}
              <div className="relative mt-8 min-h-[220px]">
                {journeyFrames.map((frame, i) => (
                  <motion.div
                    key={frame.id}
                    aria-hidden={active !== i}
                    initial={false}
                    animate={{ opacity: active === i ? 1 : 0, y: active === i ? 0 : 20 }}
                    transition={{ duration: 0.7, ease }}
                    className="absolute inset-0"
                    style={{ pointerEvents: active === i ? "auto" : "none" }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mint">{frame.eyebrow}</span>
                    <h3 className="mt-3 font-display text-3xl sm:text-4xl">{frame.title}</h3>
                    <p className="mt-4 max-w-md font-display text-xl text-white/85">{frame.text}</p>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">{frame.microcopy}</p>
                    {i === journeyFrames.length - 1 && (
                      <div className="mt-7">
                        <Button href="/families#find-a-bed" variant="dark">Start your placement</Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile — stacked full-bleed cards */}
      <section className="relative bg-midnight py-14 md:hidden">
        <div className="mx-auto max-w-7xl px-5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-mint">
            <span className="h-px w-8 bg-mint" aria-hidden /> A Resident&apos;s Journey
          </span>
          <h2 className="mt-4 font-display text-[clamp(2rem,8vw,2.75rem)] font-medium leading-tight text-white">
            From uncertainty to comfort — one careful step at a time.
          </h2>

          <div className="mt-8 space-y-6">
            {journeyFrames.map((frame, i) => (
              <motion.article
                key={frame.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease }}
                className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-white/10 shadow-card"
              >
                <Image src={frame.image} alt={frame.alt} fill className="object-cover" sizes="100vw" />
                <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(43,27,14,0.92) 4%, rgba(43,27,14,0.15) 46%, rgba(43,27,14,0) 70%)" }} />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint">0{i + 1} / 04 · {frame.eyebrow}</span>
                  <h3 className="mt-2 font-display text-2xl">{frame.title}</h3>
                  <p className="mt-1 font-display text-lg text-white/85">{frame.text}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/70">{frame.microcopy}</p>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-8">
            <Button href="/families#find-a-bed" variant="dark" size="lg" className="w-full">Start your placement</Button>
          </div>
        </div>
      </section>
    </>
  );
}

function ImageLayer({
  frame,
  progress,
  windows,
  priority,
  reduce,
}: {
  frame: (typeof journeyFrames)[number];
  progress: MotionValue<number>;
  windows: [number[], number[]];
  priority: boolean;
  reduce: boolean;
}) {
  const opacity = useTransform(progress, windows[0], windows[1]);
  return (
    <motion.div className="absolute inset-0" style={{ opacity: reduce ? 1 : opacity }}>
      <Image src={frame.image} alt={frame.alt} fill priority={priority} className="object-cover" style={{ objectPosition: "center 32%" }} sizes="100vw" />
    </motion.div>
  );
}
