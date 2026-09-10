import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { SeekerAppointment } from "@/types/seeker";

/** Staff-side tours and appointments. Shares the family portal's view shape. */
export type CaseAppointment = SeekerAppointment;

export function listCaseAppointments(caseId: string): Promise<CaseAppointment[]> {
  return apiGet<CaseAppointment[]>(`/api/v1/cases/${caseId}/appointments`);
}

export function createCaseAppointment(
  caseId: string,
  input: {
    type?: string;
    providerId?: string;
    referralId?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    locationText?: string;
    instructions?: string;
  },
): Promise<CaseAppointment> {
  return apiPost<CaseAppointment>(`/api/v1/cases/${caseId}/appointments`, input);
}

export function updateCaseAppointment(
  caseId: string,
  appointmentId: string,
  input: {
    scheduledAt?: string;
    durationMinutes?: number;
    locationText?: string;
    instructions?: string;
    outcomeNote?: string;
    status?: "REQUESTED" | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
    cancelReason?: string;
  },
): Promise<CaseAppointment> {
  return apiPatch<CaseAppointment>(`/api/v1/cases/${caseId}/appointments/${appointmentId}`, input);
}
