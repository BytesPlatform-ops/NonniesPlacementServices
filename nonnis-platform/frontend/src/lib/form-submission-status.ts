import type { StatusTone } from "@/lib/case-status";
import type { FormSubmissionStatus } from "@/types/form-submissions";

const LABELS: Record<FormSubmissionStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
};

export function submissionStatusLabel(status: FormSubmissionStatus): string {
  return LABELS[status] ?? status;
}

export function submissionStatusTone(status: FormSubmissionStatus): StatusTone {
  switch (status) {
    case "NEW":
      return "info";
    case "IN_REVIEW":
      return "warning";
    case "RESOLVED":
      return "positive";
    case "ARCHIVED":
    default:
      return "neutral";
  }
}
