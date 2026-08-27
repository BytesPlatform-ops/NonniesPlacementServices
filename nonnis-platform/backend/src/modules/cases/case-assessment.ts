import type { CaseStatus, RequirementStatus } from "@prisma/client";

/**
 * Deterministic case attention + completeness derived from currently available
 * facts. This is NOT the future Discharge Readiness Score — it uses only known
 * data and simple rules. Pure and timezone-safe (UTC day boundaries) so it is
 * fully unit-testable.
 */

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export interface AttentionReason {
  code: string;
  severity: Severity;
  label: string;
  entityType?: string;
  entityId?: string;
}

export interface AttentionSummary {
  level: Severity | "NONE";
  count: number;
  reasons: AttentionReason[];
}

export interface CompletenessCheck {
  code: string;
  label: string;
  passed: boolean;
  blocking: boolean;
}

export interface Completeness {
  percentage: number;
  checks: CompletenessCheck[];
  missing: string[];
  blockers: Array<{ code: string; label: string }>;
}

export interface AssessmentInput {
  status: CaseStatus;
  assignedProfessionalId: string | null;
  expectedDischargeDate: Date | null;
  actualDischargeDate: Date | null;
  currentCareSetting: string | null;
  preferredServiceLocation: string | null;
  blocked: boolean;
  patientContactPhone: string | null;
  representativeContact: string | null;
  createdAt: Date;
  requirements: Array<{ id: string; status: RequirementStatus; mandatory: boolean; label: string }>;
  serviceRequests: Array<{ id: string; levelOfCare: string | null; requestedStartDate: Date | null }>;
}

const TERMINAL: CaseStatus[] = ["DISCHARGED", "COMPLETED", "CANCELLED"];
const NEAR_TERM_DAYS = 3;

export function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole-day offset of `date` relative to `now` (0 = today, -1 = yesterday). */
export function dayOffset(date: Date, now: Date): number {
  const ms = startOfUtcDay(date) - startOfUtcDay(now);
  return Math.round(ms / 86_400_000);
}

export type DischargeBucket = "OVERDUE" | "TODAY" | "NEXT_24H" | "NEXT_3_DAYS" | "NEXT_7_DAYS" | "LATER" | "NO_DATE";

export function dischargeBucket(expected: Date | null, now: Date): DischargeBucket {
  if (!expected) return "NO_DATE";
  const offset = dayOffset(expected, now);
  if (offset < 0) return "OVERDUE";
  if (offset === 0) return "TODAY";
  if (offset === 1) return "NEXT_24H";
  if (offset <= NEAR_TERM_DAYS) return "NEXT_3_DAYS";
  if (offset <= 7) return "NEXT_7_DAYS";
  return "LATER";
}

function isTerminal(status: CaseStatus): boolean {
  return TERMINAL.includes(status);
}

function unresolvedMandatoryRequirements(input: AssessmentInput) {
  return input.requirements.filter((r) => r.mandatory && r.status !== "COMPLETE" && r.status !== "NOT_REQUIRED");
}

export function computeCompleteness(input: AssessmentInput): Completeness {
  const hasMandatoryResolved = unresolvedMandatoryRequirements(input).length === 0;

  const checks: CompletenessCheck[] = [
    { code: "expected_discharge_date", label: "Expected discharge date", passed: !!input.expectedDischargeDate, blocking: true },
    { code: "care_setting", label: "Current care setting", passed: !!input.currentCareSetting, blocking: true },
    { code: "destination", label: "Destination / preferred service location", passed: !!input.preferredServiceLocation, blocking: true },
    { code: "assigned_professional", label: "Assigned discharge professional", passed: !!input.assignedProfessionalId, blocking: true },
    { code: "service_request", label: "At least one service request", passed: input.serviceRequests.length > 0, blocking: true },
    { code: "requirements_resolved", label: "All required requirements resolved", passed: hasMandatoryResolved, blocking: true },
    { code: "not_blocked", label: "Case is not blocked", passed: !input.blocked, blocking: true },
  ];

  const passed = checks.filter((c) => c.passed).length;
  const percentage = Math.round((passed / checks.length) * 100);
  const failing = checks.filter((c) => !c.passed);

  return {
    percentage,
    checks,
    missing: failing.map((c) => c.label),
    blockers: failing.filter((c) => c.blocking).map((c) => ({ code: c.code, label: c.label })),
  };
}

export function computeAttention(input: AssessmentInput, now: Date = new Date()): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const terminal = isTerminal(input.status);

  if (input.blocked) {
    reasons.push({ code: "CASE_BLOCKED", severity: "CRITICAL", label: "Case is marked blocked" });
  }

  if (!terminal) {
    if (input.expectedDischargeDate && dayOffset(input.expectedDischargeDate, now) < 0) {
      reasons.push({ code: "DISCHARGE_DATE_PASSED", severity: "CRITICAL", label: "Expected discharge date has passed" });
    } else if (input.expectedDischargeDate && dayOffset(input.expectedDischargeDate, now) <= NEAR_TERM_DAYS) {
      reasons.push({ code: "DISCHARGE_NEAR_TERM", severity: "WARNING", label: "Discharge is within the next few days" });
    }

    if (!input.assignedProfessionalId) {
      reasons.push({ code: "NO_ASSIGNED_PROFESSIONAL", severity: "WARNING", label: "No discharge professional assigned" });
    }
    if (!input.preferredServiceLocation) {
      reasons.push({ code: "MISSING_DESTINATION", severity: "WARNING", label: "No destination / service location set" });
    }

    const blockedReq = input.requirements.find((r) => r.status === "BLOCKED");
    if (blockedReq) {
      reasons.push({
        code: "REQUIREMENT_BLOCKED",
        severity: "CRITICAL",
        label: "A requirement is blocked",
        entityType: "CaseRequirement",
        entityId: blockedReq.id,
      });
    }

    if (unresolvedMandatoryRequirements(input).length > 0) {
      reasons.push({ code: "REQUIREMENT_INCOMPLETE", severity: "WARNING", label: "Required requirements are incomplete" });
    }

    const incompleteService = input.serviceRequests.find((s) => !s.levelOfCare || !s.requestedStartDate);
    if (incompleteService) {
      reasons.push({
        code: "SERVICE_REQUEST_INCOMPLETE",
        severity: "INFO",
        label: "A service request is missing details",
        entityType: "ServiceRequest",
        entityId: incompleteService.id,
      });
    }

    if (!input.patientContactPhone && !input.representativeContact) {
      reasons.push({ code: "MISSING_CONTACT_INFO", severity: "INFO", label: "No patient or representative contact on file" });
    }

    if (computeCompleteness(input).percentage < 100) {
      reasons.push({ code: "INCOMPLETE_ASSESSMENT", severity: "INFO", label: "Intake assessment is incomplete" });
    }
  }

  if (input.actualDischargeDate && input.actualDischargeDate.getTime() < input.createdAt.getTime()) {
    reasons.push({ code: "INCONSISTENT_DATES", severity: "WARNING", label: "Actual discharge date precedes case creation" });
  }

  return reasons;
}

const RANK: Record<Severity, number> = { INFO: 1, WARNING: 2, CRITICAL: 3 };

export function attentionSummary(reasons: AttentionReason[]): AttentionSummary {
  if (reasons.length === 0) return { level: "NONE", count: 0, reasons };
  const level = reasons.reduce<Severity>((max, r) => (RANK[r.severity] > RANK[max] ? r.severity : max), "INFO");
  return { level, count: reasons.length, reasons };
}
