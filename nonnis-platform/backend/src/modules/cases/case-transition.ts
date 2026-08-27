import type { CaseStatus } from "@prisma/client";
import type { Completeness } from "./case-assessment";

/**
 * Manual status transitions permitted in this slice. Later statuses
 * (MATCHING, REFERRAL_SENT, …) are driven by future matching/referral modules,
 * not by manual PATCH. Records already in those states remain readable.
 */
export const MANUAL_TRANSITIONS: Partial<Record<CaseStatus, CaseStatus[]>> = {
  DRAFT: ["READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["DRAFT", "CANCELLED"],
};

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
  blockers?: Array<{ code: string; label: string }>;
}

/** Validates a manual transition, gating READY_FOR_REVIEW on completeness. */
export function checkTransition(from: CaseStatus, to: CaseStatus, completeness: Completeness): TransitionCheck {
  const targets = MANUAL_TRANSITIONS[from] ?? [];
  if (!targets.includes(to)) {
    return { allowed: false, reason: `Transition from ${from} to ${to} is not permitted in this workflow.` };
  }
  if (to === "READY_FOR_REVIEW" && completeness.blockers.length > 0) {
    return { allowed: false, reason: "The case is not ready for review.", blockers: completeness.blockers };
  }
  return { allowed: true };
}

/** Whether a case in this status may still be edited. */
export function isEditable(status: CaseStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}
