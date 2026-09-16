import { describe, expect, it } from "vitest";
import { clockTime, dayKey, dayLabel, formatBytes, messageStatusLabel, messageStatusTone, relativeTime, reviewReasonLabel } from "./inbox-format";

describe("inbox-format", () => {
  it("maps message statuses to tones", () => {
    expect(messageStatusTone("DELIVERED")).toBe("positive");
    expect(messageStatusTone("QUEUED")).toBe("progress");
    expect(messageStatusTone("FAILED")).toBe("negative");
    expect(messageStatusTone("DELIVERY_UNKNOWN")).toBe("warning");
    expect(messageStatusTone("RECEIVED")).toBe("neutral");
  });

  it("labels delivery-unknown clearly", () => {
    expect(messageStatusLabel("DELIVERY_UNKNOWN")).toBe("delivery uncertain");
    expect(messageStatusLabel("SENT")).toBe("sent");
  });

  it("labels the normalized, provider-neutral review reasons", () => {
    expect(reviewReasonLabel("SENDER_IDENTITY_MISMATCH")).toBe("Sender identity mismatch");
    expect(reviewReasonLabel("UNKNOWN_THREAD")).toBe("Could not match a conversation");
    expect(reviewReasonLabel("UNKNOWN_CONTACT")).toBe("Unknown contact");
    // Nothing provider-specific may leak into a user-facing label.
    for (const label of ["SENDER_IDENTITY_MISMATCH", "UNKNOWN_THREAD", "UNKNOWN_CONTACT", "INVALID_PROVIDER_PAYLOAD"]) {
      expect(reviewReasonLabel(label).toLowerCase()).not.toMatch(/brevo|twilio|sid|token/);
    }
  });

  it("formats relative time and bytes", () => {
    expect(relativeTime(null)).toBe("");
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("thread date grouping", () => {
  const iso = (d: Date) => d.toISOString();

  it("labels today and yesterday by name", () => {
    expect(dayLabel(iso(new Date()))).toBe("Today");
    expect(dayLabel(iso(new Date(Date.now() - 86_400_000)))).toBe("Yesterday");
  });

  it("groups two moments on the same calendar day under one key", () => {
    const morning = new Date(2026, 8, 14, 9, 30);
    const evening = new Date(2026, 8, 14, 21, 5);
    expect(dayKey(iso(morning))).toBe(dayKey(iso(evening)));
  });

  it("separates adjacent calendar days", () => {
    expect(dayKey(iso(new Date(2026, 8, 14, 23, 59)))).not.toBe(dayKey(iso(new Date(2026, 8, 15, 0, 1))));
  });

  it("returns empty for missing or unparseable input rather than throwing", () => {
    for (const bad of [null, "", "not-a-date"]) {
      expect(dayLabel(bad)).toBe("");
      expect(dayKey(bad)).toBe("");
      expect(clockTime(bad)).toBe("");
    }
  });
});
