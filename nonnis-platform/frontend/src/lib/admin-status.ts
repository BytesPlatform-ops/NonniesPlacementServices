import type { StatusTone } from "@/lib/case-status";

/** Maps organization/facility/user/membership status to a badge tone. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "positive";
    case "SUSPENDED":
      return "warning";
    case "INVITED":
      return "info";
    case "INACTIVE":
    case "DEACTIVATED":
    case "REVOKED":
      return "negative";
    default:
      return "neutral";
  }
}
