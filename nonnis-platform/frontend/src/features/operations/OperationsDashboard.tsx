"use client";

import Link from "next/link";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { getOperationsSummary } from "@/services/operations.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MetricCard } from "./parts";
import { CaseQueue } from "./CaseQueue";

export function OperationsDashboard() {
  const { data, loading, error, reload } = useAsync(() => getOperationsSummary(), []);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Operations control center"
        description="Where coordination needs attention across the network — and who needs to act."
        actions={
          <div className="flex gap-2">
            <Link href="/operations/tasks" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Tasks
            </Link>
            <Link href="/operations/referrals" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Referrals
            </Link>
            <Link href="/operations/providers" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Provider overview
            </Link>
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading operations summary…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Active cases" value={data.cases.active} />
            <MetricCard label="Needs attention" value={data.cases.requiringAttention} tone="warning" />
            <MetricCard label="Overdue" value={data.cases.overdue} tone="negative" />
            <MetricCard label="Due today" value={data.cases.dueToday} />
            <MetricCard label="Unassigned" value={data.cases.unassigned} tone="warning" />
            <MetricCard label="Blocked" value={data.cases.blocked} tone="negative" />
            <MetricCard label="Incomplete" value={data.cases.incomplete} tone="warning" />
            <MetricCard label="Due this week" value={data.cases.dueThisWeek} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Active providers" value={data.providers.active} href="/operations/providers" />
            <MetricCard label="No capacity reported" value={data.providers.noCapacityReported} tone="warning" href="/operations/providers" />
            <MetricCard label="Unavailable providers" value={data.providers.unavailable} tone="negative" href="/operations/providers" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CaseQueue
                title="Requires attention"
                description="Blocked, overdue, unassigned or incomplete cases across all organizations."
                showFilters={false}
                fixedFilters={{ attentionOnly: true, sort: "expectedDischargeDate", order: "asc" }}
                pageSize={8}
              />
            </div>
            <Panel title="Recent activity">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">No recent activity.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/cases/${a.caseId}`} className="font-medium text-brand-800 hover:underline">
                          {a.caseNumber}
                        </Link>
                        <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {humanizeEnum(a.type)} · {a.organizationName}
                        {a.actor ? ` · ${a.actor}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div>
            <Link href="/operations/cases" className="text-sm font-medium text-brand-700 hover:underline">
              Open the full case queue →
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
