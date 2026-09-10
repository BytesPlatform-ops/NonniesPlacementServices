import type {
  CapacityStatus,
  PlacementStatus,
  ReferralDeclineReason,
  ReferralStatus,
  ServiceRequestStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Provider availability, as it is safe to show a family
// ---------------------------------------------------------------------------

export type SeekerAvailability =
  | "REVIEWING"
  | "PROVIDER_INTERESTED"
  | "INFORMATION_REQUESTED"
  | "PROVIDER_ACCEPTED"
  | "PLACEMENT_CONFIRMED"
  | "SERVICE_STARTED"
  | "NO_AVAILABILITY"
  | "NOT_AVAILABLE"
  | "LIMITED_AVAILABILITY"
  | "AVAILABLE"
  | "WITHDRAWN"
  | "UNKNOWN";

export const AVAILABILITY_LABELS: Record<SeekerAvailability, string> = {
  REVIEWING: "Availability being reviewed",
  PROVIDER_INTERESTED: "Provider interested",
  INFORMATION_REQUESTED: "More information requested",
  PROVIDER_ACCEPTED: "Provider accepted",
  PLACEMENT_CONFIRMED: "Placement confirmed",
  SERVICE_STARTED: "Service started",
  NO_AVAILABILITY: "No availability",
  NOT_AVAILABLE: "Not available",
  LIMITED_AVAILABILITY: "Limited availability",
  AVAILABLE: "Available",
  WITHDRAWN: "No longer being considered",
  UNKNOWN: "Availability not confirmed",
};

export interface AvailabilityInput {
  referralStatus: ReferralStatus;
  declineReason: ReferralDeclineReason | null;
  placementStatus: PlacementStatus | null;
  /** The provider's own capacity STATUS. Bed counts are never passed in. */
  capacityStatus: CapacityStatus | null;
}

/**
 * A case-safe availability statement for one provider on one case.
 *
 * Deliberately a status and never a number. `ProviderCapacity.availableCount`
 * is a provider's internal operational figure: it is not verified for a
 * specific family, it changes hour to hour, and publishing it would tell one
 * family about beds another family is competing for. The status word carries
 * everything a family can act on without any of that.
 *
 * The referral is read first because it is specific to THIS case — a provider
 * who accepted this referral is available to this family whatever their general
 * capacity row says. Capacity is only consulted while the referral is still
 * open, where it is the only signal there is.
 */
export function seekerAvailability(input: AvailabilityInput): SeekerAvailability {
  const { referralStatus, declineReason, placementStatus, capacityStatus } = input;

  if (placementStatus === "STARTED") return "SERVICE_STARTED";
  if (placementStatus === "SCHEDULED" || placementStatus === "COORDINATING") return "PLACEMENT_CONFIRMED";

  switch (referralStatus) {
    case "ACCEPTED":
      return "PROVIDER_ACCEPTED";
    case "CONDITIONALLY_ACCEPTED":
      return "PROVIDER_INTERESTED";
    case "INFORMATION_REQUESTED":
      return "INFORMATION_REQUESTED";
    case "DECLINED":
      // Why a provider declined matters to a family deciding what to do next,
      // but only at this granularity: the free-text decline note is staff
      // correspondence and is never surfaced.
      return declineReason === "NO_CAPACITY" ? "NO_AVAILABILITY" : "NOT_AVAILABLE";
    case "WITHDRAWN":
    case "CANCELLED":
      return "WITHDRAWN";
    default:
      break;
  }

  // Referral still open: fall back to the provider's declared capacity status.
  switch (capacityStatus) {
    case "AVAILABLE":
      return "AVAILABLE";
    case "LIMITED":
      return "LIMITED_AVAILABILITY";
    case "UNAVAILABLE":
      return "NO_AVAILABILITY";
    default:
      return referralStatus === "DRAFT" ? "UNKNOWN" : "REVIEWING";
  }
}

// ---------------------------------------------------------------------------
// Requested service → what has actually been arranged
// ---------------------------------------------------------------------------

export type ServiceArrangement =
  | "NOT_STARTED"
  | "BEING_REVIEWED"
  | "PROVIDER_REVIEWING"
  | "PROVIDER_INTERESTED"
  | "CONFIRMED"
  | "ARRANGED"
  | "NOT_ARRANGED"
  | "CANCELLED";

export const ARRANGEMENT_LABELS: Record<ServiceArrangement, string> = {
  NOT_STARTED: "Not started yet",
  BEING_REVIEWED: "Being reviewed",
  PROVIDER_REVIEWING: "Provider reviewing",
  PROVIDER_INTERESTED: "Provider interested",
  CONFIRMED: "Confirmed",
  ARRANGED: "Arranged",
  NOT_ARRANGED: "Still needed",
  CANCELLED: "No longer needed",
};

export interface ArrangementInput {
  serviceRequestStatus: ServiceRequestStatus;
  /** Statuses of the referrals raised for THIS service request. */
  referralStatuses: ReferralStatus[];
}

/**
 * Whether a requested service has actually been arranged.
 *
 * Derived, never stored. The platform already records everything needed:
 * `ServiceRequest.status` says where the request itself is, and the referrals
 * raised for it say what providers have answered. Adding a fourth status column
 * would create a second source of truth that could drift from the referrals it
 * is supposed to summarise.
 */
export function serviceArrangement(input: ArrangementInput): ServiceArrangement {
  const { serviceRequestStatus, referralStatuses } = input;

  if (serviceRequestStatus === "CANCELLED") return "CANCELLED";
  if (serviceRequestStatus === "FULFILLED") return "ARRANGED";

  if (referralStatuses.includes("ACCEPTED")) return "CONFIRMED";
  if (referralStatuses.includes("CONDITIONALLY_ACCEPTED")) return "PROVIDER_INTERESTED";
  if (referralStatuses.some((s) => s === "SENT" || s === "VIEWED" || s === "INFORMATION_REQUESTED")) {
    return "PROVIDER_REVIEWING";
  }
  // Referrals exist but every one was declined or withdrawn: the need is real
  // and unmet, which is exactly what a family needs to see.
  if (referralStatuses.length > 0) return "NOT_ARRANGED";

  return serviceRequestStatus === "MATCHING" ? "BEING_REVIEWED" : "NOT_STARTED";
}
