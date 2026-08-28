import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { EligibleAssignee, TaskView } from "@/types/tasks";

export interface TaskFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assigneeUserId?: string;
  assignedToMe?: boolean;
  overdueOnly?: boolean;
  openOnly?: boolean;
  organizationId?: string;
  search?: string;
  sort?: string;
  order?: string;
}

function qs(filters: object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listCaseTasks(caseId: string, filters: TaskFilters = {}): Promise<PaginatedResult<TaskView>> {
  return apiGet<PaginatedResult<TaskView>>(`/api/v1/cases/${caseId}/tasks${qs(filters)}`);
}

export function getTaskAssignees(caseId: string): Promise<EligibleAssignee[]> {
  return apiGet<EligibleAssignee[]>(`/api/v1/cases/${caseId}/task-assignees`);
}

export function createTask(
  caseId: string,
  body: { title: string; description?: string; assigneeUserId?: string; priority?: string; dueAt?: string },
): Promise<TaskView> {
  return apiPost<TaskView>(`/api/v1/cases/${caseId}/tasks`, body);
}

export function listMyTasks(filters: TaskFilters = {}): Promise<PaginatedResult<TaskView>> {
  return apiGet<PaginatedResult<TaskView>>(`/api/v1/tasks${qs(filters)}`);
}

export function listOperationsTasks(filters: TaskFilters = {}): Promise<PaginatedResult<TaskView>> {
  return apiGet<PaginatedResult<TaskView>>(`/api/v1/operations/tasks${qs(filters)}`);
}

export function updateTask(
  id: string,
  body: { title?: string; description?: string; priority?: string; dueAt?: string; assigneeUserId?: string | null },
): Promise<TaskView> {
  return apiPatch<TaskView>(`/api/v1/tasks/${id}`, body);
}

export function startTask(id: string): Promise<TaskView> {
  return apiPost<TaskView>(`/api/v1/tasks/${id}/start`);
}

export function completeTask(id: string): Promise<TaskView> {
  return apiPost<TaskView>(`/api/v1/tasks/${id}/complete`);
}

export function cancelTask(id: string, reason?: string): Promise<TaskView> {
  return apiPost<TaskView>(`/api/v1/tasks/${id}/cancel`, reason ? { reason } : {});
}
