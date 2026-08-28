import { apiGet, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { MessageView, TimelineItem } from "@/types/messages";

export function listCaseMessages(caseId: string): Promise<PaginatedResult<MessageView>> {
  return apiGet<PaginatedResult<MessageView>>(`/api/v1/cases/${caseId}/messages?pageSize=200`);
}

export function sendCaseMessage(caseId: string, body: string): Promise<MessageView> {
  return apiPost<MessageView>(`/api/v1/cases/${caseId}/messages`, { body });
}

export function listInternalNotes(caseId: string): Promise<PaginatedResult<MessageView>> {
  return apiGet<PaginatedResult<MessageView>>(`/api/v1/cases/${caseId}/internal-notes?pageSize=200`);
}

export function sendInternalNote(caseId: string, body: string): Promise<MessageView> {
  return apiPost<MessageView>(`/api/v1/cases/${caseId}/internal-notes`, { body });
}

export function listReferralMessages(referralId: string): Promise<PaginatedResult<MessageView>> {
  return apiGet<PaginatedResult<MessageView>>(`/api/v1/referrals/${referralId}/messages?pageSize=200`);
}

export function sendReferralMessage(referralId: string, body: string): Promise<MessageView> {
  return apiPost<MessageView>(`/api/v1/referrals/${referralId}/messages`, { body });
}

export function getCaseTimeline(
  caseId: string,
  params: { filter?: string; page?: number; pageSize?: number } = {},
): Promise<PaginatedResult<TimelineItem>> {
  const q = new URLSearchParams();
  if (params.filter) q.set("filter", params.filter);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const s = q.toString();
  return apiGet<PaginatedResult<TimelineItem>>(`/api/v1/cases/${caseId}/timeline${s ? `?${s}` : ""}`);
}
