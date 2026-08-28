"use client";

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { isTaskOverdue, taskPriorityLabel, taskPriorityTone, taskStatusLabel, taskStatusTone } from "@/lib/task-status";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { listMyTasks } from "@/services/tasks.service";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function DashboardTasksWidget() {
  const { hasPermission } = useAuth();
  const canSee = hasPermission(PERMISSIONS.TASKS_READ);
  const { data } = useAsync(() => (canSee ? listMyTasks({ openOnly: true, pageSize: 100, sort: "dueAt", order: "asc" }) : Promise.resolve(null)), [canSee]);

  if (!canSee) return null;

  const items = data?.items ?? [];
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const overdue = items.filter((t) => isTaskOverdue(t.dueAt, t.status)).length;
  const dueToday = items.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === todayKey).length;
  const urgent = items.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;

  return (
    <Panel
      title="My tasks"
      description="Tasks assigned to you that still need action."
      actions={<Link href="/tasks" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Metric label="Overdue" value={overdue} tone="text-rose-700" />
        <Metric label="Due today" value={dueToday} tone="text-amber-700" />
        <Metric label="High / urgent" value={urgent} tone="text-umber" />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">You have no open tasks.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/cases/${t.caseId}`} className="font-medium text-slate-800 hover:text-brand-700">{t.title}</Link>
                <p className="text-xs text-slate-500">{t.dueAt ? `Due ${formatDate(t.dueAt)}` : "No due date"}{isTaskOverdue(t.dueAt, t.status) ? " · Overdue" : ""}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge label={taskPriorityLabel(t.priority)} tone={taskPriorityTone(t.priority)} />
                <StatusBadge label={taskStatusLabel(t.status)} tone={taskStatusTone(t.status)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-sage bg-cream/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
