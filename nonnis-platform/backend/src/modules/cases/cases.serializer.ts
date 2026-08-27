import { Prisma } from "@prisma/client";
import type {
  CareSetting,
  CaseStatus,
  LevelOfCare,
  RequirementCategory,
  ServiceCategory,
  ServiceRequestStatus,
  WorkflowEventSource,
  WorkflowEventType,
} from "@prisma/client";

// ---- Prisma include shapes (single source of truth for queries + types) ----

export const caseSummaryInclude = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  originatingFacility: { select: { id: true, name: true } },
  _count: { select: { requirements: true, serviceRequests: true } },
} satisfies Prisma.CaseInclude;

export const caseDetailInclude = {
  patient: true,
  originatingFacility: true,
  organization: { select: { id: true, name: true, type: true } },
  serviceRequests: { orderBy: { createdAt: "asc" } },
  requirements: { orderBy: { createdAt: "asc" } },
  workflowEvents: { orderBy: { createdAt: "desc" }, take: 50 },
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
  expectedDischargeDate: string | null;
  requirementsCount: number;
  serviceRequestsCount: number;
  createdAt: string;
  updatedAt: string;
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
  notes: string | null;
}

export interface CaseRequirementView {
  id: string;
  category: RequirementCategory;
  label: string;
  detail: string | null;
  mandatory: boolean;
  serviceRequestId: string | null;
}

export interface WorkflowEventView {
  id: string;
  type: WorkflowEventType;
  previousStatus: CaseStatus | null;
  newStatus: CaseStatus | null;
  source: WorkflowEventSource;
  actorRef: string | null;
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
  originatingFacility: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
  dischargeProfessionalRef: string | null;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
  currentCareSetting: CareSetting | null;
  preferredServiceLocation: string | null;
  primaryLanguage: string | null;
  interpreterRequired: boolean;
  communicationPreference: string | null;
  accessibilityNeeds: string[];
  requirementsCount: number;
  serviceRequestsCount: number;
  serviceRequests: ServiceRequestView[];
  requirements: CaseRequirementView[];
  workflowEvents: WorkflowEventView[];
  createdAt: string;
  updatedAt: string;
}

// ---- Mappers ----

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const displayName = (p: { firstName: string; lastName: string }): string => `${p.firstName} ${p.lastName}`.trim();

export function toCaseSummary(row: CaseSummaryRow): CaseSummary {
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    status: row.status,
    patient: { id: row.patient.id, displayName: displayName(row.patient) },
    originatingFacility: { id: row.originatingFacility.id, name: row.originatingFacility.name },
    expectedDischargeDate: iso(row.expectedDischargeDate),
    requirementsCount: row._count.requirements,
    serviceRequestsCount: row._count.serviceRequests,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCaseDetail(row: CaseDetailRow): CaseDetail {
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    externalCaseId: row.externalCaseId,
    status: row.status,
    organization: { id: row.organization.id, name: row.organization.name, type: row.organization.type },
    patient: {
      id: row.patient.id,
      firstName: row.patient.firstName,
      lastName: row.patient.lastName,
      displayName: displayName(row.patient),
      dateOfBirth: iso(row.patient.dateOfBirth),
      externalRef: row.patient.externalRef,
    },
    originatingFacility: {
      id: row.originatingFacility.id,
      name: row.originatingFacility.name,
      city: row.originatingFacility.city,
      state: row.originatingFacility.state,
    },
    dischargeProfessionalRef: row.dischargeProfessionalRef,
    expectedDischargeDate: iso(row.expectedDischargeDate),
    actualDischargeDate: iso(row.actualDischargeDate),
    currentCareSetting: row.currentCareSetting,
    preferredServiceLocation: row.preferredServiceLocation,
    primaryLanguage: row.primaryLanguage,
    interpreterRequired: row.interpreterRequired,
    communicationPreference: row.communicationPreference,
    accessibilityNeeds: row.accessibilityNeeds,
    requirementsCount: row._count.requirements,
    serviceRequestsCount: row._count.serviceRequests,
    serviceRequests: row.serviceRequests.map((s) => ({
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
      notes: s.notes,
    })),
    requirements: row.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      label: r.label,
      detail: r.detail,
      mandatory: r.mandatory,
      serviceRequestId: r.serviceRequestId,
    })),
    workflowEvents: row.workflowEvents.map((e) => ({
      id: e.id,
      type: e.type,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      source: e.source,
      actorRef: e.actorRef,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
