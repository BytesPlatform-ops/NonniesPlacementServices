import type { CaseStatus, PlacementStatus, ReferralStatus } from "@prisma/client";

/**
 * The placement journey as a family experiences it.
 *
 * Internal enums are not shown to families: `SERVICES_BEING_COORDINATED` and
 * `REFERRAL_SENT` describe the platform's work, not theirs. These stages are a
 * presentation layer over the real statuses — `CaseStatus`, `ReferralStatus`
 * and `PlacementStatus` remain the only source of truth, and nothing here is
 * persisted.
 *
 * PLACEMENT_CONFIRMED and SERVICE_STARTED are deliberately separate stages. A
 * confirmed placement means a provider accepted and a start was arranged; a
 * started service means care is actually being delivered. Collapsing the two
 * would tell a family their parent is being cared for before anyone has
 * arrived.
 */
export const JOURNEY_STAGES = [
  "REFERRAL_RECEIVED",
  "CARE_NEEDS_REVIEWED",
  "PROVIDERS_IDENTIFIED",
  "PROVIDERS_REVIEWING",
  "TOUR_ASSESSMENT",
  "PROVIDER_ACCEPTED",
  "PLACEMENT_CONFIRMED",
  "SERVICE_STARTED",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  REFERRAL_RECEIVED: "Referral received",
  CARE_NEEDS_REVIEWED: "Care needs reviewed",
  PROVIDERS_IDENTIFIED: "Providers identified",
  PROVIDERS_REVIEWING: "Providers reviewing",
  TOUR_ASSESSMENT: "Tour / assessment",
  PROVIDER_ACCEPTED: "Provider accepted",
  PLACEMENT_CONFIRMED: "Placement confirmed",
  SERVICE_STARTED: "Service started",
};

export interface JourneyInput {
  caseStatus: CaseStatus;
  referralStatuses: ReferralStatus[];
  placementStatus: PlacementStatus | null;
  /** True once any tour or assessment has been scheduled or held. */
  hasScheduledAppointment: boolean;
}

/**
 * The furthest stage the case has genuinely reached.
 *
 * Read in order of certainty, strongest evidence first: an actual placement
 * outranks a case status, and a case status outranks the referrals underneath
 * it. That ordering matters because the three can legitimately disagree for a
 * moment — a referral is accepted before the case status catches up — and the
 * family should see the more advanced truth, never a regression.
 */
export function currentJourneyStage(input: JourneyInput): JourneyStage {
  const { caseStatus, referralStatuses, placementStatus, hasScheduledAppointment } = input;

  // Strongest evidence: a real placement row.
  if (placementStatus === "STARTED") return "SERVICE_STARTED";
  if (placementStatus === "SCHEDULED" || placementStatus === "COORDINATING") return "PLACEMENT_CONFIRMED";
  if (placementStatus === "ACCEPTED") return "PROVIDER_ACCEPTED";

  // Then the case's own lifecycle.
  switch (caseStatus) {
    case "SERVICE_STARTED":
    case "FOLLOW_UP_REQUIRED":
    case "COMPLETED":
      return "SERVICE_STARTED";
    case "DISCHARGED":
    case "READY_FOR_DISCHARGE":
    case "SERVICES_BEING_COORDINATED":
      return "PLACEMENT_CONFIRMED";
    case "ACCEPTED":
      return "PROVIDER_ACCEPTED";
    default:
      break;
  }

  // Then what the referrals themselves say.
  if (referralStatuses.includes("ACCEPTED")) return "PROVIDER_ACCEPTED";
  if (hasScheduledAppointment) return "TOUR_ASSESSMENT";
  if (referralStatuses.some((s) => s === "SENT" || s === "VIEWED" || s === "INFORMATION_REQUESTED" || s === "CONDITIONALLY_ACCEPTED")) {
    return "PROVIDERS_REVIEWING";
  }
  if (referralStatuses.length > 0) return "PROVIDERS_IDENTIFIED";

  // Finally the earliest states, where no referral exists yet.
  if (caseStatus === "MATCHING" || caseStatus === "READY_FOR_REVIEW") return "CARE_NEEDS_REVIEWED";
  return "REFERRAL_RECEIVED";
}

export type StageState = "complete" | "current" | "upcoming";

export interface JourneyStageView {
  key: JourneyStage;
  label: string;
  state: StageState;
}

/** The full ordered journey, each stage marked relative to where the case is. */
export function journeyView(input: JourneyInput): JourneyStageView[] {
  const current = currentJourneyStage(input);
  const currentIndex = JOURNEY_STAGES.indexOf(current);
  return JOURNEY_STAGES.map((key, index) => ({
    key,
    label: JOURNEY_STAGE_LABELS[key],
    state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
  }));
}

/**
 * One plain sentence describing where things stand, for the dashboard headline.
 *
 * Kept separate from the stage list because a family reads this first and the
 * stage rail second.
 */
export function journeyHeadline(stage: JourneyStage): string {
  switch (stage) {
    case "REFERRAL_RECEIVED":
      return "We have received the referral and are getting started.";
    case "CARE_NEEDS_REVIEWED":
      return "Our care team has reviewed the care needs and is identifying suitable providers.";
    case "PROVIDERS_IDENTIFIED":
      return "We have identified providers and are preparing to contact them.";
    case "PROVIDERS_REVIEWING":
      return "Providers are reviewing the referral. We will update you as they respond.";
    case "TOUR_ASSESSMENT":
      return "A tour or assessment is arranged. Details are under Tours & Appointments.";
    case "PROVIDER_ACCEPTED":
      return "A provider has accepted. We are confirming the details of the placement.";
    case "PLACEMENT_CONFIRMED":
      return "The placement is confirmed. We are coordinating the start of care.";
    case "SERVICE_STARTED":
      return "Care has started.";
  }
}
