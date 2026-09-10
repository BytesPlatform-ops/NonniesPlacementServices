import { describe, expect, it } from "vitest";
import {
  appointmentTone,
  arrangementTone,
  availabilityTone,
  documentTone,
  requirementTone,
} from "./seeker-tones";

describe("seeker status tones", () => {
  it("reads a good outcome as positive", () => {
    expect(availabilityTone("PROVIDER_ACCEPTED")).toBe("positive");
    expect(availabilityTone("PLACEMENT_CONFIRMED")).toBe("positive");
    expect(availabilityTone("SERVICE_STARTED")).toBe("positive");
    expect(arrangementTone("CONFIRMED")).toBe("positive");
    expect(documentTone("ACCEPTED")).toBe("positive");
    expect(appointmentTone("CONFIRMED")).toBe("positive");
    expect(requirementTone("COMPLETE")).toBe("positive");
  });

  it("reads an unmet need as something needing attention", () => {
    expect(arrangementTone("NOT_ARRANGED")).toBe("warning");
    expect(documentTone("NEEDS_UPDATE")).toBe("negative");
    expect(requirementTone("PENDING")).toBe("warning");
    expect(requirementTone("BLOCKED")).toBe("negative");
    expect(availabilityTone("NO_AVAILABILITY")).toBe("negative");
  });

  it("falls back to neutral rather than guessing", () => {
    // A wrong colour on a placement status is worse than a plain one.
    for (const fn of [availabilityTone, arrangementTone, requirementTone, documentTone, appointmentTone]) {
      expect(fn("SOMETHING_NEW_FROM_THE_BACKEND")).toBe("neutral");
      expect(fn("")).toBe("neutral");
    }
  });
});
