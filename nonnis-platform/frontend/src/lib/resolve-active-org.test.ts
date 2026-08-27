import { describe, expect, it } from "vitest";
import { resolveActiveOrg } from "./resolve-active-org";

describe("resolveActiveOrg", () => {
  it("returns null when the user has no memberships", () => {
    expect(resolveActiveOrg("a", "b", [])).toBeNull();
  });

  it("prefers a valid stored organization", () => {
    expect(resolveActiveOrg("b", "a", ["a", "b"])).toBe("b");
  });

  it("ignores a stored organization the user no longer belongs to", () => {
    expect(resolveActiveOrg("z", "a", ["a", "b"])).toBe("a");
  });

  it("falls back to the first membership when nothing else is valid", () => {
    expect(resolveActiveOrg(null, "z", ["a", "b"])).toBe("a");
  });

  it("never returns an organization outside the memberships", () => {
    const result = resolveActiveOrg("z", "y", ["a"]);
    expect(["a"]).toContain(result);
  });
});
