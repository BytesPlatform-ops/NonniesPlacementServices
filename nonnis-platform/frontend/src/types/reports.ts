/** Shapes mirrored from the backend reporting module. */

export interface GroupCount {
  key: string;
  label: string;
  count: number;
}

export interface ReportResponse<Row, Summary, Groups> {
  appliedFilters: Record<string, unknown>;
  generatedAt: string;
  summary: Summary;
  groups: Groups;
  items: Row[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReportFilterOptions {
  organizations: Array<{ id: string; name: string }>;
  facilities: Array<{ id: string; name: string; organizationId: string }>;
  serviceCategories: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  paymentTypes: Array<{ id: string; name: string }>;
}

// ---- Overview ----

export interface OverviewSummary {
  appliedFilters: Record<string, unknown>;
  generatedAt: string;
  cases: { total: number; active: number; completed: number; cancelled: number };
  referrals: {
    total: number;
    sent: number;
    informationRequested: number;
    conditionallyAccepted: number;
    accepted: number;
    declined: number;
  };
  providers: { total: number; active: number; paused: number; inactive: number };
  readiness: { ready: number; needsAttention: number; blocked: number };
  tasks: { open: number; inProgress: number; completed: number; overdue: number };
  submissions: { received: number; new: number; inReview: number; resolved: number; archived: number };
}

// ---- Cases ----

export interface CaseReportRow {
  id: string;
  caseNumber: string;
  patientName: string | null;
  organization: string | null;
  facility: string | null;
  assignedProfessional: string | null;
  status: string;
  statusLabel: string;
  readinessLevel: string;
  readinessPercentage: number;
  criticalBlockers: number;
  keyBlockers: string[];
  createdAt: string;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
}
export interface CaseReportSummary {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  ready: number;
  blocked: number;
}
export interface CaseReportGroups {
  byStatus: GroupCount[];
  byOrganization: GroupCount[];
  byFacility: GroupCount[];
}

// ---- Referrals ----

export interface ReferralReportRow {
  id: string;
  reference: string;
  caseId: string;
  caseNumber: string;
  organization: string | null;
  facility: string | null;
  service: string | null;
  provider: string | null;
  status: string;
  statusLabel: string;
  overdue: boolean;
  sentAt: string | null;
  responseDueAt: string | null;
  viewedAt: string | null;
  lastResponseAt: string | null;
  placementStatus: string | null;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
}
export interface ReferralReportSummary {
  total: number;
  overdue: number;
  byStatus: Record<string, number>;
}
export interface ReferralReportGroups {
  byStatus: GroupCount[];
}

// ---- Providers ----

export interface ProviderReportRow {
  id: string;
  displayName: string;
  organization: string | null;
  status: string;
  statusLabel: string;
  location: string | null;
  servicesCount: number;
  coverageCount: number;
  languagesCount: number;
  paymentTypesCount: number;
  capacity: string;
  lastCapacityUpdate: string | null;
  updatedAt: string;
}
export interface ProviderReportSummary {
  total: number;
  active: number;
  paused: number;
  inactive: number;
  available: number;
  limited: number;
  unavailable: number;
  unknownCapacity: number;
}
export interface ProviderReportGroups {
  byStatus: GroupCount[];
  byCapacity: GroupCount[];
}

// ---- Readiness ----

export interface ReadinessReportRow {
  id: string;
  caseNumber: string;
  patientName: string | null;
  organization: string | null;
  facility: string | null;
  expectedDischargeDate: string | null;
  status: string;
  statusLabel: string;
  readinessPercentage: number;
  readinessLevel: string;
  criticalBlockers: number;
  keyBlockers: string[];
}
export interface ReadinessReportSummary {
  ready: number;
  needsAttention: number;
  blocked: number;
  nearTermNotReady: number;
  placementMissing: number;
  acceptedUnscheduled: number;
  dischargedServiceNotStarted: number;
  unsuccessfulServiceStarts: number;
}

// ---- Tasks ----

export interface TaskReportRow {
  id: string;
  title: string;
  caseId: string;
  caseNumber: string;
  organization: string | null;
  assignee: string | null;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  overdue: boolean;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
}
export interface TaskReportSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  highUrgentActive: number;
}
export interface TaskReportGroups {
  byStatus: GroupCount[];
  byPriority: GroupCount[];
}

// ---- Form submissions ----

export interface FormSubmissionReportRow {
  id: string;
  reference: string;
  formKey: string;
  formName: string;
  submitterName: string | null;
  submittedAt: string;
  status: string;
  statusLabel: string;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
export interface FormSubmissionReportSummary {
  total: number;
  new: number;
  inReview: number;
  resolved: number;
  archived: number;
}
export interface FormSubmissionReportGroups {
  byForm: GroupCount[];
}
