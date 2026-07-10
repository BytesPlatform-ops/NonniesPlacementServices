"use client";

import { useRef } from "react";
import { Check, Stethoscope } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

const ITEMS = [
  "Memory care needs reviewed",
  "Wandering / tracking behaviors noted",
  "Mental health history reviewed",
  "Medication protocols checked",
  "Funding verified — Medicaid + private",
  "Specialty provider fit confirmed",
];

/** RN Review Checklist — items tick on with animated checkmarks. */
export function RNReviewChecklist({ tone = "dark", className }: { tone?: "light" | "dark"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const rows = el.querySelectorAll<HTMLElement>("[data-item]");
      const checks = el.querySelectorAll<HTMLElement>("[data-check]");
      if (reduced) return;
      gsap.set(checks, { scale: 0 });
      gsap.set(rows, { opacity: 0, x: -14 });
      return onInView(el, () => {
        gsap.to(rows, { opacity: 1, x: 0, stagger: 0.12, duration: 0.4, ease: "power3.out" });
        gsap.to(checks, { scale: 1, stagger: 0.12, delay: 0.15, duration: 0.35, ease: "back.out(2.5)" });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("rounded-3xl border p-6 shadow-card", dark ? "border-white/10 bg-midnight-800/90 backdrop-blur-xl" : "border-navy/10 bg-ivory", className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", dark ? "bg-mint/15 text-mint" : "bg-teal/10 text-teal")}>
          <Stethoscope className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className={cn("font-display text-lg font-medium", dark ? "text-white" : "text-navy")}>RN review</p>
          <p className={cn("text-xs", dark ? "text-white/50" : "text-slate-ink")}>Case #WA-2048</p>
        </div>
        <span className="ml-auto rounded-full bg-teal/15 px-2.5 py-1 text-xs font-semibold text-teal">Cleared</span>
      </div>
      <ul className="mt-5 space-y-2.5">
        {ITEMS.map((item) => (
          <li key={item} data-item className={cn("flex items-center gap-3 rounded-xl border p-3", dark ? "border-white/10 bg-white/[0.03]" : "border-navy/10 bg-white")}>
            <span data-check className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", dark ? "bg-mint text-midnight" : "bg-teal text-white")}>
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className={cn("text-sm", dark ? "text-white/80" : "text-slate-ink")}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
