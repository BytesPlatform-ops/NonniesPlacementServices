"use client";

import { useState } from "react";
import Link from "next/link";
import { CASE_STATUS_ORDER, caseStatusMeta } from "@/lib/case-status";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/hooks/use-async";
import { listCases } from "@/services/cases.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { CaseStatus, CaseSummary } from "@/types/domain";

const columns: Column<CaseSummary>[] = [
  {
    key: "case",
    header: "Case",
    render: (row) => (
      <Link href={`/cases/${row.id}`} className="font-medium text-brand-700 hover:underline">
        {row.caseNumber}
      </Link>
    ),
  },
  { key: "patient", header: "Patient", render: (row) => row.patient.displayName },
  { key: "facility", header: "Facility", render: (row) => row.originatingFacility.name },
  { key: "expected", header: "Expected Discharge", render: (row) => formatDate(row.expectedDischargeDate) },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const meta = caseStatusMeta(row.status);
      return <StatusBadge label={meta.label} tone={meta.tone} />;
    },
  },
  { key: "reqs", header: "Reqs", align: "right", render: (row) => row.requirementsCount },
  { key: "svcs", header: "Services", align: "right", render: (row) => row.serviceRequestsCount },
  { key: "updated", header: "Updated", render: (row) => formatDate(row.updatedAt) },
];

const PAGE_SIZE = 20;

export function CaseListView() {
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync(
    () => listCases({ page, pageSize: PAGE_SIZE, status: status || undefined }),
    [page, status],
  );

  const statusFilter = (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="text-slate-500">Status</span>
      <select
        value={status}
        onChange={(event) => {
          setStatus(event.target.value as CaseStatus | "");
          setPage(1);
        }}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      >
        <option value="">All statuses</option>
        {CASE_STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {caseStatusMeta(value).label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="Discharge Cases"
        description="Every discharge case moving through the Nonnis network, newest activity first."
        actions={statusFilter}
      />

      <Panel>
        {loading ? (
          <LoadingState label="Loading cases…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No cases found"
            message={
              status
                ? "No cases match the selected status yet."
                : "Cases created through the API will appear here."
            }
          />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
              <span>
                {data.total} case{data.total === 1 ? "" : "s"} · page {data.page} of {Math.max(data.totalPages, 1)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.page >= data.totalPages}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
