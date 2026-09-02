import type { StatusTone } from "@/lib/case-status";
import type { MessageStatus } from "@/types/communications-inbox";

export function messageStatusTone(status: MessageStatus): StatusTone {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "positive";
    case "QUEUED":
    case "PROCESSING":
    case "ACCEPTED":
      return "progress";
    case "BOUNCED":
    case "FAILED":
    case "UNDELIVERED":
      return "negative";
    case "DELIVERY_UNKNOWN":
      return "warning";
    default:
      return "neutral";
  }
}

export function messageStatusLabel(status: MessageStatus): string {
  if (status === "DELIVERY_UNKNOWN") return "delivery uncertain";
  return status.replace(/_/g, " ").toLowerCase();
}

const REVIEW_REASON_LABEL: Record<string, string> = {
  UNKNOWN_CONTACT: "Unknown contact",
  AMBIGUOUS_CONTACT: "Matches several contacts",
  SENDER_IDENTITY_MISMATCH: "Sender identity mismatch",
  UNKNOWN_THREAD: "Could not match a conversation",
  UNKNOWN_BUSINESS_DESTINATION: "Unrecognised business destination",
  INVALID_PROVIDER_PAYLOAD: "Malformed provider payload",
};
export function reviewReasonLabel(reason: string): string {
  return REVIEW_REASON_LABEL[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

/** Short relative time for the Inbox list; falls back to a date for older items. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
