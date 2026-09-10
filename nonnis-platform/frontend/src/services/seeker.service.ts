import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { MessageView } from "@/types/messages";
import type {
  SeekerAccount,
  SeekerAppointment,
  SeekerCarePlan,
  SeekerCaseSummary,
  SeekerDashboard,
  SeekerDocument,
  SeekerProgress,
  SeekerProviderMatch,
} from "@/types/seeker";

/**
 * Family-portal API client.
 *
 * `caseId` is optional throughout: a family member linked to one case never
 * needs to pass it, and the server picks their case. It is only sent when a
 * relative authorized for several cases has chosen one.
 */
const withCase = (caseId?: string): string => (caseId ? `?caseId=${encodeURIComponent(caseId)}` : "");

export function listSeekerCases(): Promise<SeekerCaseSummary[]> {
  return apiGet<SeekerCaseSummary[]>("/api/v1/seeker/cases");
}

export function getSeekerDashboard(caseId?: string): Promise<SeekerDashboard> {
  return apiGet<SeekerDashboard>(`/api/v1/seeker/dashboard${withCase(caseId)}`);
}

export function getSeekerCarePlan(caseId?: string): Promise<SeekerCarePlan> {
  return apiGet<SeekerCarePlan>(`/api/v1/seeker/care-plan${withCase(caseId)}`);
}

export function getSeekerMatches(
  caseId?: string,
): Promise<{ case: SeekerCaseSummary; providers: SeekerProviderMatch[] }> {
  return apiGet(`/api/v1/seeker/matches${withCase(caseId)}`);
}

export function getSeekerMatch(referralId: string): Promise<SeekerProviderMatch> {
  return apiGet<SeekerProviderMatch>(`/api/v1/seeker/matches/${referralId}`);
}

export function getSeekerProgress(caseId?: string): Promise<SeekerProgress> {
  return apiGet<SeekerProgress>(`/api/v1/seeker/progress${withCase(caseId)}`);
}

export function listSeekerDocuments(caseId?: string): Promise<SeekerDocument[]> {
  return apiGet<SeekerDocument[]>(`/api/v1/seeker/documents${withCase(caseId)}`);
}

export function uploadSeekerDocument(
  documentId: string,
  file: { fileName: string; contentType: string; contentBase64: string },
  caseId?: string,
): Promise<SeekerDocument> {
  return apiPost<SeekerDocument>(`/api/v1/seeker/documents/${documentId}/upload`, { ...file, caseId });
}

export function getSeekerDocumentDownload(
  documentId: string,
  caseId?: string,
): Promise<{ url: string; fileName: string; contentType: string }> {
  return apiGet(`/api/v1/seeker/documents/${documentId}/download${withCase(caseId)}`);
}

export function listSeekerAppointments(caseId?: string): Promise<SeekerAppointment[]> {
  return apiGet<SeekerAppointment[]>(`/api/v1/seeker/appointments${withCase(caseId)}`);
}

export function requestSeekerTour(input: {
  providerId?: string;
  referralId?: string;
  note?: string;
  caseId?: string;
}): Promise<SeekerAppointment> {
  return apiPost<SeekerAppointment>("/api/v1/seeker/appointments", input);
}

export function respondToSeekerAppointment(
  appointmentId: string,
  input: { action: "CONFIRM" | "REQUEST_RESCHEDULE" | "CANCEL"; note?: string; caseId?: string },
): Promise<SeekerAppointment> {
  return apiPatch<SeekerAppointment>(`/api/v1/seeker/appointments/${appointmentId}`, input);
}

export function listSeekerMessages(
  params: { caseId?: string; page?: number; pageSize?: number } = {},
): Promise<PaginatedResult<MessageView>> {
  const q = new URLSearchParams();
  if (params.caseId) q.set("caseId", params.caseId);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGet<PaginatedResult<MessageView>>(`/api/v1/seeker/messages${suffix}`);
}

export function sendSeekerMessage(body: string, caseId?: string): Promise<MessageView> {
  return apiPost<MessageView>("/api/v1/seeker/messages", { body, caseId });
}

export function getSeekerAccount(): Promise<SeekerAccount> {
  return apiGet<SeekerAccount>("/api/v1/seeker/account");
}

export function updateSeekerAccount(input: {
  firstName?: string;
  lastName?: string;
  displayName?: string;
}): Promise<SeekerAccount> {
  return apiPatch<SeekerAccount>("/api/v1/seeker/account", input);
}
