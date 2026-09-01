import { Prisma } from "@prisma/client";
import { NON_TERMINAL_STATUSES } from "../cases/case-query";
import {
  criticalBlockerWhere,
  dischargedNotStartedWhere,
  nearTermNotReadyWhere,
  placementMissingWhere,
  serviceUnscheduledWhere,
} from "../readiness/readiness-query";

/**
 * Readiness-oriented WHERE fragments for reporting, composed ONLY from the
 * shared readiness-query helpers (single source of truth). These are the same
 * deterministic approximations the Operations surfaces use for list/count
 * filtering; authoritative per-case readiness is still computed live via the
 * readiness domain for each displayed row.
 */

export type ReadinessLevelFilter = "READY" | "NEEDS_ATTENTION" | "BLOCKED";

export function readinessLevelWhere(level: ReadinessLevelFilter): Prisma.CaseWhereInput {
  switch (level) {
    case "BLOCKED":
      return criticalBlockerWhere();
    case "READY":
      return { status: "READY_FOR_DISCHARGE", NOT: criticalBlockerWhere() };
    case "NEEDS_ATTENTION":
      return {
        AND: [
          { status: { in: NON_TERMINAL_STATUSES } },
          { status: { not: "READY_FOR_DISCHARGE" } },
          { NOT: criticalBlockerWhere() },
        ],
      };
  }
}

export type BlockerTypeFilter =
  | "CRITICAL_BLOCKER"
  | "PLACEMENT_MISSING"
  | "SERVICE_UNSCHEDULED"
  | "DISCHARGED_NOT_STARTED"
  | "NEAR_TERM_NOT_READY";

export function blockerTypeWhere(type: BlockerTypeFilter, now: Date): Prisma.CaseWhereInput {
  switch (type) {
    case "CRITICAL_BLOCKER":
      return criticalBlockerWhere();
    case "PLACEMENT_MISSING":
      return placementMissingWhere();
    case "SERVICE_UNSCHEDULED":
      return serviceUnscheduledWhere();
    case "DISCHARGED_NOT_STARTED":
      return dischargedNotStartedWhere();
    case "NEAR_TERM_NOT_READY":
      return nearTermNotReadyWhere(now);
  }
}
