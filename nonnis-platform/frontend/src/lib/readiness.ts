import type { StatusTone } from "@/lib/case-status";
import type { BlockerSeverity, ComponentStatus, ReadinessLevel, ReadinessPhase } from "@/types/readiness";

const COMPONENT_LABELS: Record<ComponentStatus, string> = {
  COMPLETE: "Complete",
  INCOMPLETE: "Incomplete",
  BLOCKED: "Blocked",
  NOT_APPLICABLE: "Not applicable",
};

const COMPONENT_TONES: Record<ComponentStatus, StatusTone> = {
  COMPLETE: "positive",
  INCOMPLETE: "warning",
  BLOCKED: "negative",
  NOT_APPLICABLE: "neutral",
};

/** Accessible glyph so status is never conveyed by colour alone. */
const COMPONENT_ICONS: Record<ComponentStatus, string> = {
  COMPLETE: "✓",
  INCOMPLETE: "!",
  BLOCKED: "✕",
  NOT_APPLICABLE: "–",
};

export function componentStatusLabel(status: ComponentStatus): string {
  return COMPONENT_LABELS[status] ?? status;
}

export function componentStatusTone(status: ComponentStatus): StatusTone {
  return COMPONENT_TONES[status] ?? "neutral";
}

export function componentStatusIcon(status: ComponentStatus): string {
  return COMPONENT_ICONS[status] ?? "•";
}

const LEVEL_LABELS: Record<ReadinessLevel, string> = {
  READY: "Ready",
  NEEDS_ATTENTION: "Needs attention",
  BLOCKED: "Blocked",
};

const LEVEL_TONES: Record<ReadinessLevel, StatusTone> = {
  READY: "positive",
  NEEDS_ATTENTION: "warning",
  BLOCKED: "negative",
};

export function readinessLevelLabel(level: ReadinessLevel): string {
  return LEVEL_LABELS[level] ?? level;
}

export function readinessLevelTone(level: ReadinessLevel): StatusTone {
  return LEVEL_TONES[level] ?? "neutral";
}

const SEVERITY_LABELS: Record<BlockerSeverity, string> = {
  INFO: "Info",
  WARNING: "Warning",
  CRITICAL: "Critical",
};

const SEVERITY_TONES: Record<BlockerSeverity, StatusTone> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "negative",
};

export function blockerSeverityLabel(severity: BlockerSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

export function blockerSeverityTone(severity: BlockerSeverity): StatusTone {
  return SEVERITY_TONES[severity] ?? "neutral";
}

const PHASE_LABELS: Record<ReadinessPhase, string> = {
  PRE_DISCHARGE: "Pre-discharge",
  POST_DISCHARGE: "Post-discharge",
};

export function readinessPhaseLabel(phase: ReadinessPhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function formatReadinessPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

/** Count of critical (hard-gate) blockers. */
export function criticalBlockerCount(blockers: Array<{ severity: BlockerSeverity }>): number {
  return blockers.filter((b) => b.severity === "CRITICAL").length;
}

/** Map a workspace link hint to its tab label (for in-workspace navigation). */
export function readinessLinkTab(link?: string): string | null {
  switch (link) {
    case "assessment":
      return "Assessment";
    case "requirements":
      return "Requirements";
    case "service-requests":
      return "Service Requests";
    case "referrals":
      return "Referrals";
    case "tasks":
      return "Tasks";
    case "overview":
      return "Overview";
    default:
      return null;
  }
}
