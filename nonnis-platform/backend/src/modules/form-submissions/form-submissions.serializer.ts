import type { FormSubmissionStatus, WebsiteFormSubmission } from "@prisma/client";

export interface FormSubmissionSummary {
  id: string;
  reference: string;
  formKey: string;
  formName: string;
  sourcePage: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterPhone: string | null;
  status: FormSubmissionStatus;
  reviewed: boolean;
  attachmentsCount: number;
  submittedAt: string;
}

export interface FormSubmissionDetail extends FormSubmissionSummary {
  submittedData: unknown;
  emailStatus: string | null;
  reportGenerated: boolean;
  documentGenerated: boolean;
  internalNotes: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  relatedCaseId: string | null;
  relatedProviderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toFormSubmissionSummary(row: WebsiteFormSubmission): FormSubmissionSummary {
  return {
    id: row.id,
    reference: row.reference,
    formKey: row.formKey,
    formName: row.formName,
    sourcePage: row.sourcePage,
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
    submitterPhone: row.submitterPhone,
    status: row.status,
    reviewed: row.reviewedAt !== null,
    attachmentsCount: row.attachmentsCount,
    submittedAt: row.submittedAt.toISOString(),
  };
}

export function toFormSubmissionDetail(row: WebsiteFormSubmission, reviewedByName: string | null): FormSubmissionDetail {
  return {
    ...toFormSubmissionSummary(row),
    submittedData: row.submittedData,
    emailStatus: row.emailStatus,
    reportGenerated: row.reportGenerated,
    documentGenerated: row.documentGenerated,
    internalNotes: row.internalNotes,
    reviewedByUserId: row.reviewedByUserId,
    reviewedByName,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    relatedCaseId: row.relatedCaseId,
    relatedProviderId: row.relatedProviderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
