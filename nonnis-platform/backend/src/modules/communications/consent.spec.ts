import { mayApplyConsent, parseConsentCell, resolveImportConsent } from "./consent";

describe("parseConsentCell", () => {
  it.each(["yes", "Y", "TRUE", "1", "Opted In", "opt-in", "subscribed"])("reads %p as OPTED_IN", (v) => {
    expect(parseConsentCell(v)).toBe("OPTED_IN");
  });
  it.each(["no", "N", "false", "0", "opted out", "STOP", "unsubscribed"])("reads %p as OPTED_OUT", (v) => {
    expect(parseConsentCell(v)).toBe("OPTED_OUT");
  });
  it.each(["", "  ", "maybe", "2026-01-01", undefined, null])("treats %p as no statement", (v) => {
    expect(parseConsentCell(v)).toBeNull();
  });
});

describe("resolveImportConsent", () => {
  it("lets a per-row opt-out beat a whole-file attestation", () => {
    expect(resolveImportConsent("OPTED_OUT", true)).toBe("OPTED_OUT");
  });
  it("applies the attestation to rows that say nothing", () => {
    expect(resolveImportConsent(null, true)).toBe("OPTED_IN");
    expect(resolveImportConsent(null, false)).toBeNull();
  });
});

describe("mayApplyConsent", () => {
  it("opts in only over UNKNOWN — never over an opt-out", () => {
    expect(mayApplyConsent("UNKNOWN", "OPTED_IN")).toBe(true);
    expect(mayApplyConsent(undefined, "OPTED_IN")).toBe(true);
    expect(mayApplyConsent("OPTED_OUT", "OPTED_IN")).toBe(false);
    expect(mayApplyConsent("OPTED_IN", "OPTED_IN")).toBe(false);
  });
  it("always records an opt-out", () => {
    expect(mayApplyConsent("OPTED_IN", "OPTED_OUT")).toBe(true);
    expect(mayApplyConsent("UNKNOWN", "OPTED_OUT")).toBe(true);
  });
});
