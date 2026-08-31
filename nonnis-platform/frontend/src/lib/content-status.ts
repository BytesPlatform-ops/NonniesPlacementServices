import type { StatusTone } from "@/lib/case-status";
import type { ContentStatus } from "@/types/content";

const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const STATUS_TONES: Record<ContentStatus, StatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  ARCHIVED: "warning",
};

export function blogStatusLabel(status: ContentStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function blogStatusTone(status: ContentStatus): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

/** Active/inactive presentation for videos and testimonials. */
export function activeLabel(active: boolean): string {
  return active ? "Active" : "Inactive";
}

export function activeTone(active: boolean): StatusTone {
  return active ? "positive" : "neutral";
}
