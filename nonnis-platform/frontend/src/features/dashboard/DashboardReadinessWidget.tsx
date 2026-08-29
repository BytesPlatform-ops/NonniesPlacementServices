"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import type { DischargeDashboard } from "@/types/dashboard";

/** Real, count-based discharge-readiness signals for the professional's cases. */
export function DashboardReadinessWidget({ readiness }: { readiness: DischargeDashboard["readiness"] }) {
  const cards: Array<{ label: string; value: number; tone: string; hint?: string }> = [
    { label: "Ready for discharge", value: readiness.readyForDischarge, tone: "text-emerald-700" },
    { label: "Critical blockers", value: readiness.criticalBlockers, tone: "text-rose-700" },
    { label: "Near-term, not ready", value: readiness.nearTermNotReady, tone: "text-amber-700" },
    { label: "Placement missing", value: readiness.placementMissing, tone: "text-amber-700" },
    { label: "Readiness regression", value: readiness.readinessRegression, tone: "text-rose-700", hint: "Marked ready, no longer satisfied" },
  ];

  return (
    <Panel
      title="Discharge readiness"
      description="Where cases stand against their mandatory discharge conditions."
      actions={<Link href="/cases" className="text-sm font-medium text-brand-700 hover:underline">View cases</Link>}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-md border border-sage bg-cream/40 p-3">
            <p className={`font-display text-2xl font-semibold ${c.value > 0 ? c.tone : "text-umber"}`}>{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{c.label}</p>
            {c.hint ? <p className="mt-0.5 text-[11px] text-slate-400">{c.hint}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
