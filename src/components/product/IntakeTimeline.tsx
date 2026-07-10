"use client";

import { useRef } from "react";
import { Check, Loader2, ClipboardList, Stethoscope, ScanSearch, Network, CalendarCheck, HomeIcon } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

const STAGES = [
  { icon: ClipboardList, label: "Family intake", state: "done" },
  { icon: Stethoscope, label: "RN assessment", state: "done" },
  { icon: ScanSearch, label: "Care needs parsed", state: "done" },
  { icon: Network, label: "Finding the fit", state: "active" },
  { icon: CalendarCheck, label: "Tour coordination", state: "pending" },
  { icon: HomeIcon, label: "Move-in support", state: "pending" },
] as const;

/** Intake Timeline — the placement pipeline with live stage states. */
export function IntakeTimeline({ tone = "dark", className }: { tone?: "light" | "dark"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const fill = el.querySelector<HTMLElement>("[data-fill]");
      if (reduced) {
        if (fill) fill.style.width = "58%";
        return;
      }
      const stages = el.querySelectorAll<HTMLElement>("[data-stage]");
      gsap.set(stages, { opacity: 0, y: 14 });
      if (fill) gsap.set(fill, { width: 0 });
      return onInView(el, () => {
        gsap.to(stages, { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: "power3.out" });
        if (fill) gsap.to(fill, { width: "58%", duration: 1.4, ease: "power2.out" });
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-3xl border p-6 shadow-card",
        dark ? "border-white/10 bg-midnight-800/90 backdrop-blur-xl" : "border-navy/10 bg-white",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-navy")}>Placement progress</p>
        <span className={cn("text-xs font-medium", dark ? "text-mint" : "text-teal")}>Case #WA-2048</span>
      </div>

      {/* Track */}
      <div className="relative mt-6">
        <div className={cn("absolute left-0 right-0 top-5 h-0.5", dark ? "bg-white/10" : "bg-navy/10")} />
        <div data-fill className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-teal to-mint" style={{ width: 0 }} />
        <ol className="relative flex justify-between">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const done = s.state === "done";
            const activeStage = s.state === "active";
            return (
              <li key={s.label} data-stage className="flex w-[16%] flex-col items-center gap-2 text-center">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full ring-4 transition-colors",
                    done && "bg-teal text-white ring-teal/20",
                    activeStage && (dark ? "bg-mint text-midnight ring-mint/25" : "bg-navy text-white ring-navy/15"),
                    s.state === "pending" && (dark ? "bg-white/8 text-white/40 ring-transparent" : "bg-ice text-slate-ink/50 ring-transparent"),
                  )}
                >
                  {done ? <Check className="h-4.5 w-4.5" aria-hidden /> : activeStage ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <Icon className="h-4.5 w-4.5" aria-hidden />}
                </span>
                <span className={cn("text-[0.66rem] font-medium leading-tight", dark ? "text-white/60" : "text-slate-ink")}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
