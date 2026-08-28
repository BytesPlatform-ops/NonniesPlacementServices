"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { attentionLabel, attentionTone } from "@/lib/attention";
import { caseStatusMeta, CASE_STATUS_ORDER } from "@/lib/case-status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { assignCase, updateCase } from "@/services/cases.service";
import { getCaseAssignees, listOperationsCases, type OperationsCaseFilters } from "@/services/operations.service";
import type { AssigneeView, OperationsCaseSummary } from "@/types/operations";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Modal } from "./parts";

type ToggleKey = "overdue" | "attentionOnly" | "unassignedOnly" | "blockedOnly" | "incompleteOnly";
const TOGGLES: Array<{ key: ToggleKey; label: string }> = [
  { key: "attentionOnly", label: "Needs attention" },
  { key: "overdue", label: "Overdue" },
  { key: "unassignedOnly", label: "Unassigned" },
  { key: "blockedOnly", label: "Blocked" },
  { key: "incompleteOnly", label: "Incomplete" },
];

export function CaseQueue({
  title = "Cases",
  description,
  showFilters = true,
  fixedFilters = {},
  pageSize = 20,
}: {
  title?: string;
  description?: string;
  showFilters?: boolean;
  fixedFilters?: OperationsCaseFilters;
  pageSize?: number;
}) {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(PERMISSIONS.CASES_ASSIGN);
  const canUpdate = hasPermission(PERMISSIONS.CASES_UPDATE);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    overdue: false,
    attentionOnly: false,
    unassignedOnly: false,
    blockedOnly: false,
    incompleteOnly: false,
  });
  const [sort, setSort] = useState("updatedAt");
  const [page, setPage] = useState(1);
  const [reassignCase, setReassignCase] = useState<OperationsCaseSummary | null>(null);
  const [blockCase, setBlockCase] = useState<OperationsCaseSummary | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, toggles, sort]);

  const filters: OperationsCaseFilters = useMemo(
    () => ({ page, pageSize, sort, search: debounced || undefined, status: status || undefined, ...toggles, ...fixedFilters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, sort, debounced, status, toggles, JSON.stringify(fixedFilters)],
  );

  const { data, loading, error, reload } = useAsync(() => listOperationsCases(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  const columns: Column<OperationsCaseSummary>[] = [
    {
      key: "case",
      header: "Case",
      render: (row) => (
        <div>
          <Link href={`/cases/${row.id}`} className="font-medium text-brand-800 hover:underline">
            {row.caseNumber}
          </Link>
          <p className="text-xs text-slate-500">{row.patient.displayName}</p>
        </div>
      ),
    },
    { key: "org", header: "Organization", render: (row) => <span className="text-slate-700">{row.organization.name}</span> },
    { key: "assigned", header: "Assigned", render: (row) => row.assignedProfessional?.displayName ?? <span className="text-amber-700">Unassigned</span> },
    { key: "discharge", header: "Discharge", render: (row) => formatDate(row.expectedDischargeDate) },
    { key: "status", header: "Status", render: (row) => <StatusBadge label={caseStatusMeta(row.status).label} tone={caseStatusMeta(row.status).tone} /> },
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
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <Link href={`/cases/${row.id}`} className="text-sm font-medium text-brand-700 hover:underline">
            Open
          </Link>
          {canAssign ? (
            <button type="button" onClick={() => setReassignCase(row)} className="text-sm text-slate-500 hover:text-umber">
              Assign
            </button>
          ) : null}
          {canUpdate ? (
            <button type="button" onClick={() => setBlockCase(row)} className={cn("text-sm", row.blocked ? "text-rose-600" : "text-slate-500 hover:text-umber")}>
              {row.blocked ? "Unblock" : "Block"}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {showFilters ? (
        <Panel>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Case #, patient, organization…" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Any status</option>
                {CASE_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{caseStatusMeta(s).label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="updatedAt">Recently updated</option>
                <option value="expectedDischargeDate">Expected discharge</option>
                <option value="createdAt">Created</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOGGLES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  toggles[t.key] ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400",
                )}
                aria-pressed={toggles[t.key]}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title={title} description={description}>
        {loading ? (
          <LoadingState label="Loading cases…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No cases" message="No cases match the current filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} getRowKey={(r) => r.id} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} case{data.total === 1 ? "" : "s"}</span>
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

      {reassignCase ? (
        <ReassignModal
          caseRow={reassignCase}
          onClose={() => setReassignCase(null)}
          onDone={() => {
            setReassignCase(null);
            reload();
          }}
        />
      ) : null}
      {blockCase ? (
        <BlockModal
          caseRow={blockCase}
          onClose={() => setBlockCase(null)}
          onDone={() => {
            setBlockCase(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function ReassignModal({ caseRow, onClose, onDone }: { caseRow: OperationsCaseSummary; onClose: () => void; onDone: () => void }) {
  const [assignees, setAssignees] = useState<AssigneeView[] | null>(null);
  const [selected, setSelected] = useState(caseRow.assignedProfessional?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCaseAssignees(caseRow.id)
      .then((a) => active && setAssignees(a))
      .catch(() => active && setAssignees([]));
    return () => {
      active = false;
    };
  }, [caseRow.id]);

  const submit = async (assignedUserId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await assignCase(caseRow.id, assignedUserId);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the assignment.");
      setBusy(false);
    }
  };

  return (
    <Modal title={`Assign ${caseRow.caseNumber}`} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <p className="mb-3 text-sm text-slate-500">
        Current: {caseRow.assignedProfessional?.displayName ?? "Unassigned"} · {caseRow.organization.name}
      </p>
      {assignees === null ? (
        <LoadingState label="Loading eligible staff…" />
      ) : (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Discharge professional</span>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>{a.name} · {a.roleName}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void submit(selected || null)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save assignment"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function BlockModal({ caseRow, onClose, onDone }: { caseRow: OperationsCaseSummary; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      if (caseRow.blocked) await updateCase(caseRow.id, { blocked: false, blockReason: null });
      else await updateCase(caseRow.id, { blocked: true, blockReason: reason || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the case.");
      setBusy(false);
    }
  };

  return (
    <Modal title={caseRow.blocked ? `Unblock ${caseRow.caseNumber}` : `Block ${caseRow.caseNumber}`} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {caseRow.blocked ? (
        <p className="text-sm text-slate-600">Remove the block on this case so coordination can continue?</p>
      ) : (
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Reason (optional)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Why is this case blocked?" />
        </label>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void apply()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Saving…" : caseRow.blocked ? "Unblock case" : "Block case"}
        </button>
      </div>
    </Modal>
  );
}
