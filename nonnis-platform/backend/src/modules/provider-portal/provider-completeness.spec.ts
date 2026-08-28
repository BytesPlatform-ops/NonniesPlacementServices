import { computeProviderCompleteness, type CompletenessInput } from "./provider-completeness";

const EMPTY: CompletenessInput = {
  phone: null,
  email: null,
  city: null,
  state: null,
  activeServices: 0,
  activeCoverage: 0,
  activePaymentTypes: 0,
  activeLanguages: 0,
  hoursConfigured: 0,
  capacityConfigured: 0,
};

describe("computeProviderCompleteness", () => {
  it("flags everything missing for an empty provider", () => {
    const r = computeProviderCompleteness(EMPTY);
    expect(r.percentage).toBe(0);
    expect(r.missing).toContain("PROFILE_CONTACT_MISSING");
    expect(r.missing).toContain("NO_SERVICES");
    expect(r.missing).toContain("CAPACITY_UNKNOWN");
    expect(r.checks).toHaveLength(7);
  });

  it("requires both contact and location for the contact check", () => {
    const phoneOnly = computeProviderCompleteness({ ...EMPTY, phone: "555" });
    expect(phoneOnly.missing).toContain("PROFILE_CONTACT_MISSING");
    const complete = computeProviderCompleteness({ ...EMPTY, phone: "555", city: "Tacoma" });
    expect(complete.missing).not.toContain("PROFILE_CONTACT_MISSING");
  });

  it("computes 100% when everything is present", () => {
    const r = computeProviderCompleteness({
      phone: "555",
      email: "p@x.com",
      city: "Tacoma",
      state: "WA",
      activeServices: 2,
      activeCoverage: 1,
      activePaymentTypes: 1,
      activeLanguages: 1,
      hoursConfigured: 7,
      capacityConfigured: 1,
    });
    expect(r.percentage).toBe(100);
    expect(r.missing).toHaveLength(0);
  });
});
