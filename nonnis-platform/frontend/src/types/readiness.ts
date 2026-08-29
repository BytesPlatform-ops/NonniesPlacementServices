import type { CaseStatus } from "./domain";

export type ComponentStatus = "COMPLETE" | "INCOMPLETE" | "BLOCKED" | "NOT_APPLICABLE";
export type ReadinessLevel = "READY" | "NEEDS_ATTENTION" | "BLOCKED";
export type ReadinessPhase = "PRE_DISCHARGE" | "POST_DISCHARGE";
export type BlockerSeverity = "INFO" | "WARNING" | "CRITICAL";
export type WorkspaceLink = "assessment" | "requirements" | "service-requests" | "referrals" | "tasks" | "overview";

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

export interface ServiceStartSummary {
  requiredPlacements: number;
  startedPlacements: number;
  unsuccessfulPlacements: number;
  allStarted: boolean;
}

export interface ReadinessView {
  caseId: string;
  status: CaseStatus;
  lastEvaluatedAt: string;
  percentage: number;
  ready: boolean;
  level: ReadinessLevel;
  phase: ReadinessPhase;
  components: ReadinessComponent[];
  gates: ReadinessGate[];
  blockers: ReadinessBlocker[];
  statusMismatch: boolean;
  serviceStart: ServiceStartSummary;
}
