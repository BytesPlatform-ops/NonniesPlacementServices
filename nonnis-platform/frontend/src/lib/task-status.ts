import type { StatusTone } from "@/lib/case-status";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<TaskStatus, StatusTone> = {
  OPEN: "info",
  IN_PROGRESS: "progress",
  COMPLETED: "positive",
  CANCELLED: "neutral",
};

export function taskStatusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function taskStatusTone(status: TaskStatus): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_TONES: Record<TaskPriority, StatusTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "negative",
};

export function taskPriorityLabel(priority: TaskPriority): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function taskPriorityTone(priority: TaskPriority): StatusTone {
  return PRIORITY_TONES[priority] ?? "neutral";
}

/** Overdue = due date passed and the task is still open/in-progress. */
export function isTaskOverdue(dueAt: string | null, status: TaskStatus, now: Date = new Date()): boolean {
  if (!dueAt || (status !== "OPEN" && status !== "IN_PROGRESS")) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

const SCOPE_LABELS: Record<string, string> = {
  CASE_TEAM: "Case team",
  NONNIS_INTERNAL: "Nonnis internal",
  PROVIDER_REFERRAL: "Provider",
};

export function messageScopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}
