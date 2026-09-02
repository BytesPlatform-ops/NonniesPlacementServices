import type { StatusTone } from "@/lib/case-status";
import type { SmsCampaignStatus, SmsRecipientStatus } from "@/types/communications-sms";

export function smsCampaignTone(status: SmsCampaignStatus): StatusTone {
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

export function smsRecipientTone(status: SmsRecipientStatus): StatusTone {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "positive";
    case "ACCEPTED":
    case "QUEUED":
    case "PROCESSING":
      return "progress";
    case "FAILED":
    case "UNDELIVERED":
      return "negative";
    case "DELIVERY_UNKNOWN":
      return "warning";
    default:
      return "neutral";
  }
}

export function smsStatusLabel(status: SmsRecipientStatus): string {
  if (status === "DELIVERY_UNKNOWN") return "delivery uncertain";
  return status.replace(/_/g, " ").toLowerCase();
}

const EXCLUSION_LABEL: Record<string, string> = {
  NO_PHONE: "No phone number",
  INVALID_PHONE: "Invalid phone number",
  CONSENT_UNKNOWN: "SMS consent unknown",
  OPTED_OUT: "Opted out of SMS",
  SUPPRESSED: "Number suppressed",
  CONTACT_ARCHIVED: "Contact archived",
  CAMPAIGN_CANCELLED: "Campaign cancelled",
};
export function exclusionLabel(reason: string | null): string {
  if (!reason) return "—";
  return EXCLUSION_LABEL[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}
