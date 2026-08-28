import type { TaskStatus } from "@prisma/client";

/** Legal manual task transitions. COMPLETED/CANCELLED are terminal (no reopen). */
export const TASK_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  OPEN: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (TASK_TRANSITIONS[from] ?? []).includes(to);
}

export function isTaskEditable(status: TaskStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

/** Overdue is DERIVED, never stored: a due, still-open/in-progress task past due. */
export function isTaskOverdue(dueAt: Date | null, status: TaskStatus, now: Date = new Date()): boolean {
  if (!dueAt || (status !== "OPEN" && status !== "IN_PROGRESS")) return false;
  return dueAt.getTime() < now.getTime();
}
