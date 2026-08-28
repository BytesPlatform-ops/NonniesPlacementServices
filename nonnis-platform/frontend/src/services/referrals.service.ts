import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { StaffReferralDetail, StaffReferralSummary } from "@/types/referrals";

export function listCaseReferrals(caseId: string): Promise<StaffReferralSummary[]> {
  return apiGet<StaffReferralSummary[]>(`/api/v1/cases/${caseId}/referrals`);
}

export function getReferral(id: string): Promise<StaffReferralDetail> {
  return apiGet<StaffReferralDetail>(`/api/v1/referrals/${id}`);
}

export function createReferral(
  caseId: string,
  serviceRequestId: string,
  body: { providerId: string; responseDueAt?: string; coordinationNote?: string; sendNow?: boolean },
): Promise<StaffReferralDetail> {
  return apiPost<StaffReferralDetail>(`/api/v1/cases/${caseId}/service-requests/${serviceRequestId}/referrals`, body);
}

export function sendReferral(id: string, body: { responseDueAt?: string } = {}): Promise<StaffReferralDetail> {
  return apiPost<StaffReferralDetail>(`/api/v1/referrals/${id}/send`, body);
}

export function withdrawReferral(id: string, body: { reason?: string } = {}): Promise<StaffReferralDetail> {
  return apiPost<StaffReferralDetail>(`/api/v1/referrals/${id}/withdraw`, body);
}

export function provideReferralInformation(id: string, message: string): Promise<StaffReferralDetail> {
  return apiPost<StaffReferralDetail>(`/api/v1/referrals/${id}/information`, { message });
}

export function resendReferralNotification(id: string): Promise<StaffReferralDetail> {
  return apiPost<StaffReferralDetail>(`/api/v1/referrals/${id}/resend-notification`);
}

export function scheduleReferralPlacement(id: string, scheduledStartAt: string): Promise<StaffReferralDetail> {
  return apiPatch<StaffReferralDetail>(`/api/v1/referrals/${id}/placement`, { scheduledStartAt });
}

export interface OperationsReferralFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  organizationId?: string;
  facilityId?: string;
  providerId?: string;
  overdueOnly?: boolean;
  actionRequired?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export function listOperationsReferrals(
  filters: OperationsReferralFilters = {},
): Promise<PaginatedResult<StaffReferralSummary>> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  }
  const s = q.toString();
  return apiGet<PaginatedResult<StaffReferralSummary>>(`/api/v1/operations/referrals${s ? `?${s}` : ""}`);
}
