import { describe, expect, it } from "vitest";
import {
  isReferralOverdue,
  placementStatusLabel,
  placementStatusTone,
  referralStatusLabel,
  referralStatusTone,
} from "./referral-status";
import { visibleNav } from "./navigation";
import { PERMISSIONS } from "./permissions";

describe("referral status", () => {
  it("labels and tones referral statuses", () => {
    expect(referralStatusLabel("INFORMATION_REQUESTED")).toBe("Info Requested");
    expect(referralStatusTone("ACCEPTED")).toBe("positive");
    expect(referralStatusTone("DECLINED")).toBe("negative");
    expect(referralStatusTone("CONDITIONALLY_ACCEPTED")).toBe("warning");
  });

  it("keeps placement (scheduled) distinct from service started", () => {
    expect(placementStatusLabel("SCHEDULED")).toBe("Scheduled");
    expect(placementStatusLabel("STARTED")).toBe("Service Started");
    expect(placementStatusTone("STARTED")).toBe("positive");
  });

  it("computes overdue only for awaiting referrals past due", () => {
    const past = "2020-01-01T00:00:00.000Z";
    const future = "2999-01-01T00:00:00.000Z";
    expect(isReferralOverdue(past, "SENT")).toBe(true);
    expect(isReferralOverdue(future, "SENT")).toBe(false);
    expect(isReferralOverdue(past, "ACCEPTED")).toBe(false);
    expect(isReferralOverdue(null, "SENT")).toBe(false);
  });
});

describe("operations referral navigation", () => {
  it("shows the Operations referral surface only with read_all", () => {
    const nonnis = visibleNav([PERMISSIONS.CASES_READ_ALL, PERMISSIONS.REFERRALS_READ_ALL]).flatMap((g) =>
      g.items.map((i) => i.label),
    );
    expect(nonnis).toContain("Operations");
  });
});
