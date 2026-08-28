/**
 * Domain types mirroring the backend API contract. Enums are string-literal
 * unions so the frontend stays decoupled from the backend package while
 * remaining strictly typed.
 */

export type CaseStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "MATCHING"
  | "REFERRAL_SENT"
  | "PROVIDER_REVIEWING"
  | "ADDITIONAL_INFORMATION_REQUIRED"
  | "ACCEPTED"
  | "DECLINED"
  | "SERVICES_BEING_COORDINATED"
  | "READY_FOR_DISCHARGE"
  | "DISCHARGED"
  | "SERVICE_STARTED"
  | "FOLLOW_UP_REQUIRED"
  | "COMPLETED"
  | "CANCELLED";

export type CareSetting =
  | "HOSPITAL"
  | "REHABILITATION_CENTER"
  | "SKILLED_NURSING_FACILITY"
  | "EMERGENCY_DEPARTMENT"
  | "HOME"
  | "ASSISTED_LIVING"
  | "MEMORY_CARE"
  | "OTHER";

export type ServiceCategory =
  | "HOME_HEALTH"
  | "SKILLED_NURSING"
  | "PHYSICAL_THERAPY"
  | "OCCUPATIONAL_THERAPY"
  | "SPEECH_THERAPY"
  | "PERSONAL_CARE"
  | "HOMEMAKER"
  | "HOSPICE"
  | "PALLIATIVE_CARE"
  | "INFUSION"
  | "WOUND_CARE"
  | "BEHAVIORAL_HEALTH"
  | "DURABLE_MEDICAL_EQUIPMENT"
  | "TRANSPORTATION"
  | "OTHER";

export type LevelOfCare = "INDEPENDENT" | "SUPPORTIVE" | "INTERMEDIATE" | "SKILLED" | "COMPLEX";

export type ServiceRequestStatus = "REQUESTED" | "MATCHING" | "FULFILLED" | "CANCELLED";

export type RequirementCategory =
  | "CLINICAL"
  | "NONCLINICAL"
  | "EQUIPMENT"
  | "TRANSPORTATION"
  | "PROVIDER_QUALIFICATION"
  | "INSURANCE_FUNDING"
  | "SPECIAL_CIRCUMSTANCE"
  | "PREFERENCE";

export type WorkflowEventType =
  | "CASE_CREATED"
  | "CASE_UPDATED"
  | "STATUS_CHANGED"
  | "REQUIREMENT_ADDED"
  | "SERVICE_REQUEST_ADDED"
  | "NOTE_ADDED"
  | "CASE_CANCELLED";

export type WorkflowEventSource = "MANUAL" | "AUTOMATED" | "SYSTEM";

export interface CaseSummary {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  patient: { id: string; displayName: string };
  originatingFacility: { id: string; name: string };
  assignedProfessional: { id: string; displayName: string } | null;
  expectedDischargeDate: string | null;
  requirementsCount: number;
  serviceRequestsCount: number;
  openBlockers: number;
  completenessPercentage: number;
  attention: { level: AttentionLevel; count: number };
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export type RequirementStatus = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "NOT_REQUIRED";
export type Severity = "INFO" | "WARNING" | "CRITICAL";
export type AttentionLevel = Severity | "NONE";

export interface AttentionReason {
  code: string;
  severity: Severity;
  label: string;
  entityType?: string;
  entityId?: string;
}

export interface Completeness {
  percentage: number;
  checks: Array<{ code: string; label: string; passed: boolean; blocking: boolean }>;
  missing: string[];
  blockers: Array<{ code: string; label: string }>;
}

export interface CaseAssessment {
  completeness: Completeness;
  attention: { level: AttentionLevel; count: number; reasons: AttentionReason[] };
}

export interface ServiceRequestView {
  id: string;
  status: ServiceRequestStatus;
  category: ServiceCategory;
  levelOfCare: LevelOfCare | null;
  requestedStartDate: string | null;
  frequency: string | null;
  durationText: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  serviceRadiusMiles: number | null;
  fundingSource: string | null;
  insurancePlan: string | null;
  authorizationReference: string | null;
  requiredQualifications: string | null;
  mandatoryLanguage: string | null;
  equipmentNeeds: string | null;
  transportationRequired: boolean;
  notes: string | null;
}

export interface CaseRequirementView {
  id: string;
  category: RequirementCategory;
  status: RequirementStatus;
  label: string;
  detail: string | null;
  mandatory: boolean;
  dueDate: string | null;
  notes: string | null;
  completedAt: string | null;
  completedBy: { id: string; displayName: string } | null;
  serviceRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEventView {
  id: string;
  type: WorkflowEventType;
  previousStatus: CaseStatus | null;
  newStatus: CaseStatus | null;
  source: WorkflowEventSource;
  actor: { id: string; displayName: string } | null;
  metadata: unknown;
  createdAt: string;
}

export interface CaseDetail {
  id: string;
  caseNumber: string;
  externalCaseId: string | null;
  status: CaseStatus;
  organization: { id: string; name: string; type: string };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    dateOfBirth: string | null;
    externalRef: string | null;
  };
  originatingFacility: { id: string; name: string; city: string | null; state: string | null };
  editable: boolean;
  assignedDischargeProfessional: { id: string; displayName: string } | null;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
  currentCareSetting: CareSetting | null;
  preferredServiceLocation: string | null;
  primaryLanguage: string | null;
  interpreterRequired: boolean;
  communicationPreference: string | null;
  accessibilityNeeds: string[];
  patientContactPhone: string | null;
  representativeName: string | null;
  representativeRelationship: string | null;
  representativeContact: string | null;
  blocked: boolean;
  blockReason: string | null;
  requirementsCount: number;
  serviceRequestsCount: number;
  serviceRequests: ServiceRequestView[];
  requirements: CaseRequirementView[];
  workflowEvents: WorkflowEventView[];
  assessment: CaseAssessment;
  allowedTransitions: CaseStatus[];
  createdAt: string;
  updatedAt: string;
}
