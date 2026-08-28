"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, humanizeEnum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isReferralOverdue, referralStatusLabel, referralStatusTone } from "@/lib/referral-status";
import { useAsync } from "@/hooks/use-async";
import { listProviderReferrals, type ProviderReferralFilters } from "@/services/provider-referrals.service";
import type { ProviderReferralSummary } from "@/types/referrals";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function ReferralInbox() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [actionRequired, setActionRequired] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, actionRequired, overdueOnly]);

  const filters: ProviderReferralFilters = useMemo(
    () => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined, actionRequired, overdueOnly }),
    [page, debounced, status, actionRequired, overdueOnly],
  );
  const { data, loading, error, reload } = useAsync(() => listProviderReferrals(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<ProviderReferralSummary>[] = [
    {
      key: "ref",
      header: "Referral",
      render: (row) => (
        <Link href={`/provider/referrals/${row.id}`} className="font-mono text-xs font-medium text-brand-800 hover:underline">
          {row.reference}
        </Link>
      ),
    },
    { key: "service", header: "Service", render: (row) => humanizeEnum(row.serviceCategory) },
    { key: "facility", header: "From", render: (row) => row.facilityName },
    { key: "start", header: "Requested start", render: (row) => formatDate(row.requestedStartDate) },
    {
      key: "due",
      header: "Response due",
      render: (row) =>
        row.responseDueAt ? (
          <span className={cn(isReferralOverdue(row.responseDueAt, row.status) && "font-medium text-rose-700")}>
            {formatDate(row.responseDueAt)}
            {isReferralOverdue(row.responseDueAt, row.status) ? " · Overdue" : ""}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={referralStatusLabel(row.status)} tone={referralStatusTone(row.status)} /> },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <Link href={`/provider/referrals/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          {row.actionRequired ? "Respond" : "View"}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Referrals" description="Referrals sent to your organization. Open one to review and respond." />

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED", "ACCEPTED", "DECLINED", "WITHDRAWN"].map((s) => (
                <option key={s} value={s}>{referralStatusLabel(s as ProviderReferralSummary["status"])}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            {[
              { label: "Action required", value: actionRequired, set: setActionRequired },
              { label: "Overdue", value: overdueOnly, set: setOverdueOnly },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => chip.set((v) => !v)}
                aria-pressed={chip.value}
                className={cn(
                  "self-end rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  chip.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400",
                )}
              >
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
