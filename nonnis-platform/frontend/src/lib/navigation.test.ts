import { describe, expect, it } from "vitest";
import { visibleNav } from "./navigation";
import { PERMISSIONS } from "./permissions";

describe("visibleNav (role-aware navigation)", () => {
  it("shows only Cases for a discharge professional", () => {
    const groups = visibleNav([PERMISSIONS.CASES_READ, PERMISSIONS.FACILITIES_READ]);
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Cases");
    expect(labels).not.toContain("Organizations");
    expect(labels).not.toContain("Users");
  });

  it("shows Administration items for a platform admin", () => {
    const groups = visibleNav([
      PERMISSIONS.CASES_READ,
      PERMISSIONS.ORGANIZATIONS_MANAGE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.FACILITIES_READ,
    ]);
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toEqual(expect.arrayContaining(["Cases", "Organizations", "Users", "Facilities"]));
    expect(groups.some((g) => g.title === "Administration")).toBe(true);
  });

  it("hides the Administration group entirely without admin permissions", () => {
    const groups = visibleNav([PERMISSIONS.CASES_READ]);
    expect(groups.some((g) => g.title === "Administration")).toBe(false);
  });

  it("returns nothing for a user with no permissions", () => {
    expect(visibleNav([])).toEqual([]);
  });
});
