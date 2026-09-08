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

describe("primary membership is chosen first", () => {
  // The backend now returns memberships ordered isPrimary DESC, then createdAt,
  // then id. This function's last resort is membershipOrgIds[0], so that
  // ordering is what makes a first sign-in land somewhere predictable instead of
  // wherever Postgres happened to return first.
  const ORDERED_BY_BACKEND = ["primary-org", "older-org", "newer-org"];

  it("falls back to the primary membership when nothing is stored", () => {
    expect(resolveActiveOrg(null, null, ORDERED_BY_BACKEND)).toBe("primary-org");
  });

  it("still prefers a valid stored choice over the primary membership", () => {
    expect(resolveActiveOrg("newer-org", null, ORDERED_BY_BACKEND)).toBe("newer-org");
  });

  it("prefers the backend's own resolution over the primary membership", () => {
    expect(resolveActiveOrg(null, "older-org", ORDERED_BY_BACKEND)).toBe("older-org");
  });

  it("ignores a stored organization the user is no longer a member of", () => {
    expect(resolveActiveOrg("removed-org", null, ORDERED_BY_BACKEND)).toBe("primary-org");
  });

  it("ignores a backend value that is not in the membership list", () => {
    expect(resolveActiveOrg(null, "removed-org", ORDERED_BY_BACKEND)).toBe("primary-org");
  });

  it("returns null when the user has no memberships", () => {
    expect(resolveActiveOrg("anything", "anything", [])).toBeNull();
  });
});
