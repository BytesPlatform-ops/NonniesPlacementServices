import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { caseStatusMeta } from "@/lib/case-status";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import type { WorkflowEventView } from "@/types/domain";

function toEntry(event: WorkflowEventView): TimelineEntry {
  const statusChange = event.newStatus
    ? event.previousStatus
      ? `${caseStatusMeta(event.previousStatus).label} → ${caseStatusMeta(event.newStatus).label}`
      : caseStatusMeta(event.newStatus).label
    : null;

  const descriptionParts = [statusChange, humanizeEnum(event.source)].filter(Boolean);

  return {
    id: event.id,
    title: humanizeEnum(event.type),
    description: descriptionParts.join(" · "),
    timestamp: formatDateTime(event.createdAt),
    tone: event.newStatus ? caseStatusMeta(event.newStatus).tone : "neutral",
  };
}

export function CaseWorkflowTimeline({ events }: { events: WorkflowEventView[] }) {
  return <Timeline items={events.map(toEntry)} />;
}
