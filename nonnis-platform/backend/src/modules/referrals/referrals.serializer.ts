import { Prisma } from "@prisma/client";

// ---- Includes ----

export const referralListInclude = {
  provider: { select: { id: true, displayName: true, organizationId: true, status: true } },
  serviceRequest: { select: { id: true, category: true, levelOfCare: true, requestedStartDate: true } },
  case: {
    select: { id: true, caseNumber: true, organizationId: true, originatingFacility: { select: { name: true } } },
  },
  placement: { select: { status: true, scheduledStartAt: true, actualStartAt: true } },
} satisfies Prisma.ReferralInclude;

export type ReferralListRow = Prisma.ReferralGetPayload<{ include: typeof referralListInclude }>;

export const referralDetailInclude = {
  provider: { select: { id: true, displayName: true, organizationId: true, status: true, phone: true, email: true } },
  serviceRequest: true,
  case: {
    select: {
      id: true,
      caseNumber: true,
      organizationId: true,
      expectedDischargeDate: true,
      currentCareSetting: true,
      preferredServiceLocation: true,
      primaryLanguage: true,
      interpreterRequired: true,
      accessibilityNeeds: true,
      patientContactPhone: true,
      representativeName: true,
      representativeRelationship: true,
      representativeContact: true,
      patient: { select: { firstName: true, lastName: true } },
      originatingFacility: { select: { name: true, city: true, state: true } },
    },
  },
  responses: { orderBy: { createdAt: "asc" } },
  placement: true,
} satisfies Prisma.ReferralInclude;

export type ReferralDetailRow = Prisma.ReferralGetPayload<{ include: typeof referralDetailInclude }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// ---- Shared response / placement / service views ----

function responseView(r: ReferralDetailRow["responses"][number], names: Map<string, string | null>) {
  return {
    id: r.id,
    type: r.type,
    actor: r.actorUserId ? (names.get(r.actorUserId) ?? null) : null,
    message: r.message,
    declineReason: r.declineReason,
    conditions: r.conditions,
    proposedStartDate: iso(r.proposedStartDate),
    fundingConfirmed: r.fundingConfirmed,
    capacityConfirmed: r.capacityConfirmed,
    createdAt: r.createdAt.toISOString(),
  };
}

function placementView(p: ReferralDetailRow["placement"]) {
  if (!p) return null;
  return {
    id: p.id,
    status: p.status,
    acceptedAt: iso(p.acceptedAt),
    scheduledStartAt: iso(p.scheduledStartAt),
    actualStartAt: iso(p.actualStartAt),
    unsuccessfulAt: iso(p.unsuccessfulAt),
    unsuccessfulReason: p.unsuccessfulReason,
    unsuccessfulNote: p.unsuccessfulNote,
    cancelledAt: iso(p.cancelledAt),
  };
}

/** The standardized service summary a provider needs to evaluate the referral. */
function serviceSummary(sr: ReferralDetailRow["serviceRequest"]) {
  return {
    category: sr.category,
    levelOfCare: sr.levelOfCare,
    requestedStartDate: iso(sr.requestedStartDate),
    frequency: sr.frequency,
    durationText: sr.durationText,
    serviceCity: sr.serviceCity,
    serviceState: sr.serviceState,
    servicePostalCode: sr.servicePostalCode,
    serviceRadiusMiles: sr.serviceRadiusMiles,
    fundingSource: sr.fundingSource,
    insurancePlan: sr.insurancePlan,
    requiredQualifications: sr.requiredQualifications,
    mandatoryLanguage: sr.mandatoryLanguage,
    equipmentNeeds: sr.equipmentNeeds,
    transportationRequired: sr.transportationRequired,
    notes: sr.notes,
  };
}

function actionRequired(status: string): boolean {
  return status === "SENT" || status === "VIEWED";
}

// ---- Staff (discharge / Nonnis) views ----

export function toStaffReferralSummary(row: ReferralListRow) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    provider: { id: row.provider.id, name: row.provider.displayName, status: row.provider.status },
    serviceRequestId: row.serviceRequestId,
    serviceCategory: row.serviceRequest.category,
    caseId: row.caseId,
    caseNumber: row.case.caseNumber,
    facilityName: row.case.originatingFacility.name,
    requestedStartDate: iso(row.serviceRequest.requestedStartDate),
    sentAt: iso(row.sentAt),
    responseDueAt: iso(row.responseDueAt),
    lastResponseAt: iso(row.lastResponseAt),
    viewedAt: iso(row.viewedAt),
    notificationStatus: row.notificationStatus,
    placementStatus: row.placement?.status ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStaffReferralDetail(row: ReferralDetailRow, names: Map<string, string | null>) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    caseId: row.caseId,
    caseNumber: row.case.caseNumber,
    serviceRequestId: row.serviceRequestId,
    provider: { id: row.provider.id, name: row.provider.displayName, status: row.provider.status, phone: row.provider.phone, email: row.provider.email },
    service: serviceSummary(row.serviceRequest),
    facility: { name: row.case.originatingFacility.name, city: row.case.originatingFacility.city, state: row.case.originatingFacility.state },
    patientName: `${row.case.patient.firstName} ${row.case.patient.lastName}`.trim(),
    expectedDischargeDate: iso(row.case.expectedDischargeDate),
    sentAt: iso(row.sentAt),
    viewedAt: iso(row.viewedAt),
    responseDueAt: iso(row.responseDueAt),
    lastResponseAt: iso(row.lastResponseAt),
    withdrawnAt: iso(row.withdrawnAt),
    withdrawReason: row.withdrawReason,
    coordinationNote: row.coordinationNote,
    assignedProviderUserId: row.assignedProviderUserId,
    assignedProviderUserName: row.assignedProviderUserId ? (names.get(row.assignedProviderUserId) ?? null) : null,
    notificationStatus: row.notificationStatus,
    notificationSentAt: iso(row.notificationSentAt),
    notificationLastError: row.notificationLastError,
    responses: row.responses.map((r) => responseView(r, names)),
    placement: placementView(row.placement),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- Provider (minimum-necessary) views ----

export function toProviderReferralSummary(row: ReferralListRow) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    serviceCategory: row.serviceRequest.category,
    facilityName: row.case.originatingFacility.name,
    requestedStartDate: iso(row.serviceRequest.requestedStartDate),
    sentAt: iso(row.sentAt),
    viewedAt: iso(row.viewedAt),
    responseDueAt: iso(row.responseDueAt),
    placementStatus: row.placement?.status ?? null,
    actionRequired: actionRequired(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProviderReferralDetail(row: ReferralDetailRow, names: Map<string, string | null>) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    service: serviceSummary(row.serviceRequest),
    facility: { name: row.case.originatingFacility.name, city: row.case.originatingFacility.city, state: row.case.originatingFacility.state },
    patientName: `${row.case.patient.firstName} ${row.case.patient.lastName}`.trim(),
    expectedDischargeDate: iso(row.case.expectedDischargeDate),
    currentCareSetting: row.case.currentCareSetting,
    preferredServiceLocation: row.case.preferredServiceLocation,
    primaryLanguage: row.case.primaryLanguage,
    interpreterRequired: row.case.interpreterRequired,
    accessibilityNeeds: row.case.accessibilityNeeds,
    coordinationContact: {
      patientContactPhone: row.case.patientContactPhone,
      representativeName: row.case.representativeName,
      representativeRelationship: row.case.representativeRelationship,
      representativeContact: row.case.representativeContact,
    },
    sentAt: iso(row.sentAt),
    viewedAt: iso(row.viewedAt),
    responseDueAt: iso(row.responseDueAt),
    assignedProviderUserId: row.assignedProviderUserId,
    assignedProviderUserName: row.assignedProviderUserId ? (names.get(row.assignedProviderUserId) ?? null) : null,
    responses: row.responses.map((r) => responseView(r, names)),
    placement: placementView(row.placement),
    createdAt: row.createdAt.toISOString(),
  };
}

export type StaffReferralSummary = ReturnType<typeof toStaffReferralSummary>;
export type StaffReferralDetail = ReturnType<typeof toStaffReferralDetail>;
export type ProviderReferralSummary = ReturnType<typeof toProviderReferralSummary>;
export type ProviderReferralDetail = ReturnType<typeof toProviderReferralDetail>;
