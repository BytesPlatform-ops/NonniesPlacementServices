export type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const TASK_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export interface TaskView {
  id: string;
  caseId: string;
  organizationId: string;
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

export interface EligibleAssignee {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}
