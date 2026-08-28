import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { ProviderReferralDetail, ProviderReferralSummary } from "@/types/referrals";

export interface ProviderReferralFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  overdueOnly?: boolean;
  actionRequired?: boolean;
}

export function listProviderReferrals(
  filters: ProviderReferralFilters = {},
): Promise<PaginatedResult<ProviderReferralSummary>> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  }
  const s = q.toString();
  return apiGet<PaginatedResult<ProviderReferralSummary>>(`/api/v1/provider-portal/referrals${s ? `?${s}` : ""}`);
}

export function getProviderReferral(id: string): Promise<ProviderReferralDetail> {
  return apiGet<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}`);
}

export interface RespondBody {
  action: "ACCEPT" | "CONDITIONALLY_ACCEPT" | "REQUEST_INFORMATION" | "DECLINE";
  message?: string;
  question?: string;
  conditions?: string;
  proposedStartDate?: string;
  fundingConfirmed?: boolean;
  capacityConfirmed?: boolean;
  declineReason?: string;
  declineNote?: string;
}

export function respondReferral(id: string, body: RespondBody): Promise<ProviderReferralDetail> {
  return apiPost<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}/respond`, body);
}

export function assignProviderReferral(id: string, assignedUserId: string | null): Promise<ProviderReferralDetail> {
  return apiPatch<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}/assignment`, { assignedUserId });
}

export function scheduleProviderPlacement(id: string, scheduledStartAt: string): Promise<ProviderReferralDetail> {
  return apiPatch<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}/schedule`, { scheduledStartAt });
}

export function confirmReferralStart(id: string, actualStartAt?: string): Promise<ProviderReferralDetail> {
  return apiPost<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}/confirm-start`, actualStartAt ? { actualStartAt } : {});
}

export function reportUnsuccessfulStart(
  id: string,
  body: { reason: string; note?: string },
): Promise<ProviderReferralDetail> {
  return apiPost<ProviderReferralDetail>(`/api/v1/provider-portal/referrals/${id}/report-unsuccessful-start`, body);
}
