/** Mirrors the family-portal projections served by `/api/v1/seeker/*`. */

export type JourneyStageState = "complete" | "current" | "upcoming";

export interface JourneyStageView {
  key: string;
  label: string;
  state: JourneyStageState;
}

export interface SeekerCaseSummary {
  caseId: string;
  caseNumber: string;
  careRecipientName: string;
  relationship: string | null;
}

export interface SeekerDashboard extends SeekerCaseSummary {
  statusHeadline: string;
  currentStage: string;
  journey: JourneyStageView[];
  assignedCoordinatorName: string | null;
  latestUpdate: { label: string; at: string } | null;
  nextAction: string | null;
  activeMatchCount: number;
  documentsNeededCount: number;
  newMessageCount: number;
  upcomingAppointment: {
    id: string;
    type: string;
    providerName: string | null;
    scheduledAt: string | null;
    locationText: string | null;
    status: string;
  } | null;
  selectedProvider: {
    referralId: string;
    providerName: string;
    city: string | null;
    state: string | null;
    phone: string | null;
    placementStatus: string | null;
    placementStatusLabel: string | null;
    scheduledStartAt: string | null;
    actualStartAt: string | null;
    serviceStarted: boolean;
  } | null;
  anticipatedStartDate: string | null;
}

export interface SeekerServiceItem {
  id: string;
  name: string;
  levelOfCare: string | null;
  frequency: string | null;
  requestedStartDate: string | null;
  arrangement: string;
  arrangementLabel: string;
}

export interface SeekerRequirementItem {
  id: string;
  label: string;
  detail: string | null;
  category: string;
  mandatory: boolean;
  status: string;
  statusLabel: string;
  dueDate: string | null;
}

export interface SeekerCarePlan extends SeekerCaseSummary {
  services: SeekerServiceItem[];
  requirements: SeekerRequirementItem[];
  careDetails: {
    currentCareSetting: string | null;
    preferredServiceLocation: string | null;
    primaryLanguage: string | null;
    interpreterRequired: boolean;
    communicationPreference: string | null;
    accessibilityNeeds: string[];
    expectedDischargeDate: string | null;
    preferredStartDate: string | null;
    fundingSources: string[];
    equipmentNeeds: string[];
    transportationRequired: boolean;
  };
}

export interface SeekerProviderMatch {
  referralId: string;
  providerName: string;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  summary: string | null;
  services: Array<{ name: string; levelOfCare: string | null; description: string | null }>;
  languages: string[];
  paymentTypes: string[];
  availability: string;
  availabilityLabel: string;
  servicesCovered: string[];
  servicesNotCovered: string[];
  respondedAt: string | null;
  isSelected: boolean;
}

export interface SeekerProgress {
  case: SeekerCaseSummary;
  milestones: Array<{ id: string; label: string; at: string }>;
}

export interface SeekerDocument {
  id: string;
  title: string;
  description: string | null;
  status: "REQUESTED" | "UPLOADED" | "ACCEPTED" | "NEEDS_UPDATE";
  statusLabel: string;
  visibility: string;
  requestedFromSeeker: boolean;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  hasFile: boolean;
  uploadedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface SeekerAppointment {
  id: string;
  type: string;
  typeLabel: string;
  status: "REQUESTED" | "SCHEDULED" | "CONFIRMED" | "RESCHEDULE_REQUESTED" | "COMPLETED" | "CANCELLED";
  statusLabel: string;
  providerId: string | null;
  providerName: string | null;
  referralId: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  locationText: string | null;
  instructions: string | null;
  seekerNote: string | null;
  outcomeNote: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  createdAt: string;
  isPast: boolean;
}

export interface SeekerAccount {
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  cases: SeekerCaseSummary[];
}

/** Staff-side view of who has family access to a case. */
export interface CareSeekerAccess {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  userStatus: string;
  relationship: string | null;
  status: "INVITED" | "ACTIVE" | "REVOKED";
  statusLabel: string;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
