import { canTransitionPlacement, canTransitionReferral, isReferralTerminal } from "./referral-transition";

describe("referral transitions", () => {
  it("allows a draft to be sent but not accepted directly", () => {
    expect(canTransitionReferral("DRAFT", "SENT")).toBe(true);
    expect(canTransitionReferral("DRAFT", "ACCEPTED")).toBe(false);
  });

  it("allows provider responses only from sent/viewed states", () => {
    expect(canTransitionReferral("SENT", "ACCEPTED")).toBe(true);
    expect(canTransitionReferral("VIEWED", "DECLINED")).toBe(true);
    expect(canTransitionReferral("DECLINED", "ACCEPTED")).toBe(false);
  });

  it("treats accepted/declined/withdrawn/cancelled as terminal for responses", () => {
    expect(isReferralTerminal("ACCEPTED")).toBe(true);
    expect(isReferralTerminal("DECLINED")).toBe(true);
    expect(isReferralTerminal("WITHDRAWN")).toBe(true);
    expect(isReferralTerminal("SENT")).toBe(false);
  });

  it("permits scheduling and starting a placement in order", () => {
    expect(canTransitionPlacement("ACCEPTED", "SCHEDULED")).toBe(true);
    expect(canTransitionPlacement("SCHEDULED", "STARTED")).toBe(true);
    expect(canTransitionPlacement("STARTED", "SCHEDULED")).toBe(false);
    expect(canTransitionPlacement("SCHEDULED", "UNSUCCESSFUL")).toBe(true);
  });
});
