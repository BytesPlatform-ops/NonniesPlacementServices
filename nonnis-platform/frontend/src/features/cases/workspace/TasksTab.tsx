"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { taskStatusLabel } from "@/lib/task-status";
import { createTask, getTaskAssignees, listCaseTasks, updateTask, type TaskFilters } from "@/services/tasks.service";
import type { CaseDetail } from "@/types/domain";
import type { EligibleAssignee, TaskView } from "@/types/tasks";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/tasks";
import { Panel } from "@/components/ui/Panel";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { TaskTable } from "@/features/tasks/TaskTable";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function TasksTab({ caseDetail, onChange }: { caseDetail: CaseDetail; onChange: () => void }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.TASKS_MANAGE);
  const [status, setStatus] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reassign, setReassign] = useState<TaskView | null>(null);

  const filters: TaskFilters = useMemo(
    () => ({ pageSize: 100, status: status || undefined, openOnly, overdueOnly }),
    [status, openOnly, overdueOnly],
  );
  const { data, loading, error, reload } = useAsync(() => listCaseTasks(caseDetail.id, filters), [caseDetail.id, filters]);
  const refresh = () => {
    reload();
    onChange();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Tasks"
        actions={canManage ? <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">New task</button> : undefined}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            <option value="">Any status</option>
            {TASK_STATUSES.map((s) => (<option key={s} value={s}>{taskStatusLabel(s)}</option>))}
          </select>
          {[
            { label: "Open", value: openOnly, set: setOpenOnly },
            { label: "Overdue", value: overdueOnly, set: setOverdueOnly },
          ].map((chip) => (
            <button key={chip.label} type="button" onClick={() => chip.set((v) => !v)} aria-pressed={chip.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", chip.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-600 hover:border-brand-400")}>
              {chip.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading tasks…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No tasks" message="No tasks match the current filters." />
        ) : (
          <TaskTable tasks={data.items} canManage={canManage} onChanged={refresh} onReassign={canManage ? setReassign : undefined} />
        )}
      </Panel>

      {creating ? <TaskFormModal caseId={caseDetail.id} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} /> : null}
      {reassign ? <ReassignModal caseId={caseDetail.id} task={reassign} onClose={() => setReassign(null)} onDone={() => { setReassign(null); refresh(); }} /> : null}
    </div>
  );
}

function TaskFormModal({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  const assignees = useAsync(() => getTaskAssignees(caseId), [caseId]);
  const [form, setForm] = useState({ title: "", assigneeUserId: "", priority: "NORMAL", dueAt: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createTask(caseId, {
        title: form.title,
        assigneeUserId: form.assigneeUserId || undefined,
        priority: form.priority,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        description: form.description || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the task.");
      setBusy(false);
    }
  };

  return (
    <Modal title="New task" onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="space-y-3">
        <F label="Title" required><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></F>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Assignee"><AssigneeSelect assignees={assignees.data ?? []} value={form.assigneeUserId} onChange={(v) => set("assigneeUserId", v)} /></F>
          <F label="Priority">
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={`${inputCls} bg-white`}>
              {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>))}
            </select>
          </F>
        </div>
        <F label="Due date"><input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} className={inputCls} /></F>
        <F label="Description"><textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></F>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || !form.title.trim()} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Creating…" : "Create task"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ReassignModal({ caseId, task, onClose, onDone }: { caseId: string; task: TaskView; onClose: () => void; onDone: () => void }) {
  const assignees = useAsync(() => getTaskAssignees(caseId), [caseId]);
  const [value, setValue] = useState(task.assignee?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateTask(task.id, { assigneeUserId: value || null });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reassign.");
      setBusy(false);
    }
  };
  return (
    <Modal title={`Reassign — ${task.title}`} onClose={onClose}>
      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <F label="Assignee"><AssigneeSelect assignees={assignees.data ?? []} value={value} onChange={setValue} /></F>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

function AssigneeSelect({ assignees, value, onChange }: { assignees: EligibleAssignee[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} bg-white`}>
      <option value="">Unassigned</option>
      {assignees.map((a) => (<option key={a.userId} value={a.userId}>{a.name} · {a.roleName}</option>))}
    </select>
  );
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}{required ? <span className="ml-0.5 text-rose-600">*</span> : null}</span>
      {children}
    </label>
  );
}
