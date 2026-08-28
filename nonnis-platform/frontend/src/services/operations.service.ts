import { apiGet } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { ProviderSummaryView } from "@/types/providers";
import type { AssigneeView, OperationsCaseSummary, OperationsSummary } from "@/types/operations";

export interface OperationsCaseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  organizationId?: string;
  facilityId?: string;
  status?: string;
  assignedUserId?: string;
  expectedFrom?: string;
  expectedTo?: string;
  overdue?: boolean;
  attentionOnly?: boolean;
  blockedOnly?: boolean;
  incompleteOnly?: boolean;
  unassignedOnly?: boolean;
  sort?: string;
  order?: string;
}

export interface OperationsProviderFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  availability?: string;
  serviceCategoryId?: string;
  state?: string;
  noServices?: boolean;
  noCoverage?: boolean;
  sort?: string;
}

function qs(filters: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) query.set(key, String(value));
  }
  const s = query.toString();
  return s ? `?${s}` : "";
}

export function getOperationsSummary(): Promise<OperationsSummary> {
  return apiGet<OperationsSummary>("/api/v1/operations/summary");
}

export function listOperationsCases(filters: OperationsCaseFilters = {}): Promise<PaginatedResult<OperationsCaseSummary>> {
  return apiGet<PaginatedResult<OperationsCaseSummary>>(`/api/v1/operations/cases${qs(filters)}`);
}

export function getCaseAssignees(caseId: string): Promise<AssigneeView[]> {
  return apiGet<AssigneeView[]>(`/api/v1/operations/cases/${caseId}/assignees`);
}

export function listOperationsProviders(
  filters: OperationsProviderFilters = {},
): Promise<PaginatedResult<ProviderSummaryView>> {
  return apiGet<PaginatedResult<ProviderSummaryView>>(`/api/v1/operations/providers${qs(filters)}`);
}
