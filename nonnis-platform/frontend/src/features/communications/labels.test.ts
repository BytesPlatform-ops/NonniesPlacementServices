import { describe, expect, it } from "vitest";
import { channelConsent, contactName, importStatusTone, IMPORT_STATUS_LABEL, contactStatusTone } from "./labels";

describe("channelConsent", () => {
  it("shows None when the channel is absent", () => {
    expect(channelConsent(false, "UNKNOWN", false)).toEqual({ label: "None", tone: "neutral" });
  });
  it("suppression takes precedence over consent", () => {
    expect(channelConsent(true, "OPTED_IN", true)).toEqual({ label: "Suppressed", tone: "negative" });
  });
  it("maps consent states to labels + tones", () => {
    expect(channelConsent(true, "OPTED_IN", false)).toEqual({ label: "Opted in", tone: "positive" });
    expect(channelConsent(true, "UNKNOWN", false)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(channelConsent(true, "OPTED_OUT", false)).toEqual({ label: "Opted out", tone: "warning" });
  });
});

describe("import + contact helpers", () => {
  it("labels and tones import row statuses", () => {
    expect(IMPORT_STATUS_LABEL.CONFLICT).toBe("Conflict");
    expect(importStatusTone("INVALID")).toBe("negative");
    expect(importStatusTone("NEW")).toBe("positive");
  });
  it("derives a display name with fallbacks", () => {
    expect(contactName({ firstName: "Ada", lastName: "Lovelace", email: null, phone: null })).toBe("Ada Lovelace");
    expect(contactName({ firstName: null, lastName: null, email: "a@x.com", phone: null })).toBe("a@x.com");
    expect(contactName({ firstName: null, lastName: null, email: null, phone: "+15550000000" })).toBe("+15550000000");
    expect(contactName({ firstName: null, lastName: null, email: null, phone: null })).toBe("Unnamed contact");
  });
  it("tones contact status", () => {
    expect(contactStatusTone("ARCHIVED")).toBe("neutral");
    expect(contactStatusTone("ACTIVE")).toBe("positive");
  });
});
