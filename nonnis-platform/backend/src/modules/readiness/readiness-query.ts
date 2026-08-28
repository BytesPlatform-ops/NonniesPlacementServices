import { Prisma } from "@prisma/client";
import { NON_TERMINAL_STATUSES, startOfTodayUtc } from "../cases/case-query";

/**
 * Shared, efficient Prisma WHERE fragments approximating readiness signals for
 * LIST / dashboard / operations surfaces. These never load a full case per row —
 * they are count/filter clauses only. Full, authoritative readiness for a single
 * case is always computed live by the readiness domain.
 */

/** A required, non-cancelled service request that has no accepted, non-cancelled placement. */
const SERVICE_REQUEST_UNPLACED: Prisma.ServiceRequestWhereInput = {
  status: { not: "CANCELLED" },
  referrals: { none: { status: "ACCEPTED", placement: { status: { not: "CANCELLED" } } } },
};

/** An accepted placement that is not yet scheduled or started. */
const PLACEMENT_UNSCHEDULED: Prisma.ReferralWhereInput = {
  status: "ACCEPTED",
  placement: { status: { in: ["ACCEPTED", "COORDINATING"] } },
};

/** Any case-level critical readiness blocker expressible as a WHERE clause. */
export function criticalBlockerWhere(): Prisma.CaseWhereInput {
  return {
    OR: [
      { blocked: true },
      { requirements: { some: { mandatory: true, status: "BLOCKED" } } },
      { serviceRequests: { some: { status: { not: "CANCELLED" }, referrals: { some: { status: "ACCEPTED", placement: { status: "UNSUCCESSFUL" } } } } } },
    ],
  };
}

/** Active cases that still lack a placement on at least one required service request. */
export function placementMissingWhere(): Prisma.CaseWhereInput {
  return {
    status: { in: NON_TERMINAL_STATUSES },
    serviceRequests: { some: SERVICE_REQUEST_UNPLACED },
  };
}

/** Active cases with at least one accepted-but-unscheduled placement. */
export function serviceUnscheduledWhere(): Prisma.CaseWhereInput {
  return {
    status: { in: NON_TERMINAL_STATUSES },
    serviceRequests: { some: { status: { not: "CANCELLED" }, referrals: { some: PLACEMENT_UNSCHEDULED } } },
  };
}

/** Discharged cases where a required placement has not started. */
export function dischargedNotStartedWhere(): Prisma.CaseWhereInput {
  return {
    status: "DISCHARGED",
    serviceRequests: { some: { status: { not: "CANCELLED" }, referrals: { some: { status: "ACCEPTED", placement: { status: { in: ["ACCEPTED", "COORDINATING", "SCHEDULED"] } } } } } },
  };
}

/** Cases marked READY_FOR_DISCHARGE that now have a blocking regression. */
export function readinessRegressionWhere(): Prisma.CaseWhereInput {
  return {
    status: "READY_FOR_DISCHARGE",
    OR: [
      { blocked: true },
      { requirements: { some: { mandatory: true, status: { in: ["BLOCKED", "PENDING", "IN_PROGRESS"] } } } },
      { serviceRequests: { some: SERVICE_REQUEST_UNPLACED } },
      { serviceRequests: { some: { status: { not: "CANCELLED" }, referrals: { some: { status: "ACCEPTED", placement: { status: "UNSUCCESSFUL" } } } } } },
    ],
  };
}

/** Near-term (within N days), still-active, not-yet-ready cases. */
export function nearTermNotReadyWhere(now: Date, days = 3): Prisma.CaseWhereInput {
  const today = startOfTodayUtc(now);
  const horizon = new Date(today.getTime() + (days + 1) * 86_400_000);
  return {
    status: { in: NON_TERMINAL_STATUSES.filter((s) => s !== "READY_FOR_DISCHARGE") },
    expectedDischargeDate: { lt: horizon },
  };
}
