import { normalizeEmail, isValidEmailFormat, toEmailValue, normalizePhoneE164, toPhoneValue, isSupportedCountry } from "./normalization";

describe("email normalization", () => {
  it("trims and lowercases for comparison", () => {
    expect(normalizeEmail("  John.Doe@Example.COM ")).toBe("john.doe@example.com");
  });
  it("validates format (not mailbox existence)", () => {
    expect(isValidEmailFormat("john@example.com")).toBe(true);
    expect(isValidEmailFormat("john@")).toBe(false);
    expect(isValidEmailFormat("test")).toBe(false);
    expect(isValidEmailFormat("abc@abc")).toBe(false);
  });
  it("toEmailValue returns display + normalized, or null when invalid", () => {
    expect(toEmailValue("  Jane@Example.com ")).toEqual({ display: "Jane@Example.com", normalized: "jane@example.com" });
    expect(toEmailValue("john@")).toBeNull();
    expect(toEmailValue("   ")).toBeNull();
    expect(toEmailValue(null)).toBeNull();
  });
});

describe("phone normalization (E.164)", () => {
  it("normalizes a US number with default country US", () => {
    expect(normalizePhoneE164("(202) 456-1111", "US")).toBe("+12024561111");
  });
  it("keeps an explicit international number", () => {
    expect(normalizePhoneE164("+44 20 7946 0958", "US")).toBe("+442079460958");
  });
  it("rejects invalid numbers", () => {
    expect(normalizePhoneE164("12345", "US")).toBeNull();
    expect(normalizePhoneE164("abc", "US")).toBeNull();
    expect(normalizePhoneE164("", "US")).toBeNull();
  });
  it("default country changes interpretation of a bare number", () => {
    // A valid-looking local number parsed under different regions.
    expect(toPhoneValue("(202) 456-1111", "US")?.e164).toBe("+12024561111");
  });
  it("recognizes supported countries", () => {
    expect(isSupportedCountry("US")).toBe(true);
    expect(isSupportedCountry("ZZ")).toBe(false);
  });
});
