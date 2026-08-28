export type ReferralStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "INFORMATION_REQUESTED"
  | "CONDITIONALLY_ACCEPTED"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN"
  | "CANCELLED";

export type PlacementStatus = "ACCEPTED" | "COORDINATING" | "SCHEDULED" | "STARTED" | "UNSUCCESSFUL" | "CANCELLED";

export type ReferralNotificationStatus = "NOT_SENT" | "SENT" | "FAILED";

export type DeclineReason =
  | "NO_CAPACITY"
  | "OUTSIDE_COVERAGE"
  | "SERVICE_NOT_OFFERED"
  | "FUNDING_NOT_ACCEPTED"
  | "CLINICAL_NEEDS_UNSUPPORTED"
  | "START_DATE_UNAVAILABLE"
  | "ELIGIBILITY_NOT_MET"
  | "OTHER";

export const DECLINE_REASONS: DeclineReason[] = [
  "NO_CAPACITY",
  "OUTSIDE_COVERAGE",
  "SERVICE_NOT_OFFERED",
  "FUNDING_NOT_ACCEPTED",
  "CLINICAL_NEEDS_UNSUPPORTED",
  "START_DATE_UNAVAILABLE",
  "ELIGIBILITY_NOT_MET",
  "OTHER",
];

export type ServiceStartFailureReason =
  | "PATIENT_UNAVAILABLE"
  | "PATIENT_DECLINED"
  | "PROVIDER_UNAVAILABLE"
  | "AUTHORIZATION_ISSUE"
  | "SCHEDULE_CHANGED"
  | "OTHER";

export const SERVICE_START_FAILURE_REASONS: ServiceStartFailureReason[] = [
  "PATIENT_UNAVAILABLE",
  "PATIENT_DECLINED",
  "PROVIDER_UNAVAILABLE",
  "AUTHORIZATION_ISSUE",
  "SCHEDULE_CHANGED",
  "OTHER",
];

export interface ReferralResponseView {
  id: string;
  type: string;
  actor: string | null;
  message: string | null;
  declineReason: DeclineReason | null;
  conditions: string | null;
  proposedStartDate: string | null;
  fundingConfirmed: boolean | null;
  capacityConfirmed: boolean | null;
  createdAt: string;
}

export interface PlacementView {
  id: string;
  status: PlacementStatus;
  acceptedAt: string | null;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  unsuccessfulAt: string | null;
  unsuccessfulReason: ServiceStartFailureReason | null;
  unsuccessfulNote: string | null;
  cancelledAt: string | null;
}

export interface ReferralServiceSummary {
  category: string;
  levelOfCare: string | null;
  requestedStartDate: string | null;
  frequency: string | null;
  durationText: string | null;
  serviceCity: string | null;
  serviceState: string | null;
  servicePostalCode: string | null;
  serviceRadiusMiles: number | null;
  fundingSource: string | null;
  insurancePlan: string | null;
  requiredQualifications: string | null;
  mandatoryLanguage: string | null;
  equipmentNeeds: string | null;
  transportationRequired: boolean;
  notes: string | null;
}

export interface StaffReferralSummary {
  id: string;
  reference: string;
  status: ReferralStatus;
  provider: { id: string; name: string; status: string };
  serviceRequestId: string;
  serviceCategory: string;
  caseId: string;
  caseNumber: string;
  facilityName: string;
  requestedStartDate: string | null;
  sentAt: string | null;
  responseDueAt: string | null;
  lastResponseAt: string | null;
  viewedAt: string | null;
  notificationStatus: ReferralNotificationStatus;
  placementStatus: PlacementStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffReferralDetail {
  id: string;
  reference: string;
  status: ReferralStatus;
  caseId: string;
  caseNumber: string;
  serviceRequestId: string;
  provider: { id: string; name: string; status: string; phone: string | null; email: string | null };
  service: ReferralServiceSummary;
  facility: { name: string; city: string | null; state: string | null };
  patientName: string;
  expectedDischargeDate: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  responseDueAt: string | null;
  lastResponseAt: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  coordinationNote: string | null;
  assignedProviderUserId: string | null;
  assignedProviderUserName: string | null;
  notificationStatus: ReferralNotificationStatus;
  notificationSentAt: string | null;
  notificationLastError: string | null;
  responses: ReferralResponseView[];
  placement: PlacementView | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderReferralSummary {
  id: string;
  reference: string;
  status: ReferralStatus;
  serviceCategory: string;
  facilityName: string;
  requestedStartDate: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  responseDueAt: string | null;
  placementStatus: PlacementStatus | null;
  actionRequired: boolean;
  createdAt: string;
}

export interface ProviderReferralDetail {
  id: string;
  reference: string;
  status: ReferralStatus;
  service: ReferralServiceSummary;
  facility: { name: string; city: string | null; state: string | null };
  patientName: string;
  expectedDischargeDate: string | null;
  currentCareSetting: string | null;
  preferredServiceLocation: string | null;
  primaryLanguage: string | null;
  interpreterRequired: boolean;
  accessibilityNeeds: string[];
  coordinationContact: {
    patientContactPhone: string | null;
    representativeName: string | null;
    representativeRelationship: string | null;
    representativeContact: string | null;
  };
  sentAt: string | null;
  viewedAt: string | null;
  responseDueAt: string | null;
  assignedProviderUserId: string | null;
  assignedProviderUserName: string | null;
  responses: ReferralResponseView[];
  placement: PlacementView | null;
  createdAt: string;
}
