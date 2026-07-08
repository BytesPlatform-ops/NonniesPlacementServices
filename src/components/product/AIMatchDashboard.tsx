"use client";

import { useRef } from "react";
import {
  Activity,
  MapPin,
  CircleDollarSign,
  Clock,
  ShieldCheck,
  Stethoscope,
  Star,
  ChevronRight,
} from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onInView } from "@/lib/inView";
import { cn } from "@/lib/utils";

const MATCHES = [
  { name: "Cedar Grove Adult Family Home", meta: "Memory care · Private · 6 mi", score: 92, tag: "Best fit" },
  { name: "Harborlight Assisted Living", meta: "Assisted living · Medicaid · 9 mi", score: 87 },
  { name: "Rainier Skilled Nursing", meta: "Skilled nursing · Medicare · 12 mi", score: 81 },
];

/**
 * AI Match Dashboard — a convincing demo product panel (dark). Patient profile,
 * care signals, live match confidence, RN review status, and ranked provider
 * matches. Confidence meters + score bars fill on scroll.
 */
export function AIMatchDashboard({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const bars = el.querySelectorAll<HTMLElement>("[data-bar]");
      if (reduced) {
        bars.forEach((b) => (b.style.width = b.dataset.bar + "%"));
        return;
      }
      const rows = el.querySelectorAll<HTMLElement>("[data-row]");
      gsap.set(rows, { opacity: 0, y: 16 });
      gsap.set(bars, { width: 0 });
      return onInView(el, () => {
        gsap.to(rows, { opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: "power3.out" });
        bars.forEach((b) => gsap.to(b, { width: b.dataset.bar + "%", duration: 1.2, ease: "power2.out" }));
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className={cn(
        "w-full overflow-hidden rounded-3xl border border-white/10 bg-midnight-800/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          <span className="ml-3 text-xs font-medium text-white/50">Nonni&apos;s · Match Console</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-[0.7rem] font-semibold text-mint">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Live
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[0.95fr_1.05fr]">
        {/* Patient profile */}
        <div data-row className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/40">Patient profile</p>
          <p className="mt-1 font-display text-lg text-white">Case #WA-2048</p>
          <dl className="mt-4 space-y-2.5 text-sm">
            {[
              { icon: Activity, k: "Care level", v: "Heavy care · memory" },
              { icon: CircleDollarSign, k: "Funding", v: "Medicaid + private" },
              { icon: MapPin, k: "Location", v: "Tacoma, WA · 15 mi radius" },
              { icon: Clock, k: "Urgency", v: "Hospital discharge · 3 days" },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/55">
                  <Icon className="h-4 w-4 text-mint" aria-hidden /> {k}
                </span>
                <span className="text-right font-medium text-white/90">{v}</span>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-mint/25 bg-mint/10 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-mint" aria-hidden />
            <span className="text-xs font-medium text-mint">RN review complete — cleared to connect</span>
          </div>
        </div>

        {/* Confidence + matches */}
        <div className="flex flex-col gap-4">
          <div data-row className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-white/60">
                <Stethoscope className="h-4 w-4 text-mint" aria-hidden /> Match confidence
              </span>
              <span className="font-display text-2xl font-semibold text-mint">92%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div data-bar="92" className="h-full rounded-full bg-gradient-to-r from-teal to-mint" />
            </div>
          </div>

          <div className="space-y-2.5">
            {MATCHES.map((m) => (
              <div
                key={m.name}
                data-row
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-mint/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/15 font-display text-sm font-semibold text-mint">
                  {m.score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                  <p className="truncate text-xs text-white/50">{m.meta}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div data-bar={String(m.score)} className="h-full rounded-full bg-gradient-to-r from-blue to-mint" />
                  </div>
                </div>
                {m.tag ? (
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2 py-1 text-[0.65rem] font-semibold text-mint sm:inline-flex">
                    <Star className="h-3 w-3 fill-mint" aria-hidden /> {m.tag}
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
