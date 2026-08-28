import { describe, expect, it } from "vitest";
import { attentionLabel, attentionTone, requirementStatusTone, severityTone } from "./attention";

describe("attention UI logic", () => {
  it("maps attention levels to tones", () => {
    expect(attentionTone("CRITICAL")).toBe("negative");
    expect(attentionTone("WARNING")).toBe("warning");
    expect(attentionTone("INFO")).toBe("info");
    expect(attentionTone("NONE")).toBe("positive");
  });

  it("labels attention counts", () => {
    expect(attentionLabel("NONE", 0)).toBe("On track");
    expect(attentionLabel("WARNING", 1)).toBe("1 issue");
    expect(attentionLabel("CRITICAL", 3)).toBe("3 issues");
  });

  it("maps severities to tones", () => {
    expect(severityTone("CRITICAL")).toBe("negative");
    expect(severityTone("WARNING")).toBe("warning");
    expect(severityTone("INFO")).toBe("info");
  });

  it("maps requirement status to tones", () => {
    expect(requirementStatusTone("COMPLETE")).toBe("positive");
    expect(requirementStatusTone("BLOCKED")).toBe("negative");
    expect(requirementStatusTone("IN_PROGRESS")).toBe("progress");
    expect(requirementStatusTone("PENDING")).toBe("warning");
    expect(requirementStatusTone("NOT_REQUIRED")).toBe("neutral");
  });
});
