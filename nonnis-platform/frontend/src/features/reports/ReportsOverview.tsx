"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { formatDate } from "@/lib/format";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/states";
import { getReportFilterOptions, getReportOverview, type ReportQuery } from "@/services/reports.service";
import type { OverviewSummary } from "@/types/reports";
import { last30Days } from "./report-shared";
import { useReportQueryState } from "./useReportQueryState";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

interface CardConfig {
  href: string;
  title: string;
  description: string;
  metrics: (o: OverviewSummary) => Array<{ label: string; value: number }>;
}

const CARDS: CardConfig[] = [
  {
    href: "/reports/cases",
    title: "Case Report",
    description: "Counts and current status of discharge cases, grouped by status, organization and facility.",
    metrics: (o) => [
      { label: "Total", value: o.cases.total },
      { label: "Active", value: o.cases.active },
      { label: "Completed", value: o.cases.completed },
    ],
  },
  {
    href: "/reports/referrals",
    title: "Referral Report",
    description: "Referrals sent and their current responses, with overdue tracking.",
    metrics: (o) => [
      { label: "Total", value: o.referrals.total },
      { label: "Sent", value: o.referrals.sent },
      { label: "Accepted", value: o.referrals.accepted },
    ],
  },
  {
    href: "/reports/providers",
    title: "Provider Directory Summary",
    description: "Provider operational status and current reported capacity.",
    metrics: (o) => [
      { label: "Total", value: o.providers.total },
      { label: "Active", value: o.providers.active },
      { label: "Paused", value: o.providers.paused },
    ],
  },
  {
    href: "/reports/readiness",
    title: "Readiness Snapshot",
    description: "Current discharge-readiness state of cases, computed live from source records.",
    metrics: (o) => [
      { label: "Ready", value: o.readiness.ready },
      { label: "Needs attention", value: o.readiness.needsAttention },
      { label: "Blocked", value: o.readiness.blocked },
    ],
  },
  {
    href: "/reports/tasks",
    title: "Task Report",
    description: "Case task counts by status and priority, with current overdue tracking.",
    metrics: (o) => [
      { label: "Open", value: o.tasks.open },
      { label: "Overdue", value: o.tasks.overdue },
      { label: "Completed", value: o.tasks.completed },
    ],
  },
  {
    href: "/reports/form-submissions",
    title: "Website Form Submissions",
    description: "Public website submissions received and their internal review status.",
    metrics: (o) => [
      { label: "Received", value: o.submissions.received },
      { label: "New", value: o.submissions.new },
      { label: "Resolved", value: o.submissions.resolved },
    ],
  },
];

export function ReportsOverview() {
  const { values, setValue, reset } = useReportQueryState(last30Days());
  const { data: options } = useAsync(() => getReportFilterOptions(), []);

  const query: ReportQuery = useMemo(
    () => ({
      dateFrom: values.dateFrom,
      dateTo: values.dateTo,
      organizationId: values.organizationId,
      facilityId: values.facilityId,
    }),
    [values.dateFrom, values.dateTo, values.organizationId, values.facilityId],
  );
  const { data, loading } = useAsync(() => getReportOverview(query), [query]);

  const facilities = (options?.facilities ?? []).filter(
    (f) => !values.organizationId || f.organizationId === values.organizationId,
  );

  return (
    <div id="report-print" className="space-y-4">
      <PageHeading
        title="Reports"
        description="Administrative reports over current platform data. Counts reflect the selected period and scope."
      />

      <div className="print-only text-sm text-slate-700">
        <p>
          <strong>Generated:</strong> {data ? new Date(data.generatedAt).toLocaleString() : "—"}
        </p>
        <p>
          <strong>Period:</strong> {values.dateFrom ? formatDate(values.dateFrom) : "Any"} –{" "}
          {values.dateTo ? formatDate(values.dateTo) : "Any"}
        </p>
      </div>

      <Panel className="print-hide">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">From</span>
            <input type="date" value={values.dateFrom ?? ""} onChange={(e) => setValue("dateFrom", e.target.value)} className={`${inputCls} bg-white`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">To</span>
            <input type="date" value={values.dateTo ?? ""} onChange={(e) => setValue("dateTo", e.target.value)} className={`${inputCls} bg-white`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Organization</span>
            <select value={values.organizationId ?? ""} onChange={(e) => setValue("organizationId", e.target.value || undefined)} className={`${inputCls} bg-white`}>
              <option value="">Any organization</option>
              {(options?.organizations ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Facility</span>
            <select value={values.facilityId ?? ""} onChange={(e) => setValue("facilityId", e.target.value || undefined)} className={`${inputCls} bg-white`}>
              <option value="">Any facility</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={reset} className="mb-0.5 text-xs font-medium text-slate-500 underline hover:text-umber">
            Reset filters
          </button>
        </div>
      </Panel>

      {loading && !data ? (
        <Panel>
          <LoadingState label="Loading overview…" />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="report-card group flex flex-col rounded-lg border border-sage bg-ivory p-5 shadow-card transition-colors hover:border-brand-400"
            >
              <h2 className="font-display text-base font-semibold text-umber">{card.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-500">{card.description}</p>
              <div className="mt-4 flex gap-4">
                {(data ? card.metrics(data) : []).map((m) => (
                  <div key={m.label}>
                    <p className="text-lg font-semibold tabular-nums text-umber">{m.value}</p>
                    <p className="text-xs text-slate-500">{m.label}</p>
                  </div>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 group-hover:gap-2">
                View report <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
