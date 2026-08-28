"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CASE_STATUS_ORDER, caseStatusMeta } from "@/lib/case-status";
import { attentionLabel, attentionTone } from "@/lib/attention";
import { formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { listCases } from "@/services/cases.service";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { CaseStatus, CaseSummary } from "@/types/domain";

const PAGE_SIZE = 20;

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
  { key: "assigned", header: "Assigned", render: (row) => row.assignedProfessional?.displayName ?? <span className="text-slate-400">Unassigned</span> },
  { key: "expected", header: "Discharge", render: (row) => formatDate(row.expectedDischargeDate) },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const m = caseStatusMeta(row.status);
      return <StatusBadge label={m.label} tone={m.tone} />;
    },
  },
  { key: "complete", header: "Complete", align: "right", render: (row) => `${row.completenessPercentage}%` },
  { key: "blockers", header: "Blockers", align: "right", render: (row) => row.openBlockers },
  {
    key: "attention",
    header: "Attention",
    render: (row) =>
      row.attention.level === "NONE" ? (
        <span className="text-xs text-slate-400">On track</span>
      ) : (
        <StatusBadge label={attentionLabel(row.attention.level, row.attention.count)} tone={attentionTone(row.attention.level)} />
      ),
  },
  { key: "activity", header: "Updated", render: (row) => formatDate(row.lastActivityAt) },
];

export function CaseListView() {
  const { activeOrganizationId, hasPermission } = useAuth();
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [search, setSearch] = useState("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync(
    () => listCases({ page, pageSize: PAGE_SIZE, status: status || undefined, search: search || undefined, assignedToMe, attentionOnly, overdue }),
    [page, status, search, assignedToMe, attentionOnly, overdue, activeOrganizationId],
  );

  const toggle = (setter: (v: boolean) => void, value: boolean) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Discharge Cases"
        description="Every discharge case in your organization. Filter to surface the ones that need action."
        actions={
          hasPermission(PERMISSIONS.CASES_CREATE) ? (
            <Link href="/cases/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" aria-hidden /> New case
            </Link>
          ) : undefined
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search case #, external ID, or patient name"
              className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CaseStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="">All statuses</option>
            {CASE_STATUS_ORDER.map((v) => (
              <option key={v} value={v}>{caseStatusMeta(v).label}</option>
            ))}
          </select>
          <FilterChip label="My cases" active={assignedToMe} onClick={() => toggle(setAssignedToMe, !assignedToMe)} />
          <FilterChip label="Needs attention" active={attentionOnly} onClick={() => toggle(setAttentionOnly, !attentionOnly)} />
          <FilterChip label="Overdue" active={overdue} onClick={() => toggle(setOverdue, !overdue)} />
        </div>

        <div className="mt-4">
          {loading ? (
            <LoadingState label="Loading cases…" />
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="No cases found" message="Adjust your filters, or create a new case." />
          ) : (
            <>
              <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} />
              <div className="mt-4 flex items-center justify-between border-t border-sage pt-3 text-sm text-slate-500">
                <span>
                  {data.total} case{data.total === 1 ? "" : "s"} · page {data.page} of {Math.max(data.totalPages, 1)}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40">
                    Previous
                  </button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.totalPages} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full border border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800"
          : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label}
    </button>
  );
}
