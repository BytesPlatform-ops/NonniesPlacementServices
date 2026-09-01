import type { StatusTone } from "@/lib/case-status";
import type { ConsentStatus, ImportRowStatus } from "@/types/communications";

/** Channel consent/suppression → readable label + non-color-only tone. */
export function channelConsent(hasChannel: boolean, consent: ConsentStatus, suppressed: boolean): { label: string; tone: StatusTone } {
  if (!hasChannel) return { label: "None", tone: "neutral" };
  if (suppressed) return { label: "Suppressed", tone: "negative" };
  switch (consent) {
    case "OPTED_IN":
      return { label: "Opted in", tone: "positive" };
    case "OPTED_OUT":
      return { label: "Opted out", tone: "warning" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}

export function contactStatusTone(status: string): StatusTone {
  return status === "ARCHIVED" ? "neutral" : "positive";
}

export function importStatusTone(status: ImportRowStatus): StatusTone {
  switch (status) {
    case "NEW":
      return "positive";
    case "DUPLICATE":
      return "neutral";
    case "INVALID":
      return "negative";
    case "CONFLICT":
      return "warning";
    case "SUPPRESSED":
      return "warning";
    default:
      return "neutral";
  }
}

export const IMPORT_STATUS_LABEL: Record<ImportRowStatus, string> = {
  NEW: "New",
  DUPLICATE: "Duplicate",
  INVALID: "Invalid",
  CONFLICT: "Conflict",
  SUPPRESSED: "Suppressed",
};

export function contactName(c: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null }): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.email || c.phone || "Unnamed contact";
}
