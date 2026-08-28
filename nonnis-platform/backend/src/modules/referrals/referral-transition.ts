import type { PlacementStatus, ReferralStatus } from "@prisma/client";

/**
 * Legal referral status transitions, enforced server-side. Frontend controls are
 * UX only — every mutation re-checks the current state here.
 */
export const REFERRAL_TRANSITIONS: Partial<Record<ReferralStatus, ReferralStatus[]>> = {
  DRAFT: ["SENT", "CANCELLED", "WITHDRAWN"],
  SENT: ["VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED", "ACCEPTED", "DECLINED", "WITHDRAWN"],
  VIEWED: ["INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED", "ACCEPTED", "DECLINED", "WITHDRAWN"],
  INFORMATION_REQUESTED: ["VIEWED", "CONDITIONALLY_ACCEPTED", "ACCEPTED", "DECLINED", "WITHDRAWN"],
  CONDITIONALLY_ACCEPTED: ["ACCEPTED", "DECLINED", "INFORMATION_REQUESTED", "WITHDRAWN"],
  ACCEPTED: ["WITHDRAWN"],
  DECLINED: [],
  WITHDRAWN: [],
  CANCELLED: [],
};

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return (REFERRAL_TRANSITIONS[from] ?? []).includes(to);
}

/** A referral in one of these states can no longer receive provider responses. */
export function isReferralTerminal(status: ReferralStatus): boolean {
  return status === "DECLINED" || status === "WITHDRAWN" || status === "CANCELLED" || status === "ACCEPTED";
}

/** Legal placement transitions. */
export const PLACEMENT_TRANSITIONS: Partial<Record<PlacementStatus, PlacementStatus[]>> = {
  ACCEPTED: ["COORDINATING", "SCHEDULED", "CANCELLED"],
  COORDINATING: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["STARTED", "UNSUCCESSFUL", "COORDINATING", "CANCELLED"],
  STARTED: [],
  UNSUCCESSFUL: ["SCHEDULED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionPlacement(from: PlacementStatus, to: PlacementStatus): boolean {
  return (PLACEMENT_TRANSITIONS[from] ?? []).includes(to);
}
