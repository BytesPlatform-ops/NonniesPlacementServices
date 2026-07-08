"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { Check, Loader2, Activity, MapPin, CircleDollarSign, Clock, Stethoscope, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchProfile, matchResults, progressSteps } from "@/data/matchConsole";

const ease = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

/** Count 0 → target with an eased ramp once in view (final value if reduced-motion). */
function useCountUp(target: number, active: boolean, reduce: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    let raf = 0;
    let startTs = 0;
    const dur = 1400;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const t = Math.min(1, (now - startTs) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduce]);
  // Reduced-motion users always see the final value without animating.
  return reduce ? target : val;
}

export function AnimatedMatchConsole() {
  const consoleRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(consoleRef, { once: true, margin: "-120px" });
  const confidence = useCountUp(92, inView, reduce);

  const profileRows = [
    { icon: Activity, label: "Care level", value: matchProfile.careLevel },
    { icon: CircleDollarSign, label: "Funding", value: matchProfile.funding },
    { icon: MapPin, label: "Location", value: matchProfile.location },
    { icon: Clock, label: "Urgency", value: matchProfile.urgency },
  ];

  return (
    <section id="match-console" aria-label="See the match happen" className="relative overflow-x-clip bg-ivory py-16 sm:py-24" style={{ scrollMarginTop: "5rem" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(900px 500px at 82% 30%, rgba(209,143,71,0.10), transparent 62%)" }} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 lg:px-12">
        {/* Left — editorial + progress card */}
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
            <span className="h-px w-8 bg-coral" aria-hidden /> See the match happen
          </span>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,3.2vw,2.7rem)] font-medium leading-[1.08] text-navy">
            The RN-reviewed match, in real time
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-ink">
            As intake and assessment complete, the platform ranks the strongest care-fit options — and a nurse clears them before they reach the family.
          </p>
          <div className="mt-8">
            <ProgressCard reduce={reduce} />
          </div>
        </div>

        {/* Right — animated console */}
        <motion.div
          ref={consoleRef}
          initial={reduce ? { opacity: 1 } : { opacity: 0, x: 48 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease }}
          className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-midnight p-5 shadow-[0_50px_120px_-40px_rgba(43,27,14,0.7)] sm:p-6"
        >
          {/* top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    initial={reduce ? { opacity: 1 } : { scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.12, duration: 0.35, ease }}
                    className="h-2.5 w-2.5 rounded-full bg-white/25"
                  />
                ))}
              </div>
              <span className="text-[13px] font-medium text-white/70">Nonni&apos;s · Match Console</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-mint">
              <span className="relative flex h-1.5 w-1.5">
                {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-70" />}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
              </span>
              Live
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Patient profile */}
            <motion.div variants={container} initial={reduce ? "show" : "hidden"} whileInView="show" viewport={{ once: true, margin: "-100px" }} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <motion.p variants={rise} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Patient profile</motion.p>
              <motion.p variants={rise} className="mt-1 font-display text-lg text-white">{matchProfile.caseId}</motion.p>
              <div className="mt-4 space-y-3">
                {profileRows.map((r) => {
                  const Icon = r.icon;
                  return (
                    <motion.div key={r.label} variants={rise} className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2 text-[12px] text-white/45">
                        <Icon className="h-3.5 w-3.5" aria-hidden /> {r.label}
                      </span>
                      <span className="max-w-[58%] text-right text-[12px] font-medium text-white/85">{r.value}</span>
                    </motion.div>
                  );
                })}
              </div>
              <motion.div variants={rise} className="mt-4 flex items-start gap-2 rounded-xl border border-mint/20 bg-mint/8 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" aria-hidden />
                <span className="text-[11px] leading-snug text-mint/90">{matchProfile.note}</span>
              </motion.div>
            </motion.div>

            {/* Confidence + ranked communities */}
            <div className="min-w-0 space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[12px] text-white/55"><Stethoscope className="h-3.5 w-3.5" aria-hidden /> Match confidence</span>
                  <span className="font-display text-3xl font-semibold tabular-nums text-mint">{confidence}<span className="text-lg">%</span></span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full origin-left rounded-full bg-gradient-to-r from-coral to-mint"
                    initial={reduce ? { scaleX: 0.92 } : { scaleX: 0 }}
                    whileInView={{ scaleX: 0.92 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1.4, ease }}
                  />
                </div>
              </div>

              <motion.div variants={container} initial={reduce ? "show" : "hidden"} whileInView="show" viewport={{ once: true, margin: "-80px" }} className="space-y-2.5">
                {matchResults.map((m) => (
                  <motion.div key={m.name} variants={rise} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 transition-colors hover:border-mint/30 hover:bg-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint/12 font-display text-sm font-semibold text-mint">{m.score}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-medium text-white">{m.name}</p>
                          {m.badge && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-1.5 py-0.5 text-[9px] font-bold uppercase text-midnight">
                              <Star className="h-2.5 w-2.5" aria-hidden /> {m.badge}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-white/45">{m.detail}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        className="h-full origin-left rounded-full bg-gradient-to-r from-coral/80 to-mint"
                        initial={reduce ? { scaleX: m.score / 100 } : { scaleX: 0 }}
                        whileInView={{ scaleX: m.score / 100 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 1.2, ease, delay: 0.2 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** Left-column placement progress rail — 3 done, provider matching active, rest pending. */
function ProgressCard({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const doneCount = progressSteps.filter((s) => s.state === "done").length;
  // line fills through the completed nodes + halfway into the active node
  const fill = (doneCount - 0.5) / (progressSteps.length - 1);

  return (
    <div ref={ref} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-navy">Placement progress</p>
        <span className="text-[11px] font-medium text-coral">{matchProfile.caseId}</span>
      </div>

      <div className="relative mt-6">
        {/* base + fill line */}
        <div className="absolute left-4 right-4 top-4 h-0.5 -translate-y-1/2 bg-navy/12" aria-hidden />
        <motion.div
          className="absolute left-4 top-4 h-0.5 -translate-y-1/2 origin-left bg-coral"
          style={{ right: `${(1 - fill) * 100}%` }}
          initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.3, ease, delay: 0.2 }}
          aria-hidden
        />
        <ol className="relative grid grid-cols-6 gap-1">
          {progressSteps.map((s, i) => (
            <motion.li
              key={s.label}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, ease, delay: 0.15 + i * 0.12 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border-2",
                  s.state === "done" && "border-coral bg-coral text-white",
                  s.state === "active" && "border-coral bg-white text-coral",
                  s.state === "pending" && "border-navy/15 bg-white text-navy/30",
                )}
              >
                {s.state === "done" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : s.state === "active" ? (
                  <Loader2 className={cn("h-4 w-4", !reduce && "animate-spin")} aria-hidden />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                )}
              </span>
              <span className={cn("text-[10px] leading-tight", s.state === "pending" ? "text-navy/40" : "text-navy/70")}>{s.label}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}
