import { apiGet, apiPost } from "@/lib/api-client";
import type { ReadinessView } from "@/types/readiness";

export function getCaseReadiness(caseId: string): Promise<ReadinessView> {
  return apiGet<ReadinessView>(`/api/v1/cases/${caseId}/readiness`);
}

export function markReadyForDischarge(caseId: string): Promise<ReadinessView> {
  return apiPost<ReadinessView>(`/api/v1/cases/${caseId}/mark-ready-for-discharge`, {});
}

export function markDischarged(caseId: string, actualDischargeDate: string, note?: string): Promise<ReadinessView> {
  return apiPost<ReadinessView>(`/api/v1/cases/${caseId}/mark-discharged`, { actualDischargeDate, ...(note ? { note } : {}) });
}

export function markServiceStarted(caseId: string, note?: string): Promise<ReadinessView> {
  return apiPost<ReadinessView>(`/api/v1/cases/${caseId}/mark-service-started`, note ? { note } : {});
}

export function markCompleted(caseId: string, note?: string): Promise<ReadinessView> {
  return apiPost<ReadinessView>(`/api/v1/cases/${caseId}/mark-completed`, note ? { note } : {});
}
