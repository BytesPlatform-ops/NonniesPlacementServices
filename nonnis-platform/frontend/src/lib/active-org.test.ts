import { describe, expect, it } from "vitest";
import { getActiveOrg, setActiveOrg } from "./active-org";

describe("active organization holder", () => {
  it("stores and returns the active organization id", () => {
    setActiveOrg("org-123");
    expect(getActiveOrg()).toBe("org-123");
  });

  it("clears the active organization", () => {
    setActiveOrg("org-123");
    setActiveOrg(null);
    expect(getActiveOrg()).toBeNull();
  });
});
