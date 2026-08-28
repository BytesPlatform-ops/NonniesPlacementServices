"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { taskStatusLabel } from "@/lib/task-status";
import { listMyTasks, type TaskFilters } from "@/services/tasks.service";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/tasks";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { TaskTable } from "./TaskTable";

export function MyTasksView() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.TASKS_MANAGE);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filters: TaskFilters = useMemo(
    () => ({ page, pageSize: 20, status: status || undefined, priority: priority || undefined, openOnly, overdueOnly, sort: "dueAt", order: "asc" }),
    [page, status, priority, openOnly, overdueOnly],
  );
  const { data, loading, error, reload } = useAsync(() => listMyTasks(filters), [filters]);
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <PageHeading title="My tasks" description="Tasks assigned to you across your cases." />

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            <option value="">Any status</option>
            {TASK_STATUSES.map((s) => (<option key={s} value={s}>{taskStatusLabel(s)}</option>))}
          </select>
          <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            <option value="">Any priority</option>
            {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>))}
          </select>
          {[
            { label: "Open", value: openOnly, set: setOpenOnly },
            { label: "Overdue", value: overdueOnly, set: setOverdueOnly },
          ].map((chip) => (
            <button key={chip.label} type="button" onClick={() => { chip.set((v) => !v); setPage(1); }} aria-pressed={chip.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", chip.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}>
              {chip.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <LoadingState label="Loading tasks…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No tasks" message="You have no tasks matching these filters." />
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
