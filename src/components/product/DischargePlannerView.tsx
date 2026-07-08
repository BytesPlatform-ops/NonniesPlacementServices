"use client";

import { Zap, Building2, Activity, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  { name: "Cedar Grove AFH", meta: "Heavy · Medicaid · 6 mi", score: 92 },
  { name: "Rainier Skilled Nursing", meta: "Skilled · Medicare · 12 mi", score: 85 },
];

/** Hospital / Discharge Planner view — quick placement request + acuity + suggested communities. */
export function DischargePlannerView({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border shadow-card",
        dark ? "border-white/10 bg-midnight-800/90 backdrop-blur-xl" : "border-navy/10 bg-white",
        className,
      )}
    >
      <div className={cn("flex items-center justify-between border-b px-5 py-3.5", dark ? "border-white/10" : "border-navy/10")}>
        <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-navy")}>Discharge desk · Quick placement</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 text-[0.7rem] font-semibold text-coral">
          <Zap className="h-3.5 w-3.5" aria-hidden /> Urgent
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {[
          { icon: Building2, k: "Facilities served", v: "8" },
          { icon: Activity, k: "Patient acuity", v: "Heavy" },
          { icon: Clock, k: "Placement window", v: "72 hrs" },
        ].map(({ icon: Icon, k, v }) => (
          <div key={k} className={cn("rounded-2xl border p-4 text-center", dark ? "border-white/10 bg-white/[0.03]" : "border-navy/10 bg-ice/40")}>
            <Icon className={cn("mx-auto h-5 w-5", dark ? "text-mint" : "text-blue")} aria-hidden />
            <p className={cn("mt-2 font-display text-2xl font-semibold", dark ? "text-white" : "text-navy")}>{v}</p>
            <p className={cn("text-[0.68rem]", dark ? "text-white/50" : "text-slate-ink")}>{k}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        <p className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.14em]", dark ? "text-white/45" : "text-slate-ink/70")}>
          Suggested communities
        </p>
        <div className="space-y-2">
          {SUGGESTED.map((s) => (
            <div key={s.name} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", dark ? "border-white/10 bg-white/[0.03]" : "border-navy/10 bg-white")}>
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg font-display text-xs font-bold", dark ? "bg-mint/15 text-mint" : "bg-teal/10 text-teal")}>{s.score}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", dark ? "text-white" : "text-navy")}>{s.name}</p>
                <p className={cn("truncate text-xs", dark ? "text-white/50" : "text-slate-ink")}>{s.meta}</p>
              </div>
              <ArrowRight className={cn("h-4 w-4", dark ? "text-mint" : "text-blue")} aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
