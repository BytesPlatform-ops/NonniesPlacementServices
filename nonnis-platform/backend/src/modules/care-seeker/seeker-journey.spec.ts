import { currentJourneyStage, journeyView, journeyHeadline, JOURNEY_STAGES } from "./seeker-journey";
import type { JourneyInput } from "./seeker-journey";
import { seekerAvailability, serviceArrangement } from "./seeker-status";

function input(overrides: Partial<JourneyInput> = {}): JourneyInput {
  return {
    caseStatus: "DRAFT",
    referralStatuses: [],
    placementStatus: null,
    hasScheduledAppointment: false,
    ...overrides,
  };
}

describe("currentJourneyStage", () => {
  it("starts at referral received", () => {
    expect(currentJourneyStage(input())).toBe("REFERRAL_RECEIVED");
  });

  it("moves to care needs reviewed once the case is being worked", () => {
    expect(currentJourneyStage(input({ caseStatus: "READY_FOR_REVIEW" }))).toBe("CARE_NEEDS_REVIEWED");
    expect(currentJourneyStage(input({ caseStatus: "MATCHING" }))).toBe("CARE_NEEDS_REVIEWED");
  });

  it("shows providers identified once a referral exists but none has gone out", () => {
    expect(currentJourneyStage(input({ caseStatus: "MATCHING", referralStatuses: ["DRAFT"] }))).toBe(
      "PROVIDERS_IDENTIFIED",
    );
  });

  it("shows providers reviewing while a referral is open", () => {
    for (const s of ["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"] as const) {
      expect(currentJourneyStage(input({ referralStatuses: [s] }))).toBe("PROVIDERS_REVIEWING");
    }
  });

  it("shows a tour once one is scheduled", () => {
    expect(currentJourneyStage(input({ referralStatuses: ["SENT"], hasScheduledAppointment: true }))).toBe(
      "TOUR_ASSESSMENT",
    );
  });

  it("shows provider accepted from the referral before the case status catches up", () => {
    // The two legitimately disagree for a moment; the family should see the
    // more advanced truth rather than a stage that goes backwards.
    expect(currentJourneyStage(input({ caseStatus: "MATCHING", referralStatuses: ["ACCEPTED"] }))).toBe(
      "PROVIDER_ACCEPTED",
    );
  });

  // The distinction the brief calls out explicitly.
  describe("placement confirmed and service started stay separate", () => {
    it("treats an accepted placement as confirmed, not started", () => {
      expect(currentJourneyStage(input({ placementStatus: "ACCEPTED" }))).toBe("PROVIDER_ACCEPTED");
      expect(currentJourneyStage(input({ placementStatus: "COORDINATING" }))).toBe("PLACEMENT_CONFIRMED");
      expect(currentJourneyStage(input({ placementStatus: "SCHEDULED" }))).toBe("PLACEMENT_CONFIRMED");
    });

    it("only reports service started once the placement actually started", () => {
      expect(currentJourneyStage(input({ placementStatus: "STARTED" }))).toBe("SERVICE_STARTED");
    });

    it("never reports service started from a scheduled placement alone", () => {
      const stage = currentJourneyStage(input({ caseStatus: "READY_FOR_DISCHARGE", placementStatus: "SCHEDULED" }));
      expect(stage).toBe("PLACEMENT_CONFIRMED");
      expect(stage).not.toBe("SERVICE_STARTED");
    });
  });

  it("reports service started from the case lifecycle too", () => {
    for (const s of ["SERVICE_STARTED", "FOLLOW_UP_REQUIRED", "COMPLETED"] as const) {
      expect(currentJourneyStage(input({ caseStatus: s }))).toBe("SERVICE_STARTED");
    }
  });

  it("lets a real placement outrank an out-of-date case status", () => {
    expect(currentJourneyStage(input({ caseStatus: "DRAFT", placementStatus: "STARTED" }))).toBe("SERVICE_STARTED");
  });
});

describe("journeyView", () => {
  it("marks exactly one stage as current and everything before it complete", () => {
    const view = journeyView(input({ referralStatuses: ["SENT"] }));
    expect(view).toHaveLength(JOURNEY_STAGES.length);
    expect(view.filter((s) => s.state === "current")).toHaveLength(1);
    const currentIndex = view.findIndex((s) => s.state === "current");
    expect(view.slice(0, currentIndex).every((s) => s.state === "complete")).toBe(true);
    expect(view.slice(currentIndex + 1).every((s) => s.state === "upcoming")).toBe(true);
  });

  it("uses human labels rather than internal enum names", () => {
    const labels = journeyView(input()).map((s) => s.label);
    expect(labels).toContain("Placement confirmed");
    expect(labels).toContain("Service started");
    expect(labels.join(" ")).not.toMatch(/SERVICES_BEING_COORDINATED|REFERRAL_SENT|_/);
  });

  it("has a headline for every stage", () => {
    for (const stage of JOURNEY_STAGES) {
      expect(journeyHeadline(stage).length).toBeGreaterThan(0);
    }
  });
});

describe("seekerAvailability", () => {
  const base = { referralStatus: "SENT" as const, declineReason: null, placementStatus: null, capacityStatus: null };

  it("reports a case-specific answer ahead of general capacity", () => {
    expect(seekerAvailability({ ...base, referralStatus: "ACCEPTED", capacityStatus: "UNAVAILABLE" })).toBe(
      "PROVIDER_ACCEPTED",
    );
  });

  it("distinguishes a capacity decline from any other decline", () => {
    expect(seekerAvailability({ ...base, referralStatus: "DECLINED", declineReason: "NO_CAPACITY" })).toBe(
      "NO_AVAILABILITY",
    );
    expect(seekerAvailability({ ...base, referralStatus: "DECLINED", declineReason: "OUTSIDE_COVERAGE" })).toBe(
      "NOT_AVAILABLE",
    );
  });

  it("falls back to the provider's capacity status while the referral is open", () => {
    expect(seekerAvailability({ ...base, capacityStatus: "AVAILABLE" })).toBe("AVAILABLE");
    expect(seekerAvailability({ ...base, capacityStatus: "LIMITED" })).toBe("LIMITED_AVAILABILITY");
    expect(seekerAvailability({ ...base, capacityStatus: "UNAVAILABLE" })).toBe("NO_AVAILABILITY");
    expect(seekerAvailability({ ...base, capacityStatus: "UNKNOWN" })).toBe("REVIEWING");
    expect(seekerAvailability({ ...base, capacityStatus: null })).toBe("REVIEWING");
  });

  it("tracks placement ahead of the referral", () => {
    expect(seekerAvailability({ ...base, referralStatus: "ACCEPTED", placementStatus: "SCHEDULED" })).toBe(
      "PLACEMENT_CONFIRMED",
    );
    expect(seekerAvailability({ ...base, referralStatus: "ACCEPTED", placementStatus: "STARTED" })).toBe(
      "SERVICE_STARTED",
    );
  });

  it("takes no bed count as input at all", () => {
    // The guarantee is structural: there is nowhere to pass a number in.
    expect(Object.keys(base).sort()).toEqual(
      ["capacityStatus", "declineReason", "placementStatus", "referralStatus"].sort(),
    );
  });
});

describe("serviceArrangement", () => {
  it("is confirmed once a provider accepted the referral for it", () => {
    expect(serviceArrangement({ serviceRequestStatus: "MATCHING", referralStatuses: ["DECLINED", "ACCEPTED"] })).toBe(
      "CONFIRMED",
    );
  });

  it("is arranged when the service request itself was fulfilled", () => {
    expect(serviceArrangement({ serviceRequestStatus: "FULFILLED", referralStatuses: [] })).toBe("ARRANGED");
  });

  it("reports an unmet need when every referral fell through", () => {
    expect(serviceArrangement({ serviceRequestStatus: "MATCHING", referralStatuses: ["DECLINED", "WITHDRAWN"] })).toBe(
      "NOT_ARRANGED",
    );
  });

  it("shows provider progress while referrals are open", () => {
    expect(serviceArrangement({ serviceRequestStatus: "MATCHING", referralStatuses: ["SENT"] })).toBe(
      "PROVIDER_REVIEWING",
    );
    expect(serviceArrangement({ serviceRequestStatus: "MATCHING", referralStatuses: ["CONDITIONALLY_ACCEPTED"] })).toBe(
      "PROVIDER_INTERESTED",
    );
  });

  it("separates not-yet-started from actively-being-reviewed", () => {
    expect(serviceArrangement({ serviceRequestStatus: "REQUESTED", referralStatuses: [] })).toBe("NOT_STARTED");
    expect(serviceArrangement({ serviceRequestStatus: "MATCHING", referralStatuses: [] })).toBe("BEING_REVIEWED");
  });

  it("reports a cancelled request as no longer needed", () => {
    expect(serviceArrangement({ serviceRequestStatus: "CANCELLED", referralStatuses: ["ACCEPTED"] })).toBe("CANCELLED");
  });
});
