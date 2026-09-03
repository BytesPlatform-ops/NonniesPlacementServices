import { apiGet, apiPatch } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type { FormSubmissionDetail, FormSubmissionSummary } from "@/types/form-submissions";

export interface FormSubmissionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  formKey?: string;
  status?: string;
  sourcePage?: string;
  reviewed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: string;
}

export function listFormSubmissions(
  filters: FormSubmissionFilters = {},
): Promise<PaginatedResult<FormSubmissionSummary>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) query.set(key, String(value));
  }
  const s = query.toString();
  return apiGet<PaginatedResult<FormSubmissionSummary>>(`/api/v1/form-submissions${s ? `?${s}` : ""}`);
}

export function getFormSubmission(id: string): Promise<FormSubmissionDetail> {
  return apiGet<FormSubmissionDetail>(`/api/v1/form-submissions/${id}`);
}

export function updateFormSubmission(
  id: string,
  body: { status?: string; internalNotes?: string; relatedCaseId?: string | null; relatedProviderId?: string | null },
): Promise<FormSubmissionDetail> {
  return apiPatch<FormSubmissionDetail>(`/api/v1/form-submissions/${id}`, body);
}

/** Mint a short-lived signed URL for one stored submission file. */
export function getSubmissionAttachmentUrl(submissionId: string, attachmentId: string): Promise<{ url: string; fileName: string }> {
  return apiGet(`/api/v1/form-submissions/${submissionId}/attachments/${attachmentId}/download`);
}
