import { describe, expect, it } from "vitest";
import {
  blockerSeverityLabel,
  blockerSeverityTone,
  componentStatusIcon,
  componentStatusLabel,
  componentStatusTone,
  criticalBlockerCount,
  formatReadinessPercentage,
  readinessLevelLabel,
  readinessLevelTone,
  readinessLinkTab,
  readinessPhaseLabel,
} from "./readiness";

describe("readiness component status", () => {
  it("labels, tones, and gives a non-colour glyph for each status", () => {
    expect(componentStatusLabel("COMPLETE")).toBe("Complete");
    expect(componentStatusLabel("NOT_APPLICABLE")).toBe("Not applicable");
    expect(componentStatusTone("BLOCKED")).toBe("negative");
    expect(componentStatusTone("COMPLETE")).toBe("positive");
    expect(componentStatusIcon("COMPLETE")).toBe("✓");
    expect(componentStatusIcon("BLOCKED")).toBe("✕");
    expect(componentStatusIcon("NOT_APPLICABLE")).toBe("–");
  });
});

describe("readiness level & severity", () => {
  it("labels and tones the level", () => {
    expect(readinessLevelLabel("READY")).toBe("Ready");
    expect(readinessLevelLabel("NEEDS_ATTENTION")).toBe("Needs attention");
    expect(readinessLevelTone("BLOCKED")).toBe("negative");
    expect(readinessLevelTone("READY")).toBe("positive");
  });

  it("labels and tones blocker severity", () => {
    expect(blockerSeverityLabel("CRITICAL")).toBe("Critical");
    expect(blockerSeverityTone("CRITICAL")).toBe("negative");
    expect(blockerSeverityTone("WARNING")).toBe("warning");
    expect(blockerSeverityTone("INFO")).toBe("info");
  });

  it("counts only critical blockers", () => {
    expect(
      criticalBlockerCount([
        { severity: "CRITICAL" },
        { severity: "WARNING" },
        { severity: "CRITICAL" },
        { severity: "INFO" },
      ]),
    ).toBe(2);
  });
});

describe("readiness formatting", () => {
  it("formats the percentage and phase", () => {
    expect(formatReadinessPercentage(87.4)).toBe("87%");
    expect(readinessPhaseLabel("PRE_DISCHARGE")).toBe("Pre-discharge");
    expect(readinessPhaseLabel("POST_DISCHARGE")).toBe("Post-discharge");
  });

  it("maps workspace link hints to tab labels", () => {
    expect(readinessLinkTab("referrals")).toBe("Referrals");
    expect(readinessLinkTab("service-requests")).toBe("Service Requests");
    expect(readinessLinkTab(undefined)).toBeNull();
    expect(readinessLinkTab("nope")).toBeNull();
  });
});
