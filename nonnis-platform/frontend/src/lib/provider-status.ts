import type { StatusTone } from "@/lib/case-status";
import type { CapacityStatus, ProviderStatus } from "@/types/providers";

/** Badge tone for a provider's operational status. */
export function providerStatusTone(status: ProviderStatus): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "positive";
    case "PAUSED":
      return "warning";
    case "INACTIVE":
      return "negative";
    default:
      return "neutral";
  }
}

/** Badge tone for a capacity/availability status. */
export function capacityTone(status: CapacityStatus): StatusTone {
  switch (status) {
    case "AVAILABLE":
      return "positive";
    case "LIMITED":
      return "warning";
    case "UNAVAILABLE":
      return "negative";
    case "UNKNOWN":
    default:
      return "neutral";
  }
}

const CAPACITY_LABELS: Record<CapacityStatus, string> = {
  AVAILABLE: "Available",
  LIMITED: "Limited",
  UNAVAILABLE: "Unavailable",
  UNKNOWN: "Unknown",
};

export function capacityLabel(status: CapacityStatus): string {
  return CAPACITY_LABELS[status] ?? "Unknown";
}
