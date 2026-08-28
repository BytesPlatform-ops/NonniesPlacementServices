import type { CaseStatus } from "@/types/domain";

export type StatusTone = "neutral" | "info" | "progress" | "warning" | "positive" | "negative";

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

/** Human label + semantic tone for every case status. */
const STATUS_META: Record<CaseStatus, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  READY_FOR_REVIEW: { label: "Ready for Review", tone: "info" },
  MATCHING: { label: "Provider Selection", tone: "progress" },
  REFERRAL_SENT: { label: "Referral Sent", tone: "progress" },
  PROVIDER_REVIEWING: { label: "Provider Reviewing", tone: "progress" },
  ADDITIONAL_INFORMATION_REQUIRED: { label: "Info Required", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "positive" },
  DECLINED: { label: "Declined", tone: "negative" },
  SERVICES_BEING_COORDINATED: { label: "Coordinating Services", tone: "progress" },
  READY_FOR_DISCHARGE: { label: "Ready for Discharge", tone: "info" },
  DISCHARGED: { label: "Discharged", tone: "info" },
  SERVICE_STARTED: { label: "Service Started", tone: "positive" },
  FOLLOW_UP_REQUIRED: { label: "Follow-up Required", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "positive" },
  CANCELLED: { label: "Cancelled", tone: "negative" },
};

export function caseStatusMeta(status: CaseStatus): StatusMeta {
  return STATUS_META[status];
}

/** Ordered statuses for filter controls. */
export const CASE_STATUS_ORDER: CaseStatus[] = Object.keys(STATUS_META) as CaseStatus[];
