export type FormSubmissionStatus = "NEW" | "IN_REVIEW" | "RESOLVED" | "ARCHIVED";

export const FORM_SUBMISSION_STATUSES: FormSubmissionStatus[] = ["NEW", "IN_REVIEW", "RESOLVED", "ARCHIVED"];

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

export interface SubmissionField {
  label: string;
  value: string;
}

export interface SubmissionSection {
  title: string;
  fields: SubmissionField[];
}

export interface FormSubmissionDetail extends FormSubmissionSummary {
  submittedData: { sections?: SubmissionSection[] } | unknown;
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
