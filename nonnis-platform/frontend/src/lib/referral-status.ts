import type { StatusTone } from "@/lib/case-status";
import type { PlacementStatus, ReferralStatus } from "@/types/referrals";

const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  INFORMATION_REQUESTED: "Info Requested",
  CONDITIONALLY_ACCEPTED: "Conditional",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

const REFERRAL_TONES: Record<ReferralStatus, StatusTone> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "progress",
  INFORMATION_REQUESTED: "warning",
  CONDITIONALLY_ACCEPTED: "warning",
  ACCEPTED: "positive",
  DECLINED: "negative",
  WITHDRAWN: "neutral",
  CANCELLED: "neutral",
};

export function referralStatusLabel(status: ReferralStatus): string {
  return REFERRAL_LABELS[status] ?? status;
}

export function referralStatusTone(status: ReferralStatus): StatusTone {
  return REFERRAL_TONES[status] ?? "neutral";
}

const ACTIVE_AWAITING: ReferralStatus[] = ["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"];

/** A referral is overdue when it still awaits a response and its due date has passed. */
export function isReferralOverdue(responseDueAt: string | null, status: ReferralStatus, now: Date = new Date()): boolean {
  if (!responseDueAt || !ACTIVE_AWAITING.includes(status)) return false;
  return new Date(responseDueAt).getTime() < now.getTime();
}

const PLACEMENT_LABELS: Record<PlacementStatus, string> = {
  ACCEPTED: "Accepted",
  COORDINATING: "Coordinating",
  SCHEDULED: "Scheduled",
  STARTED: "Service Started",
  UNSUCCESSFUL: "Start Unsuccessful",
  CANCELLED: "Cancelled",
};

const PLACEMENT_TONES: Record<PlacementStatus, StatusTone> = {
  ACCEPTED: "info",
  COORDINATING: "progress",
  SCHEDULED: "progress",
  STARTED: "positive",
  UNSUCCESSFUL: "negative",
  CANCELLED: "neutral",
};

export function placementStatusLabel(status: PlacementStatus): string {
  return PLACEMENT_LABELS[status] ?? status;
}

export function placementStatusTone(status: PlacementStatus): StatusTone {
  return PLACEMENT_TONES[status] ?? "neutral";
}
