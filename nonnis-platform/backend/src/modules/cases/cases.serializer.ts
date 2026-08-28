import { Prisma } from "@prisma/client";
import type {
  CareSetting,
  CaseStatus,
  LevelOfCare,
  RequirementCategory,
  RequirementStatus,
  ServiceCategoryCode,
  ServiceRequestStatus,
  WorkflowEventSource,
  WorkflowEventType,
} from "@prisma/client";
import {
  attentionSummary,
  computeAttention,
  computeCompleteness,
  type AssessmentInput,
  type AttentionSummary,
  type Completeness,
} from "./case-assessment";

// ---- Prisma include shapes (single source of truth for queries + types) ----

const professionalSelect = { select: { id: true, firstName: true, lastName: true, displayName: true } };

export const caseSummaryInclude = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  originatingFacility: { select: { id: true, name: true } },
  assignedDischargeProfessional: professionalSelect,
  requirements: { select: { id: true, status: true, mandatory: true, label: true } },
  serviceRequests: { select: { id: true, levelOfCare: true, requestedStartDate: true } },
  _count: { select: { requirements: true, serviceRequests: true } },
} satisfies Prisma.CaseInclude;

export const caseDetailInclude = {
  patient: true,
  originatingFacility: true,
  organization: { select: { id: true, name: true, type: true } },
  assignedDischargeProfessional: professionalSelect,
  serviceRequests: { orderBy: { createdAt: "asc" } },
  requirements: { orderBy: { createdAt: "asc" }, include: { completedBy: professionalSelect } },
  workflowEvents: { orderBy: { createdAt: "desc" }, take: 50, include: { actorUser: professionalSelect } },
  _count: { select: { requirements: true, serviceRequests: true } },
} satisfies Prisma.CaseInclude;

export type CaseSummaryRow = Prisma.CaseGetPayload<{ include: typeof caseSummaryInclude }>;
export type CaseDetailRow = Prisma.CaseGetPayload<{ include: typeof caseDetailInclude }>;

// ---- API response shapes ----

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
  attention: { level: AttentionSummary["level"]; count: number };
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestView {
  id: string;
  status: ServiceRequestStatus;
  category: ServiceCategoryCode;
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
  editable: boolean;
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
  assessment: { completeness: Completeness; attention: AttentionSummary };
  allowedTransitions: CaseStatus[];
  createdAt: string;
  updatedAt: string;
}

// ---- Helpers ----

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const displayName = (p: { firstName: string | null; lastName: string | null; displayName?: string | null }): string =>
  p.displayName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

interface AssessmentSource {
  status: CaseStatus;
  assignedDischargeProfessionalId: string | null;
  expectedDischargeDate: Date | null;
  actualDischargeDate: Date | null;
  currentCareSetting: CareSetting | null;
  preferredServiceLocation: string | null;
  blocked: boolean;
  patientContactPhone: string | null;
  representativeContact: string | null;
  createdAt: Date;
  requirements: Array<{ id: string; status: RequirementStatus; mandatory: boolean }>;
  serviceRequests: Array<{ id: string; levelOfCare: LevelOfCare | null; requestedStartDate: Date | null }>;
}

export function toAssessmentInput(row: AssessmentSource): AssessmentInput {
  return {
    status: row.status,
    assignedProfessionalId: row.assignedDischargeProfessionalId,
    expectedDischargeDate: row.expectedDischargeDate,
    actualDischargeDate: row.actualDischargeDate,
    currentCareSetting: row.currentCareSetting,
    preferredServiceLocation: row.preferredServiceLocation,
    blocked: row.blocked,
    patientContactPhone: row.patientContactPhone,
    representativeContact: row.representativeContact,
    createdAt: row.createdAt,
    requirements: row.requirements.map((r) => ({ id: r.id, status: r.status, mandatory: r.mandatory, label: "" })),
    serviceRequests: row.serviceRequests.map((s) => ({
      id: s.id,
      levelOfCare: s.levelOfCare,
      requestedStartDate: s.requestedStartDate,
    })),
  };
}

// ---- Mappers ----

export function toCaseSummary(row: CaseSummaryRow, now: Date = new Date()): CaseSummary {
  const input = toAssessmentInput(row);
  const completeness = computeCompleteness(input);
  const attention = attentionSummary(computeAttention(input, now));
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    status: row.status,
    patient: { id: row.patient.id, displayName: displayName(row.patient) },
    originatingFacility: { id: row.originatingFacility.id, name: row.originatingFacility.name },
    assignedProfessional: row.assignedDischargeProfessional
      ? { id: row.assignedDischargeProfessional.id, displayName: displayName(row.assignedDischargeProfessional) }
      : null,
    expectedDischargeDate: iso(row.expectedDischargeDate),
    requirementsCount: row._count.requirements,
    serviceRequestsCount: row._count.serviceRequests,
    openBlockers: completeness.blockers.length,
    completenessPercentage: completeness.percentage,
    attention: { level: attention.level, count: attention.count },
    lastActivityAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toServiceRequestView(s: CaseDetailRow["serviceRequests"][number]): ServiceRequestView {
  return {
    id: s.id,
    status: s.status,
    category: s.category,
    levelOfCare: s.levelOfCare,
    requestedStartDate: iso(s.requestedStartDate),
    frequency: s.frequency,
    durationText: s.durationText,
    serviceCity: s.serviceCity,
    serviceState: s.serviceState,
    servicePostalCode: s.servicePostalCode,
    serviceRadiusMiles: s.serviceRadiusMiles,
    fundingSource: s.fundingSource,
    insurancePlan: s.insurancePlan,
    authorizationReference: s.authorizationReference,
    requiredQualifications: s.requiredQualifications,
    mandatoryLanguage: s.mandatoryLanguage,
    equipmentNeeds: s.equipmentNeeds,
    transportationRequired: s.transportationRequired,
    notes: s.notes,
  };
}

export function toRequirementView(r: CaseDetailRow["requirements"][number]): CaseRequirementView {
  return {
    id: r.id,
    category: r.category,
    status: r.status,
    label: r.label,
    detail: r.detail,
    mandatory: r.mandatory,
    dueDate: iso(r.dueDate),
    notes: r.notes,
    completedAt: iso(r.completedAt),
    completedBy: r.completedBy ? { id: r.completedBy.id, displayName: displayName(r.completedBy) } : null,
    serviceRequestId: r.serviceRequestId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toCaseDetail(row: CaseDetailRow, allowedTransitions: CaseStatus[], now: Date = new Date()): CaseDetail {
  const input = toAssessmentInput(row);
  const completeness = computeCompleteness(input);
  const attention = attentionSummary(computeAttention(input, now));

  return {
    id: row.id,
    caseNumber: row.caseNumber,
    externalCaseId: row.externalCaseId,
    status: row.status,
    editable: row.status !== "COMPLETED" && row.status !== "CANCELLED",
    organization: { id: row.organization.id, name: row.organization.name, type: row.organization.type },
    patient: {
      id: row.patient.id,
      firstName: row.patient.firstName,
      lastName: row.patient.lastName,
      displayName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
      dateOfBirth: iso(row.patient.dateOfBirth),
      externalRef: row.patient.externalRef,
    },
    originatingFacility: {
      id: row.originatingFacility.id,
      name: row.originatingFacility.name,
      city: row.originatingFacility.city,
      state: row.originatingFacility.state,
    },
    assignedDischargeProfessional: row.assignedDischargeProfessional
      ? { id: row.assignedDischargeProfessional.id, displayName: displayName(row.assignedDischargeProfessional) }
      : null,
    expectedDischargeDate: iso(row.expectedDischargeDate),
    actualDischargeDate: iso(row.actualDischargeDate),
    currentCareSetting: row.currentCareSetting,
    preferredServiceLocation: row.preferredServiceLocation,
    primaryLanguage: row.primaryLanguage,
    interpreterRequired: row.interpreterRequired,
    communicationPreference: row.communicationPreference,
    accessibilityNeeds: row.accessibilityNeeds,
    patientContactPhone: row.patientContactPhone,
    representativeName: row.representativeName,
    representativeRelationship: row.representativeRelationship,
    representativeContact: row.representativeContact,
    blocked: row.blocked,
    blockReason: row.blockReason,
    requirementsCount: row._count.requirements,
    serviceRequestsCount: row._count.serviceRequests,
    serviceRequests: row.serviceRequests.map(toServiceRequestView),
    requirements: row.requirements.map(toRequirementView),
    workflowEvents: row.workflowEvents.map((e) => ({
      id: e.id,
      type: e.type,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      source: e.source,
      actor: e.actorUser ? { id: e.actorUser.id, displayName: displayName(e.actorUser) } : null,
      metadata: e.metadata ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    assessment: { completeness, attention },
    allowedTransitions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
