"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { taskStatusLabel } from "@/lib/task-status";
import { listOperationsTasks, type TaskFilters } from "@/services/tasks.service";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/tasks";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { TaskTable } from "@/features/tasks/TaskTable";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function OperationsTasks() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.TASKS_MANAGE);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, priority, overdueOnly]);

  const filters: TaskFilters = useMemo(
    () => ({ page, pageSize: 20, search: debounced || undefined, status: status || undefined, priority: priority || undefined, overdueOnly, sort: "dueAt", order: "asc" }),
    [page, debounced, status, priority, overdueOnly],
  );
  const { data, loading, error, reload } = useAsync(() => listOperationsTasks(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <PageHeading title="Tasks" description="Case tasks across the network. Overdue is shown, never acted on automatically." />

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs font-medium text-slate-600">Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Task title…" className={inputCls} /></label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any status</option>
              {TASK_STATUSES.map((s) => (<option key={s} value={s}>{taskStatusLabel(s)}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Any priority</option>
              {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>))}
            </select>
          </label>
          <button type="button" onClick={() => setOverdueOnly((v) => !v)} aria-pressed={overdueOnly} className={cn("self-end rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", overdueOnly ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}>Overdue</button>
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <LoadingState label="Loading tasks…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No tasks" message="No tasks match the current filters." />
        ) : (
          <>
            <TaskTable tasks={data.items} canManage={canManage} onChanged={reload} showCase />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{data.total} task{data.total === 1 ? "" : "s"}</span>
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
