"use client";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isTaskOverdue, taskPriorityLabel, taskPriorityTone, taskStatusLabel, taskStatusTone } from "@/lib/task-status";
import { cancelTask, completeTask, startTask } from "@/services/tasks.service";
import type { TaskView } from "@/types/tasks";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function TaskTable({
  tasks,
  canManage,
  onChanged,
  onReassign,
  showCase,
}: {
  tasks: TaskView[];
  canManage: boolean;
  onChanged: () => void;
  onReassign?: (task: TaskView) => void;
  showCase?: boolean;
}) {
  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    onChanged();
  };

  const columns: Column<TaskView>[] = [
    {
      key: "title",
      header: "Task",
      render: (t) => (
        <div>
          <span className="font-medium text-slate-800">{t.title}</span>
          {t.description ? <p className="text-xs text-slate-500">{t.description}</p> : null}
        </div>
      ),
    },
    { key: "assignee", header: "Assignee", render: (t) => t.assignee?.name ?? <span className="text-amber-700">Unassigned</span> },
    { key: "priority", header: "Priority", render: (t) => <StatusBadge label={taskPriorityLabel(t.priority)} tone={taskPriorityTone(t.priority)} /> },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge label={taskStatusLabel(t.status)} tone={taskStatusTone(t.status)} />
          {isTaskOverdue(t.dueAt, t.status) ? <span className="text-xs font-medium text-rose-700">Overdue</span> : null}
        </div>
      ),
    },
    {
      key: "due",
      header: "Due",
      render: (t) => (t.dueAt ? <span className={cn(isTaskOverdue(t.dueAt, t.status) && "font-medium text-rose-700")}>{formatDate(t.dueAt)}</span> : "—"),
    },
    ...(showCase ? [{ key: "case", header: "Case", render: (t: TaskView) => t.caseId.slice(0, 8) }] : []),
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (t: TaskView) => (
              <div className="flex items-center justify-end gap-2 whitespace-nowrap text-sm">
                {t.status === "OPEN" ? <button type="button" onClick={() => void act(() => startTask(t.id))} className="font-medium text-brand-700 hover:underline">Start</button> : null}
                {t.status === "OPEN" || t.status === "IN_PROGRESS" ? (
                  <>
                    <button type="button" onClick={() => void act(() => completeTask(t.id))} className="font-medium text-emerald-700 hover:underline">Complete</button>
                    {onReassign ? <button type="button" onClick={() => onReassign(t)} className="text-slate-500 hover:text-umber">Reassign</button> : null}
                    <button type="button" onClick={() => void act(() => cancelTask(t.id))} className="text-rose-600 hover:underline">Cancel</button>
                  </>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return <DataTable columns={columns} rows={tasks} getRowKey={(t) => t.id} />;
}
