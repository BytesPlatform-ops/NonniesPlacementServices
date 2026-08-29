import type { CaseSummary } from "./domain";

export interface DischargeDashboard {
  metrics: {
    assignedToMe: number;
    openCases: number;
    overdue: number;
    dueSoon: number;
    needingAttention: number;
    missingInfo: number;
    blockedRequirements: number;
  };
  readiness: {
    readyForDischarge: number;
    criticalBlockers: number;
    nearTermNotReady: number;
    placementMissing: number;
    readinessRegression: number;
  };
  dischargesByBucket: Array<{ bucket: string; label: string; count: number }>;
  assignedToMe: CaseSummary[];
  requiringAttention: CaseSummary[];
  overdue: CaseSummary[];
  recentlyUpdated: CaseSummary[];
  recentActivity: Array<{ id: string; type: string; caseId: string; caseNumber: string; actor: string | null; createdAt: string }>;
}
