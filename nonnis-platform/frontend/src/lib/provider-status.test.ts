import { describe, expect, it } from "vitest";
import { capacityLabel, capacityTone, providerStatusTone } from "./provider-status";

describe("provider status UI logic", () => {
  it("maps provider status to tones", () => {
    expect(providerStatusTone("ACTIVE")).toBe("positive");
    expect(providerStatusTone("PAUSED")).toBe("warning");
    expect(providerStatusTone("INACTIVE")).toBe("negative");
  });

  it("maps capacity status to tones", () => {
    expect(capacityTone("AVAILABLE")).toBe("positive");
    expect(capacityTone("LIMITED")).toBe("warning");
    expect(capacityTone("UNAVAILABLE")).toBe("negative");
    expect(capacityTone("UNKNOWN")).toBe("neutral");
  });

  it("labels capacity statuses", () => {
    expect(capacityLabel("AVAILABLE")).toBe("Available");
    expect(capacityLabel("UNKNOWN")).toBe("Unknown");
  });
});
