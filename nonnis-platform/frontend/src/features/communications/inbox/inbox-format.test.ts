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

  it("labels review reasons", () => {
    expect(reviewReasonLabel("THREAD_SENDER_MISMATCH")).toBe("Sender mismatch (thread)");
    expect(reviewReasonLabel("UNKNOWN_TOKEN")).toBe("Unknown reply token");
  });

  it("formats relative time and bytes", () => {
    expect(relativeTime(null)).toBe("");
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
