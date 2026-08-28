import type { Task, TaskPriority, TaskStatus } from "@prisma/client";
import { isTaskOverdue } from "./task-transition";

export interface TaskView {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  overdue: boolean;
  assignee: { id: string; name: string | null } | null;
  createdBy: { id: string; name: string | null };
  completedBy: { id: string; name: string | null } | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseTaskView extends TaskView {
  organizationId: string;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toTaskView(task: Task, names: Map<string, string | null>, now: Date = new Date()): CaseTaskView {
  return {
    id: task.id,
    caseId: task.caseId,
    organizationId: task.organizationId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    overdue: isTaskOverdue(task.dueAt, task.status, now),
    assignee: task.assigneeUserId ? { id: task.assigneeUserId, name: names.get(task.assigneeUserId) ?? null } : null,
    createdBy: { id: task.createdByUserId, name: names.get(task.createdByUserId) ?? null },
    completedBy: task.completedByUserId ? { id: task.completedByUserId, name: names.get(task.completedByUserId) ?? null } : null,
    dueAt: iso(task.dueAt),
    completedAt: iso(task.completedAt),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
