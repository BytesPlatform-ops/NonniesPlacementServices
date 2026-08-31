"use client";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isTaskOverdue, taskPriorityLabel, taskPriorityTone, taskStatusLabel, taskStatusTone } from "@/lib/task-status";
import { cancelTask, completeTask, startTask } from "@/services/tasks.service";
import type { TaskView } from "@/types/tasks";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MutationButton } from "@/components/ui/MutationButton";

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
              <div className="flex items-center justify-end gap-3 whitespace-nowrap text-sm">
                {t.status === "OPEN" ? (
                  <MutationButton variant="link" className="text-brand-700 hover:text-brand-800" pendingLabel="Starting…" action={() => startTask(t.id)} successToast="Task started" onSuccess={onChanged}>Start</MutationButton>
                ) : null}
                {t.status === "OPEN" || t.status === "IN_PROGRESS" ? (
                  <>
                    <MutationButton
                      variant="link"
                      className="text-emerald-700 hover:text-emerald-800"
                      pendingLabel="Completing…"
                      confirm={{ title: "Complete this task?", description: "Mark this task as completed.", confirmLabel: "Complete" }}
                      action={() => completeTask(t.id)}
                      successToast="Task completed"
                      onSuccess={onChanged}
                    >
                      Complete
                    </MutationButton>
                    {onReassign ? <button type="button" onClick={() => onReassign(t)} className="text-slate-500 hover:text-umber">Reassign</button> : null}
                    <MutationButton
                      variant="danger-link"
                      pendingLabel="Cancelling…"
                      confirm={{ title: "Cancel this task?", description: "The task will be marked cancelled. This cannot be undone.", confirmLabel: "Cancel task", cancelLabel: "Keep task", variant: "danger" }}
                      action={() => cancelTask(t.id)}
                      successToast="Task cancelled"
                      onSuccess={onChanged}
                    >
                      Cancel
                    </MutationButton>
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
