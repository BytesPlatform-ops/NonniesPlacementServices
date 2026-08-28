import type { StatusTone } from "@/lib/case-status";
import type { AttentionLevel, RequirementStatus, Severity } from "@/types/domain";

/** Badge tone for an attention level. */
export function attentionTone(level: AttentionLevel): StatusTone {
  switch (level) {
    case "CRITICAL":
      return "negative";
    case "WARNING":
      return "warning";
    case "INFO":
      return "info";
    default:
      return "positive";
  }
}

export function attentionLabel(level: AttentionLevel, count: number): string {
  if (level === "NONE") return "On track";
  const noun = count === 1 ? "issue" : "issues";
  return `${count} ${noun}`;
}

export function severityTone(severity: Severity): StatusTone {
  return severity === "CRITICAL" ? "negative" : severity === "WARNING" ? "warning" : "info";
}

/** Tone + label for a requirement status. */
export function requirementStatusTone(status: RequirementStatus): StatusTone {
  switch (status) {
    case "COMPLETE":
      return "positive";
    case "BLOCKED":
      return "negative";
    case "IN_PROGRESS":
      return "progress";
    case "NOT_REQUIRED":
      return "neutral";
    default:
      return "warning";
  }
}
