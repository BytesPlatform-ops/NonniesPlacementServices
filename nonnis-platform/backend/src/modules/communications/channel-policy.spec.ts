import { evaluateChannelEligibility } from "./eligibility";
import { normalizeReviewReason } from "./email/inbox.serializer";

/**
 * Communications policy invariants that must hold across the whole module. These are
 * the rules a regression would quietly violate, so they are asserted directly.
 */
describe("channel independence", () => {
  const base = { archived: false, hasAddress: true, addressValid: true, suppressed: false } as const;

  it("bulk EMAIL requires OPTED_IN — UNKNOWN is never treated as consent", () => {
    expect(evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "OPTED_IN" }).eligible).toBe(true);
    expect(evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "UNKNOWN" }).eligible).toBe(false);
    expect(evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "OPTED_OUT" }).eligible).toBe(false);
  });

  it("bulk SMS requires OPTED_IN — UNKNOWN is never treated as consent", () => {
    expect(evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "OPTED_IN" }).eligible).toBe(true);
    expect(evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "UNKNOWN" }).eligible).toBe(false);
    expect(evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "OPTED_OUT" }).eligible).toBe(false);
  });

  it("evaluates each channel in isolation, so one channel's state cannot leak into the other", () => {
    // The policy takes the channel's OWN consent + suppression; there is no shared
    // input through which an email opt-out could disable SMS (or vice versa).
    const emailOptedOut = evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "OPTED_OUT" });
    const smsStillFine = evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "OPTED_IN" });
    expect(emailOptedOut.eligible).toBe(false);
    expect(smsStillFine.eligible).toBe(true);

    const smsStopped = evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "OPTED_OUT", suppressed: true });
    const emailStillFine = evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "OPTED_IN" });
    expect(smsStopped.eligible).toBe(false);
    expect(emailStillFine.eligible).toBe(true);
  });

  it("blocks a suppressed address and an archived contact on both channels", () => {
    for (const channel of ["EMAIL", "SMS"] as const) {
      expect(evaluateChannelEligibility({ ...base, channel, consentStatus: "OPTED_IN", suppressed: true }).reasons).toContain("SUPPRESSED");
      expect(evaluateChannelEligibility({ ...base, channel, consentStatus: "OPTED_IN", archived: true }).reasons).toContain("CONTACT_ARCHIVED");
    }
  });

  it("reports channel-appropriate address reasons", () => {
    expect(evaluateChannelEligibility({ ...base, channel: "EMAIL", consentStatus: "OPTED_IN", hasAddress: false }).reasons).toContain("NO_EMAIL");
    expect(evaluateChannelEligibility({ ...base, channel: "SMS", consentStatus: "OPTED_IN", hasAddress: false }).reasons).toContain("NO_PHONE");
  });
});

describe("review reason normalization", () => {
  it("maps every stored reason to a provider-neutral code", () => {
    expect(normalizeReviewReason("UNKNOWN_TOKEN")).toBe("UNKNOWN_THREAD");
    expect(normalizeReviewReason("NO_TOKEN")).toBe("UNKNOWN_THREAD");
    expect(normalizeReviewReason("MALFORMED_ADDRESS")).toBe("UNKNOWN_THREAD");
    expect(normalizeReviewReason("UNRESOLVED")).toBe("UNKNOWN_THREAD");
    expect(normalizeReviewReason("THREAD_SENDER_MISMATCH")).toBe("SENDER_IDENTITY_MISMATCH");
    expect(normalizeReviewReason("HEADER_SENDER_MISMATCH")).toBe("SENDER_IDENTITY_MISMATCH");
    expect(normalizeReviewReason("UNKNOWN_PHONE")).toBe("UNKNOWN_CONTACT");
    expect(normalizeReviewReason("PHONE_CONFLICT")).toBe("AMBIGUOUS_CONTACT");
    expect(normalizeReviewReason("UNKNOWN_BUSINESS_NUMBER")).toBe("UNKNOWN_BUSINESS_DESTINATION");
    expect(normalizeReviewReason("INVALID_PROVIDER_PAYLOAD")).toBe("INVALID_PROVIDER_PAYLOAD");
  });

  it("never emits a channel- or provider-specific token to the UI", () => {
    const codes = [
      "NO_TOKEN", "UNKNOWN_TOKEN", "MALFORMED_ADDRESS", "UNRESOLVED",
      "THREAD_SENDER_MISMATCH", "HEADER_SENDER_MISMATCH",
      "UNKNOWN_PHONE", "PHONE_CONFLICT", "UNKNOWN_BUSINESS_NUMBER", "INVALID_PROVIDER_PAYLOAD",
    ] as const;
    for (const code of codes) {
      expect(normalizeReviewReason(code)).not.toMatch(/PHONE|TOKEN|HEADER|BREVO|TWILIO/);
    }
  });
});
