import type {
  CaseStatus,
  LevelOfCare,
  PlacementStatus,
  RequirementCategory,
  RequirementStatus,
  ServiceCategoryCode,
  ServiceRequestStatus,
} from "@prisma/client";

/**
 * Deterministic, explainable discharge readiness. Pure and fully unit-testable —
 * it reads ONLY currently-available facts (case fields, requirements, service
 * requests, accepted placements) and applies simple, transparent rules.
 *
 * This is NOT AI, NOT predictive, NOT advanced analytics, and it takes no action.
 * It is distinct from Case Attention: attention answers "what needs attention
 * operationally?"; readiness answers "are all required discharge conditions
 * satisfied, and WHY / why not?".
 *
 * Two separate concepts are returned deliberately:
 *  - `percentage`  — a transparent view of completed applicable components.
 *  - `gates`       — mandatory conditions that must ALL pass for `ready` to be
 *                    true. A high percentage alone NEVER makes a case ready.
 */

export type ComponentStatus = "COMPLETE" | "INCOMPLETE" | "BLOCKED" | "NOT_APPLICABLE";
export type ReadinessLevel = "READY" | "NEEDS_ATTENTION" | "BLOCKED";
export type ReadinessPhase = "PRE_DISCHARGE" | "POST_DISCHARGE";
export type BlockerSeverity = "INFO" | "WARNING" | "CRITICAL";

/** A workspace section a component/blocker points the user toward. */
export type WorkspaceLink =
  | "assessment"
  | "requirements"
  | "service-requests"
  | "referrals"
  | "tasks"
  | "overview";

export interface ReadinessComponent {
  code: string;
  label: string;
  status: ComponentStatus;
  required: boolean;
  explanation: string;
  link?: WorkspaceLink;
  entityType?: string;
  entityId?: string;
}

export interface ReadinessGate {
  code: string;
  label: string;
  passed: boolean;
  explanation: string;
}

export interface ReadinessBlocker {
  code: string;
  severity: BlockerSeverity;
  label: string;
  explanation: string;
  link?: WorkspaceLink;
  entityType?: string;
  entityId?: string;
}

export interface ReadinessResult {
  percentage: number;
  ready: boolean;
  level: ReadinessLevel;
  phase: ReadinessPhase;
  components: ReadinessComponent[];
  gates: ReadinessGate[];
  blockers: ReadinessBlocker[];
  /** True when status is READY_FOR_DISCHARGE but readiness is no longer satisfied. */
  statusMismatch: boolean;
  serviceStart: ServiceStartSummary;
}

/** Post-discharge service-commencement view — distinct from pre-discharge readiness. */
export interface ServiceStartSummary {
  requiredPlacements: number;
  startedPlacements: number;
  unsuccessfulPlacements: number;
  allStarted: boolean;
}

export interface ReadinessRequirement {
  id: string;
  category: RequirementCategory;
  status: RequirementStatus;
  mandatory: boolean;
  label: string;
}

/** The accepted, non-cancelled placement resolved for a service request (if any). */
export interface ReadinessPlacement {
  status: PlacementStatus;
  scheduledStartAt: Date | null;
  actualStartAt: Date | null;
}

export interface ReadinessServiceRequest {
  id: string;
  category: ServiceCategoryCode;
  status: ServiceRequestStatus;
  levelOfCare: LevelOfCare | null;
  requestedStartDate: Date | null;
  transportationRequired: boolean;
  equipmentNeeds: string | null;
  fundingSource: string | null;
  insurancePlan: string | null;
  placement: ReadinessPlacement | null;
}

export interface ReadinessInput {
  status: CaseStatus;
  blocked: boolean;
  assignedProfessionalId: string | null;
  expectedDischargeDate: Date | null;
  actualDischargeDate: Date | null;
  currentCareSetting: string | null;
  preferredServiceLocation: string | null;
  patientContactPhone: string | null;
  representativeContact: string | null;
  createdAt: Date;
  requirements: ReadinessRequirement[];
  serviceRequests: ReadinessServiceRequest[];
}

/** Statuses in which a case is no longer an active, pre-discharge candidate. */
const INACTIVE_STATUSES: CaseStatus[] = ["CANCELLED", "DECLINED", "COMPLETED"];
const POST_DISCHARGE_STATUSES: CaseStatus[] = ["DISCHARGED", "SERVICE_STARTED", "FOLLOW_UP_REQUIRED", "COMPLETED"];

// ---- Per-service-request predicates ----

function activeServiceRequests(input: ReadinessInput): ReadinessServiceRequest[] {
  return input.serviceRequests.filter((s) => s.status !== "CANCELLED");
}

/** Placed = an accepted, non-cancelled, non-unsuccessful placement exists. */
function isPlaced(sr: ReadinessServiceRequest): boolean {
  return sr.placement !== null && sr.placement.status !== "CANCELLED" && sr.placement.status !== "UNSUCCESSFUL";
}

function isUnsuccessful(sr: ReadinessServiceRequest): boolean {
  return sr.placement?.status === "UNSUCCESSFUL";
}

function isScheduled(sr: ReadinessServiceRequest): boolean {
  if (!sr.placement) return false;
  return sr.placement.scheduledStartAt !== null || sr.placement.status === "SCHEDULED" || sr.placement.status === "STARTED";
}

function isStarted(sr: ReadinessServiceRequest): boolean {
  return sr.placement?.status === "STARTED";
}

// ---- Requirement helpers ----

function requiredRequirements(input: ReadinessInput): ReadinessRequirement[] {
  return input.requirements.filter((r) => r.mandatory);
}

function blockedRequirement(input: ReadinessInput): ReadinessRequirement | undefined {
  return requiredRequirements(input).find((r) => r.status === "BLOCKED");
}

function unresolvedRequirements(input: ReadinessInput): ReadinessRequirement[] {
  return requiredRequirements(input).filter((r) => r.status !== "COMPLETE" && r.status !== "NOT_REQUIRED");
}

/** Resolution of a conditional need represented by a requirement category. */
function categoryResolution(
  input: ReadinessInput,
  category: RequirementCategory,
): "BLOCKED" | "COMPLETE" | "INCOMPLETE" {
  const rows = input.requirements.filter((r) => r.category === category);
  if (rows.some((r) => r.status === "BLOCKED")) return "BLOCKED";
  if (rows.length > 0 && rows.every((r) => r.status === "COMPLETE" || r.status === "NOT_REQUIRED")) return "COMPLETE";
  return "INCOMPLETE";
}

function missingCaseInformation(input: ReadinessInput): string[] {
  const missing: string[] = [];
  if (!input.expectedDischargeDate) missing.push("expected discharge date");
  if (!input.currentCareSetting) missing.push("current care setting");
  if (!input.preferredServiceLocation) missing.push("destination / service location");
  if (!input.patientContactPhone && !input.representativeContact) missing.push("patient or representative contact");
  return missing;
}

function datesValid(input: ReadinessInput): boolean {
  if (input.actualDischargeDate && input.actualDischargeDate.getTime() < input.createdAt.getTime()) return false;
  if (input.expectedDischargeDate && input.actualDischargeDate) {
    // Same tolerance used by case update validation.
    if (input.actualDischargeDate.getTime() < input.expectedDischargeDate.getTime() - 365 * 86_400_000) return false;
  }
  return true;
}

// ---- Component builder ----

function buildComponents(input: ReadinessInput): ReadinessComponent[] {
  const active = activeServiceRequests(input);
  const components: ReadinessComponent[] = [];

  // 1. Case information.
  const infoMissing = missingCaseInformation(input);
  components.push({
    code: "case_information",
    label: "Case information",
    status: infoMissing.length === 0 ? "COMPLETE" : "INCOMPLETE",
    required: true,
    link: "assessment",
    explanation:
      infoMissing.length === 0
        ? "Required case information is complete."
        : `Missing: ${infoMissing.join(", ")}.`,
  });

  // 2. Discharge professional.
  components.push({
    code: "case_assignment",
    label: "Assigned discharge professional",
    status: input.assignedProfessionalId ? "COMPLETE" : "INCOMPLETE",
    required: true,
    link: "overview",
    explanation: input.assignedProfessionalId
      ? "A discharge professional is assigned."
      : "No discharge professional is assigned to this case.",
  });

  // 3. Service requests defined.
  const incompleteSr = active.find((s) => !s.levelOfCare || !s.requestedStartDate);
  const srStatus: ComponentStatus = active.length === 0 || incompleteSr ? "INCOMPLETE" : "COMPLETE";
  components.push({
    code: "service_requests",
    label: "Service requests",
    status: srStatus,
    required: true,
    link: "service-requests",
    explanation:
      active.length === 0
        ? "At least one active service request is required."
        : incompleteSr
          ? "A service request is missing its level of care or requested start date."
          : "All active service requests capture the minimum coordination detail.",
    entityType: incompleteSr ? "ServiceRequest" : undefined,
    entityId: incompleteSr?.id,
  });

  // 4. Requirements.
  const blockedReq = blockedRequirement(input);
  const unresolved = unresolvedRequirements(input);
  const reqStatus: ComponentStatus = blockedReq ? "BLOCKED" : unresolved.length > 0 ? "INCOMPLETE" : "COMPLETE";
  components.push({
    code: "requirements",
    label: "Required requirements",
    status: reqStatus,
    required: true,
    link: "requirements",
    explanation: blockedReq
      ? `A required requirement is blocked: ${blockedReq.label || "unnamed requirement"}.`
      : unresolved.length > 0
        ? `${unresolved.length} required requirement(s) still open.`
        : "All required requirements are complete or marked not required.",
    entityType: blockedReq ? "CaseRequirement" : undefined,
    entityId: blockedReq?.id,
  });

  // 5. Provider placement.
  let placementStatus: ComponentStatus;
  let placementExplanation: string;
  if (active.length === 0) {
    placementStatus = "NOT_APPLICABLE";
    placementExplanation = "No active service requests require a provider placement.";
  } else if (active.some(isUnsuccessful)) {
    placementStatus = "BLOCKED";
    placementExplanation = "A required service placement was reported unsuccessful and needs manual intervention.";
  } else if (active.every(isPlaced)) {
    placementStatus = "COMPLETE";
    placementExplanation = "Every active service request has an accepted provider placement.";
  } else {
    const missing = active.filter((s) => !isPlaced(s)).length;
    placementStatus = "INCOMPLETE";
    placementExplanation = `${missing} of ${active.length} service request(s) still need an accepted provider placement.`;
  }
  const unsuccessfulSr = active.find(isUnsuccessful);
  components.push({
    code: "provider_placement",
    label: "Provider placement",
    status: placementStatus,
    required: true,
    link: "referrals",
    explanation: placementExplanation,
    entityType: unsuccessfulSr ? "ServiceRequest" : undefined,
    entityId: unsuccessfulSr?.id,
  });

  // 6. Service scheduling (applicable once placements exist).
  const placed = active.filter(isPlaced);
  let scheduleStatus: ComponentStatus;
  let scheduleExplanation: string;
  if (placed.length === 0) {
    scheduleStatus = "NOT_APPLICABLE";
    scheduleExplanation = "No accepted placements to schedule yet.";
  } else if (placed.every(isScheduled)) {
    scheduleStatus = "COMPLETE";
    scheduleExplanation = "Every accepted placement has a scheduled service start.";
  } else {
    const unscheduled = placed.filter((s) => !isScheduled(s)).length;
    scheduleStatus = "INCOMPLETE";
    scheduleExplanation = `${unscheduled} accepted placement(s) have no scheduled service start.`;
  }
  components.push({
    code: "service_scheduling",
    label: "Service scheduling",
    status: scheduleStatus,
    required: true,
    link: "referrals",
    explanation: scheduleExplanation,
  });

  // 7. Funding information (informational — never asserts authorization approval).
  let fundingStatus: ComponentStatus;
  let fundingExplanation: string;
  if (active.length === 0) {
    fundingStatus = "NOT_APPLICABLE";
    fundingExplanation = "No active service requests to fund.";
  } else if (active.every((s) => s.fundingSource || s.insurancePlan)) {
    fundingStatus = "COMPLETE";
    fundingExplanation = "Funding / insurance information is recorded for each service request.";
  } else {
    fundingStatus = "INCOMPLETE";
    fundingExplanation = "Funding / insurance information is missing on one or more service requests.";
  }
  components.push({
    code: "funding_information",
    label: "Funding information",
    status: fundingStatus,
    required: false,
    link: "service-requests",
    explanation: fundingExplanation,
  });

  // 8. Transportation (conditional).
  const transportNeeded = active.some((s) => s.transportationRequired);
  if (!transportNeeded) {
    components.push({
      code: "transportation",
      label: "Transportation",
      status: "NOT_APPLICABLE",
      required: false,
      link: "requirements",
      explanation: "No service request requires transportation.",
    });
  } else {
    const res = categoryResolution(input, "TRANSPORTATION");
    components.push({
      code: "transportation",
      label: "Transportation",
      status: res,
      required: false,
      link: "requirements",
      explanation:
        res === "COMPLETE"
          ? "Transportation is confirmed via a completed requirement."
          : res === "BLOCKED"
            ? "A transportation requirement is blocked."
            : "Transportation is required but not yet confirmed by a requirement.",
    });
  }

  // 9. Equipment (conditional).
  const equipmentNeeded = active.some((s) => (s.equipmentNeeds && s.equipmentNeeds.trim() !== "") || s.category === "DURABLE_MEDICAL_EQUIPMENT");
  if (!equipmentNeeded) {
    components.push({
      code: "equipment",
      label: "Equipment",
      status: "NOT_APPLICABLE",
      required: false,
      link: "requirements",
      explanation: "No service request requires equipment.",
    });
  } else {
    const res = categoryResolution(input, "EQUIPMENT");
    components.push({
      code: "equipment",
      label: "Equipment",
      status: res,
      required: false,
      link: "requirements",
      explanation:
        res === "COMPLETE"
          ? "Equipment needs are confirmed via a completed requirement."
          : res === "BLOCKED"
            ? "An equipment requirement is blocked."
            : "Equipment is required but not yet confirmed by a requirement.",
    });
  }

  // 10. Manual case block.
  components.push({
    code: "not_blocked",
    label: "No manual block",
    status: input.blocked ? "BLOCKED" : "COMPLETE",
    required: true,
    link: "overview",
    explanation: input.blocked ? "This case is manually blocked and cannot be considered ready." : "The case is not manually blocked.",
  });

  return components;
}

// ---- Gates ----

function buildGates(input: ReadinessInput, components: ReadinessComponent[]): ReadinessGate[] {
  const byCode = new Map(components.map((c) => [c.code, c]));
  const active = activeServiceRequests(input);
  const status = (code: string): ComponentStatus => byCode.get(code)?.status ?? "INCOMPLETE";

  return [
    {
      code: "case_active",
      label: "Case is active",
      passed: !INACTIVE_STATUSES.includes(input.status),
      explanation: "The case must not be cancelled, declined, or completed.",
    },
    {
      code: "not_manually_blocked",
      label: "Not manually blocked",
      passed: !input.blocked,
      explanation: "A manual case block must be cleared before discharge.",
    },
    {
      code: "case_information_complete",
      label: "Case information complete",
      passed: status("case_information") === "COMPLETE",
      explanation: "Required patient, discharge, destination, and contact information must be present.",
    },
    {
      code: "assigned_professional",
      label: "Discharge professional assigned",
      passed: !!input.assignedProfessionalId,
      explanation: "A discharge professional must own the case.",
    },
    {
      code: "service_requests_complete",
      label: "Service requests complete",
      passed: status("service_requests") === "COMPLETE",
      explanation: "At least one active service request must capture the minimum coordination detail.",
    },
    {
      code: "no_blocked_requirement",
      label: "No blocked requirement",
      passed: !blockedRequirement(input),
      explanation: "No required requirement may be in a blocked state.",
    },
    {
      code: "requirements_resolved",
      label: "Required requirements resolved",
      passed: unresolvedRequirements(input).length === 0,
      explanation: "Every required requirement must be complete or explicitly not required.",
    },
    {
      code: "provider_placement",
      label: "Provider placement secured",
      passed: active.length > 0 && active.every(isPlaced),
      explanation: "Every active service request must have an accepted, non-cancelled placement.",
    },
    {
      code: "service_scheduling",
      label: "Service start scheduled",
      passed: status("service_scheduling") !== "INCOMPLETE",
      explanation: "Every accepted placement must have a scheduled service start.",
    },
    {
      code: "valid_discharge_dates",
      label: "Discharge dates consistent",
      passed: datesValid(input),
      explanation: "Discharge dates must be internally consistent.",
    },
  ];
}

// ---- Blockers ----

function buildBlockers(input: ReadinessInput, gates: ReadinessGate[], components: ReadinessComponent[]): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  const byCode = new Map(components.map((c) => [c.code, c]));
  const failed = (code: string) => !gates.find((g) => g.code === code)?.passed;

  if (failed("not_manually_blocked")) {
    blockers.push({ code: "CASE_MANUALLY_BLOCKED", severity: "CRITICAL", label: "Case is manually blocked", explanation: "Clear the manual block to proceed.", link: "overview" });
  }
  if (failed("case_information_complete")) {
    const info = byCode.get("case_information");
    blockers.push({ code: "CASE_INFORMATION_INCOMPLETE", severity: "CRITICAL", label: "Case information incomplete", explanation: info?.explanation ?? "Required case information is missing.", link: "assessment" });
  }
  if (failed("assigned_professional")) {
    blockers.push({ code: "NO_ASSIGNED_DISCHARGE_PROFESSIONAL", severity: "CRITICAL", label: "No discharge professional assigned", explanation: "Assign a discharge professional.", link: "overview" });
  }
  if (failed("service_requests_complete")) {
    const sr = byCode.get("service_requests");
    blockers.push({ code: "SERVICE_REQUEST_INCOMPLETE", severity: "CRITICAL", label: "Service request incomplete", explanation: sr?.explanation ?? "A service request needs more detail.", link: "service-requests", entityType: sr?.entityType, entityId: sr?.entityId });
  }
  if (failed("no_blocked_requirement")) {
    const req = blockedRequirement(input);
    blockers.push({ code: "REQUIRED_REQUIREMENT_BLOCKED", severity: "CRITICAL", label: "Required requirement blocked", explanation: `${req?.label || "A required requirement"} is blocked.`, link: "requirements", entityType: "CaseRequirement", entityId: req?.id });
  }
  if (failed("requirements_resolved") && !failed("no_blocked_requirement")) {
    blockers.push({ code: "REQUIRED_REQUIREMENT_INCOMPLETE", severity: "CRITICAL", label: "Required requirement incomplete", explanation: "One or more required requirements are still open.", link: "requirements" });
  }
  // Provider placement: unsuccessful is distinct from simply missing.
  const placement = byCode.get("provider_placement");
  if (placement?.status === "BLOCKED") {
    blockers.push({ code: "SERVICE_START_UNSUCCESSFUL", severity: "CRITICAL", label: "Service start unsuccessful", explanation: placement.explanation, link: "referrals", entityType: placement.entityType, entityId: placement.entityId });
  } else if (failed("provider_placement")) {
    blockers.push({ code: "NO_ACCEPTED_PROVIDER_PLACEMENT", severity: "CRITICAL", label: "Provider placement missing", explanation: placement?.explanation ?? "A required service request has no accepted placement.", link: "referrals" });
  }
  if (failed("service_scheduling")) {
    blockers.push({ code: "SERVICE_START_NOT_SCHEDULED", severity: "CRITICAL", label: "Service start not scheduled", explanation: byCode.get("service_scheduling")?.explanation ?? "An accepted placement is unscheduled.", link: "referrals" });
  }
  if (failed("valid_discharge_dates")) {
    blockers.push({ code: "INVALID_DISCHARGE_DATES", severity: "CRITICAL", label: "Inconsistent discharge dates", explanation: "The recorded discharge dates are inconsistent.", link: "assessment" });
  }

  // Soft, non-gate warnings.
  if (byCode.get("transportation")?.status === "INCOMPLETE" || byCode.get("transportation")?.status === "BLOCKED") {
    blockers.push({ code: "TRANSPORTATION_UNRESOLVED", severity: "WARNING", label: "Transportation unresolved", explanation: byCode.get("transportation")!.explanation, link: "requirements" });
  }
  if (byCode.get("equipment")?.status === "INCOMPLETE" || byCode.get("equipment")?.status === "BLOCKED") {
    blockers.push({ code: "EQUIPMENT_UNRESOLVED", severity: "WARNING", label: "Equipment unresolved", explanation: byCode.get("equipment")!.explanation, link: "requirements" });
  }
  if (byCode.get("funding_information")?.status === "INCOMPLETE") {
    blockers.push({ code: "FUNDING_INFORMATION_MISSING", severity: "INFO", label: "Funding information missing", explanation: byCode.get("funding_information")!.explanation, link: "service-requests" });
  }

  return blockers;
}

function computePercentage(components: ReadinessComponent[]): number {
  const applicable = components.filter((c) => c.status !== "NOT_APPLICABLE");
  if (applicable.length === 0) return 0;
  const complete = applicable.filter((c) => c.status === "COMPLETE").length;
  return Math.round((complete / applicable.length) * 100);
}

function serviceStartSummary(input: ReadinessInput): ServiceStartSummary {
  const active = activeServiceRequests(input);
  const requiredPlacements = active.filter((s) => isPlaced(s) || isUnsuccessful(s)).length;
  const startedPlacements = active.filter(isStarted).length;
  const unsuccessfulPlacements = active.filter(isUnsuccessful).length;
  return {
    requiredPlacements,
    startedPlacements,
    unsuccessfulPlacements,
    allStarted: requiredPlacements > 0 && startedPlacements === active.filter(isPlaced).length && startedPlacements > 0,
  };
}

/** Main entry point. Pure — pass `now` in tests for determinism where needed. */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const components = buildComponents(input);
  const gates = buildGates(input, components);
  const blockers = buildBlockers(input, gates, components);
  const percentage = computePercentage(components);

  const ready = gates.every((g) => g.passed);
  const hardBlock =
    input.blocked ||
    !!blockedRequirement(input) ||
    activeServiceRequests(input).some(isUnsuccessful) ||
    !datesValid(input);
  const level: ReadinessLevel = hardBlock ? "BLOCKED" : ready ? "READY" : "NEEDS_ATTENTION";
  const phase: ReadinessPhase = POST_DISCHARGE_STATUSES.includes(input.status) ? "POST_DISCHARGE" : "PRE_DISCHARGE";

  return {
    percentage,
    ready,
    level,
    phase,
    components,
    gates,
    blockers,
    statusMismatch: input.status === "READY_FOR_DISCHARGE" && !ready,
    serviceStart: serviceStartSummary(input),
  };
}

// ---- Lifecycle eligibility helpers (shared by the readiness service) ----

/** Statuses from which a case may be manually marked READY_FOR_DISCHARGE. */
export const READY_FROM_STATUSES: CaseStatus[] = [
  "READY_FOR_REVIEW",
  "MATCHING",
  "REFERRAL_SENT",
  "PROVIDER_REVIEWING",
  "ADDITIONAL_INFORMATION_REQUIRED",
  "ACCEPTED",
  "SERVICES_BEING_COORDINATED",
];

/** True once the patient is discharged and every required placement has started. */
export function allRequiredPlacementsStarted(input: ReadinessInput): boolean {
  const active = activeServiceRequests(input);
  const placed = active.filter(isPlaced);
  if (placed.length === 0) return false;
  return placed.every(isStarted);
}

/** Deterministic completion eligibility from currently-available facts. */
export function completionEligibility(input: ReadinessInput): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.status !== "DISCHARGED" && input.status !== "SERVICE_STARTED" && input.status !== "FOLLOW_UP_REQUIRED") {
    reasons.push("The case must be discharged before it can be completed.");
  }
  if (input.blocked) reasons.push("The case is manually blocked.");
  if (blockedRequirement(input)) reasons.push("A required requirement is blocked.");
  if (unresolvedRequirements(input).length > 0) reasons.push("Required requirements are still open.");
  if (activeServiceRequests(input).some(isUnsuccessful)) reasons.push("A required service start was unsuccessful.");
  if (!allRequiredPlacementsStarted(input)) reasons.push("Not all required services have started successfully.");
  return { eligible: reasons.length === 0, reasons };
}
