import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { severityTone } from "@/lib/attention";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CaseAssessment } from "@/types/domain";

export function CompletenessMeter({ completeness }: { completeness: CaseAssessment["completeness"] }) {
  const pct = completeness.percentage;
  const tone = pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-brand-600" : "bg-amber-500";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-umber">{pct}% complete</span>
        <span className="text-slate-500">{completeness.blockers.length} blocking</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} />
      </div>
      {completeness.checks.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {completeness.checks.map((c) => (
            <li key={c.code} className="flex items-center gap-2 text-sm">
              {c.passed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 text-amber-500" aria-hidden />
              )}
              <span className={c.passed ? "text-slate-500" : "text-umber"}>{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AttentionReasons({ attention }: { attention: CaseAssessment["attention"] }) {
  if (attention.reasons.length === 0) {
    return <p className="text-sm text-slate-500">No outstanding issues. This case is on track.</p>;
  }
  return (
    <ul className="space-y-2">
      {attention.reasons.map((r) => (
        <li key={r.code} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-umber">{r.label}</span>
            <StatusBadge label={r.severity} tone={severityTone(r.severity)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
