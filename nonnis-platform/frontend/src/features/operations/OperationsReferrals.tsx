"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, humanizeEnum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isReferralOverdue, referralStatusLabel, referralStatusTone } from "@/lib/referral-status";
import { useAsync } from "@/hooks/use-async";
import { listOperationsReferrals, type OperationsReferralFilters } from "@/services/referrals.service";
import type { StaffReferralSummary } from "@/types/referrals";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function OperationsReferrals() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [actionRequired, setActionRequired] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, overdueOnly, actionRequired]);

  const filters: OperationsReferralFilters = useMemo(
    () => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined, overdueOnly, actionRequired }),
    [page, debounced, status, overdueOnly, actionRequired],
  );
  const { data, loading, error, reload } = useAsync(() => listOperationsReferrals(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<StaffReferralSummary>[] = [
    { key: "ref", header: "Referral", render: (row) => <span className="font-mono text-xs text-slate-600">{row.reference}</span> },
    { key: "case", header: "Case", render: (row) => <Link href={`/cases/${row.caseId}`} className="font-medium text-brand-800 hover:underline">{row.caseNumber}</Link> },
    { key: "provider", header: "Provider", render: (row) => row.provider.name },
    { key: "service", header: "Service", render: (row) => humanizeEnum(row.serviceCategory) },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={referralStatusLabel(row.status)} tone={referralStatusTone(row.status)} /> },
    {
      key: "due",
      header: "Response due",
      render: (row) =>
        row.responseDueAt ? (
          <span className={cn(isReferralOverdue(row.responseDueAt, row.status) && "font-medium text-rose-700")}>
            {formatDate(row.responseDueAt)}{isReferralOverdue(row.responseDueAt, row.status) ? " · Overdue" : ""}
          </span>
        ) : "—",
    },
    { key: "sent", header: "Sent", render: (row) => formatDate(row.sentAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Referrals" description="Referral activity across the network. Overdue is shown, never acted on automatically." />

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference or case #…" className={inputCls} /></label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED", "ACCEPTED", "DECLINED", "WITHDRAWN"].map((s) => (
                <option key={s} value={s}>{referralStatusLabel(s as StaffReferralSummary["status"])}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            {[
              { label: "Overdue", value: overdueOnly, set: setOverdueOnly },
              { label: "Action required", value: actionRequired, set: setActionRequired },
            ].map((chip) => (
              <button key={chip.label} type="button" onClick={() => chip.set((v) => !v)} aria-pressed={chip.value} className={cn("self-end rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", chip.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <LoadingState label="Loading referrals…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No referrals" message="No referrals match the current filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} referral{data.total === 1 ? "" : "s"}</span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 disabled:opacity-50">Next</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
