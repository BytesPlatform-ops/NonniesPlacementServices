import { Prisma, type CaseStatus } from "@prisma/client";

/**
 * Shared, deterministic case query fragments used by both the org-scoped case
 * list and the platform-wide operations queue. Centralised so attention /
 * incompleteness definitions never diverge between the two surfaces.
 */

/** Statuses a case can still move through (excludes discharged + terminal). */
export const NON_TERMINAL_STATUSES: CaseStatus[] = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "MATCHING",
  "REFERRAL_SENT",
  "PROVIDER_REVIEWING",
  "ADDITIONAL_INFORMATION_REQUIRED",
  "ACCEPTED",
  "DECLINED",
  "SERVICES_BEING_COORDINATED",
  "READY_FOR_DISCHARGE",
  "SERVICE_STARTED",
  "FOLLOW_UP_REQUIRED",
];

/** Active = not COMPLETED and not CANCELLED (later lifecycle rows remain active). */
export const ACTIVE_STATUSES: CaseStatus[] = [...NON_TERMINAL_STATUSES, "DISCHARGED"];

export function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** OR-clauses matching any case that needs attention (mirrors the attention model). */
export function attentionWhere(now: Date): Prisma.CaseWhereInput[] {
  const notTerminal: Prisma.CaseWhereInput = { status: { in: NON_TERMINAL_STATUSES } };
  return [
    { blocked: true },
    { AND: [notTerminal, { expectedDischargeDate: { lt: startOfTodayUtc(now) } }] },
    { AND: [notTerminal, { assignedDischargeProfessionalId: null }] },
    { AND: [notTerminal, { preferredServiceLocation: null }] },
    { requirements: { some: { status: "BLOCKED" } } },
    { AND: [notTerminal, { requirements: { some: { mandatory: true, status: { notIn: ["COMPLETE", "NOT_REQUIRED"] } } } }] },
  ];
}

/** OR-clauses matching any case with an incomplete assessment. */
export function incompleteWhere(): Prisma.CaseWhereInput[] {
  return [
    { expectedDischargeDate: null },
    { currentCareSetting: null },
    { preferredServiceLocation: null },
    { assignedDischargeProfessionalId: null },
    { serviceRequests: { none: {} } },
    { requirements: { some: { mandatory: true, status: { notIn: ["COMPLETE", "NOT_REQUIRED"] } } } },
    { blocked: true },
  ];
}

/** Overdue = still movable and past the expected discharge day. */
export function overdueWhere(now: Date): Prisma.CaseWhereInput {
  return { status: { in: NON_TERMINAL_STATUSES }, expectedDischargeDate: { lt: startOfTodayUtc(now) } };
}
