import { evaluateChannelEligibility } from "./eligibility";

const base = { channel: "EMAIL" as const, archived: false, hasAddress: true, addressValid: true, consentStatus: "OPTED_IN" as const, suppressed: false };

describe("evaluateChannelEligibility", () => {
  it("is eligible only when opted-in, valid, not archived, not suppressed", () => {
    expect(evaluateChannelEligibility(base)).toEqual({ eligible: true, reasons: [] });
  });
  it("UNKNOWN consent is never eligible", () => {
    const r = evaluateChannelEligibility({ ...base, consentStatus: "UNKNOWN" });
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("CONSENT_UNKNOWN");
  });
  it("opted-out, suppressed, archived and missing address all block", () => {
    expect(evaluateChannelEligibility({ ...base, consentStatus: "OPTED_OUT" }).reasons).toContain("OPTED_OUT");
    expect(evaluateChannelEligibility({ ...base, suppressed: true }).reasons).toContain("SUPPRESSED");
    expect(evaluateChannelEligibility({ ...base, archived: true }).reasons).toContain("CONTACT_ARCHIVED");
    expect(evaluateChannelEligibility({ ...base, hasAddress: false }).reasons).toContain("NO_EMAIL");
    expect(evaluateChannelEligibility({ ...base, hasAddress: true, addressValid: false }).reasons).toContain("INVALID_EMAIL");
  });
  it("uses SMS reason codes for the SMS channel", () => {
    expect(evaluateChannelEligibility({ ...base, channel: "SMS", hasAddress: false }).reasons).toContain("NO_PHONE");
  });
});
