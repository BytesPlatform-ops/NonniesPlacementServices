import type { StatusTone } from "@/lib/case-status";
import type { CampaignStatus, RecipientStatus } from "@/types/communications-email";

export function campaignStatusTone(status: CampaignStatus): StatusTone {
  switch (status) {
    case "COMPLETED":
      return "positive";
    case "SENDING":
    case "QUEUED":
      return "progress";
    case "PARTIALLY_FAILED":
      return "warning";
    case "CANCELLED":
      return "negative";
    default:
      return "neutral";
  }
}

export function recipientStatusTone(status: RecipientStatus): StatusTone {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "positive";
    case "PROCESSING":
    case "QUEUED":
      return "progress";
    case "BOUNCED":
    case "FAILED":
      return "negative";
    case "DELIVERY_UNKNOWN":
      return "warning";
    case "UNSUBSCRIBED":
    case "CANCELLED":
    case "EXCLUDED":
      return "neutral";
    default:
      return "neutral";
  }
}
