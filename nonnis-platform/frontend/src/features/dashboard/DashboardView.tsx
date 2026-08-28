"use client";

import Link from "next/link";
import { caseStatusMeta } from "@/lib/case-status";
import { attentionTone } from "@/lib/attention";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { getDischargeDashboard } from "@/services/dashboard.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { CaseSummary } from "@/types/domain";
import type { DischargeDashboard } from "@/types/dashboard";
import { DashboardTasksWidget } from "./DashboardTasksWidget";

export function DashboardView() {
  const { activeOrganizationId, me } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getDischargeDashboard(), [activeOrganizationId]);
  const name = me?.user?.firstName ?? me?.user?.displayName ?? "there";

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading title="Dashboard" />
        <Panel><LoadingState /></Panel>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeading title="Dashboard" />
        <Panel><ErrorState message={error?.message ?? "Unavailable"} onRetry={reload} /></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading title={`Welcome back, ${name}`} description="What must happen before your patients can be discharged safely." />

      <DashboardTasksWidget />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Assigned to me" value={data.metrics.assignedToMe} />
        <Metric label="Needs attention" value={data.metrics.needingAttention} tone="warning" />
        <Metric label="Overdue" value={data.metrics.overdue} tone="critical" />
        <Metric label="Due soon" value={data.metrics.dueSoon} />
        <Metric label="Missing info" value={data.metrics.missingInfo} tone="warning" />
        <Metric label="Blocked reqs" value={data.metrics.blockedRequirements} tone="critical" />
      </div>

      <Panel title="Expected discharges">
        <div className="flex flex-wrap gap-2">
          {data.dischargesByBucket.map((b) => (
            <div key={b.bucket} className="flex items-center gap-2 rounded-lg border border-sage bg-porcelain px-3 py-2">
              <span className="text-sm text-slate-ink">{b.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.bucket === "OVERDUE" && b.count > 0 ? "bg-rose-100 text-rose-700" : "bg-cream text-umber"}`}>{b.count}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Requiring attention" description="Resolve these first.">
          <CaseMiniList cases={data.requiringAttention} emptyLabel="Nothing needs attention." />
        </Panel>
        <Panel title="Assigned to me">
          <CaseMiniList cases={data.assignedToMe} emptyLabel="No cases assigned to you." />
        </Panel>
        <Panel title="Overdue">
          <CaseMiniList cases={data.overdue} emptyLabel="No overdue cases." />
        </Panel>
        <Panel title="Recent activity">
          <ActivityList activity={data.recentActivity} />
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warning" | "critical" }) {
  const accent = tone === "critical" && value > 0 ? "text-rose-600" : tone === "warning" && value > 0 ? "text-amber-600" : "text-umber";
  return (
    <div className="rounded-lg border border-sage bg-ivory px-4 py-3 shadow-card">
      <p className={`font-display text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function CaseMiniList({ cases, emptyLabel }: { cases: CaseSummary[]; emptyLabel: string }) {
  if (cases.length === 0) return <EmptyState title={emptyLabel} />;
  return (
    <ul className="divide-y divide-sage">
      {cases.map((c) => {
        const status = caseStatusMeta(c.status);
        return (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Link href={`/cases/${c.id}`} className="text-sm font-medium text-brand-700 hover:underline">{c.caseNumber}</Link>
              <p className="truncate text-xs text-slate-500">{c.patient.displayName} · {formatDate(c.expectedDischargeDate)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {c.attention.level !== "NONE" ? <StatusBadge label={String(c.attention.count)} tone={attentionTone(c.attention.level)} /> : null}
              <StatusBadge label={status.label} tone={status.tone} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityList({ activity }: { activity: DischargeDashboard["recentActivity"] }) {
  if (activity.length === 0) return <EmptyState title="No recent activity" />;
  return (
    <ul className="space-y-2.5">
      {activity.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <span className="text-umber">{humanizeEnum(a.type)}</span>{" "}
            <Link href={`/cases/${a.caseId}`} className="text-brand-700 hover:underline">{a.caseNumber}</Link>
            {a.actor ? <span className="text-slate-400"> · {a.actor}</span> : null}
          </div>
          <time className="shrink-0 text-xs text-slate-400">{formatDateTime(a.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}
