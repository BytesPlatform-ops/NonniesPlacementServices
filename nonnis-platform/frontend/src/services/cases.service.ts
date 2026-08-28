import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  CaseDetail,
  CaseRequirementView,
  CaseStatus,
  CaseSummary,
  ServiceRequestView,
} from "@/types/domain";

export interface ListCasesParams {
  page?: number;
  pageSize?: number;
  status?: CaseStatus | "";
  search?: string;
  facilityId?: string;
  assignedToMe?: boolean;
  overdue?: boolean;
  attentionOnly?: boolean;
  incompleteOnly?: boolean;
  sort?: string;
  order?: "asc" | "desc";
}

export function listCases(params: ListCasesParams = {}): Promise<PaginatedResult<CaseSummary>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.facilityId) q.set("facilityId", params.facilityId);
  if (params.assignedToMe) q.set("assignedToMe", "true");
  if (params.overdue) q.set("overdue", "true");
  if (params.attentionOnly) q.set("attentionOnly", "true");
  if (params.incompleteOnly) q.set("incompleteOnly", "true");
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  const qs = q.toString();
  return apiGet<PaginatedResult<CaseSummary>>(`/api/v1/cases${qs ? `?${qs}` : ""}`);
}

export function getCase(id: string): Promise<CaseDetail> {
  return apiGet<CaseDetail>(`/api/v1/cases/${encodeURIComponent(id)}`);
}

export function createCase(body: Record<string, unknown>): Promise<CaseDetail> {
  return apiPost<CaseDetail>("/api/v1/cases", body);
}

export function updateCase(id: string, body: Record<string, unknown>): Promise<CaseDetail> {
  return apiPatch<CaseDetail>(`/api/v1/cases/${id}`, body);
}

export function transitionCase(id: string, toStatus: CaseStatus, reason?: string): Promise<CaseDetail> {
  return apiPost<CaseDetail>(`/api/v1/cases/${id}/transition`, { toStatus, reason });
}

export function assignCase(id: string, assignedUserId: string | null): Promise<CaseDetail> {
  return apiPatch<CaseDetail>(`/api/v1/cases/${id}/assignment`, { assignedUserId });
}

// ---- Requirements ----

export function createRequirement(caseId: string, body: Record<string, unknown>): Promise<CaseRequirementView> {
  return apiPost<CaseRequirementView>(`/api/v1/cases/${caseId}/requirements`, body);
}

export function updateRequirement(caseId: string, requirementId: string, body: Record<string, unknown>): Promise<CaseRequirementView> {
  return apiPatch<CaseRequirementView>(`/api/v1/cases/${caseId}/requirements/${requirementId}`, body);
}

// ---- Service requests ----

export function createServiceRequest(caseId: string, body: Record<string, unknown>): Promise<ServiceRequestView> {
  return apiPost<ServiceRequestView>(`/api/v1/cases/${caseId}/service-requests`, body);
}

export function updateServiceRequest(caseId: string, serviceRequestId: string, body: Record<string, unknown>): Promise<ServiceRequestView> {
  return apiPatch<ServiceRequestView>(`/api/v1/cases/${caseId}/service-requests/${serviceRequestId}`, body);
}

export function cancelServiceRequest(caseId: string, serviceRequestId: string): Promise<ServiceRequestView> {
  return apiDelete<ServiceRequestView>(`/api/v1/cases/${caseId}/service-requests/${serviceRequestId}`);
}
