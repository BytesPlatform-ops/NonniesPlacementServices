import type { CaseSummary } from "./domain";

export interface OperationsCaseSummary extends CaseSummary {
  organization: { id: string; name: string };
  blocked: boolean;
}

export interface OperationsSummary {
  cases: {
    active: number;
    requiringAttention: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    unassigned: number;
    blocked: number;
    incomplete: number;
  };
  providers: {
    active: number;
    noCapacityReported: number;
    unavailable: number;
  };
  recentActivity: RecentActivityView[];
}

export interface RecentActivityView {
  id: string;
  type: string;
  caseId: string;
  caseNumber: string;
  organizationName: string;
  previousStatus: string | null;
  newStatus: string | null;
  actor: string | null;
  createdAt: string;
}

export interface AssigneeView {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}
