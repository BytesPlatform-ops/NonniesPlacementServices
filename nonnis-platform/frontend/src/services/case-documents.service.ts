import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { SeekerDocument } from "@/types/seeker";

/** Staff-side case documents. The view shape is shared with the family portal. */
export type CaseDocument = SeekerDocument;

export function listCaseDocuments(caseId: string): Promise<CaseDocument[]> {
  return apiGet<CaseDocument[]>(`/api/v1/cases/${caseId}/documents`);
}

export function createCaseDocument(
  caseId: string,
  input: {
    title: string;
    description?: string;
    requestedFromSeeker?: boolean;
    visibility?: "CASE_TEAM" | "CARE_SEEKER";
    dueAt?: string;
  },
): Promise<CaseDocument> {
  return apiPost<CaseDocument>(`/api/v1/cases/${caseId}/documents`, input);
}

export function uploadCaseDocument(
  caseId: string,
  documentId: string,
  file: { fileName: string; contentType: string; contentBase64: string },
): Promise<CaseDocument> {
  return apiPost<CaseDocument>(`/api/v1/cases/${caseId}/documents/${documentId}/upload`, file);
}

export function reviewCaseDocument(
  caseId: string,
  documentId: string,
  input: { status: "ACCEPTED" | "NEEDS_UPDATE"; reviewNote?: string },
): Promise<CaseDocument> {
  return apiPatch<CaseDocument>(`/api/v1/cases/${caseId}/documents/${documentId}/review`, input);
}

export function getCaseDocumentDownload(
  caseId: string,
  documentId: string,
): Promise<{ url: string; fileName: string; contentType: string }> {
  return apiGet(`/api/v1/cases/${caseId}/documents/${documentId}/download`);
}
