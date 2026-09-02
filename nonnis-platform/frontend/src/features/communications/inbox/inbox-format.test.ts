import { describe, expect, it } from "vitest";
import { formatBytes, messageStatusLabel, messageStatusTone, relativeTime, reviewReasonLabel } from "./inbox-format";

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
