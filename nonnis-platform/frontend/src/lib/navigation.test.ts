import { describe, expect, it } from "vitest";
import { visibleNav, visibleProviderNav, visibleSeekerNav } from "./navigation";
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

describe("invoicing sits in the portal that owns it", () => {
  const STAFF = [PERMISSIONS.INVOICES_READ];

  it("shows Nonni's own billing screens to staff who may read invoices", () => {
    const labels = visibleNav(STAFF).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toEqual(expect.arrayContaining(["Invoices", "Payment history", "Products"]));
  });

  it("files them under Administration, where the rest of Nonni's own admin lives", () => {
    const admin = visibleNav(STAFF).find((g) => g.title === "Administration");
    expect(admin?.items.map((i) => i.href)).toEqual(
      expect.arrayContaining(["/admin/invoices", "/admin/invoices/payments", "/admin/products"]),
    );
  });

  it("hides them from staff who cannot read invoices", () => {
    const labels = visibleNav([PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Invoices");
    expect(labels).not.toContain("Payment history");
  });

  it("leaves the provider portal its OWN invoices, not Nonni's", () => {
    // A provider sees the bills addressed to them. They must never be offered a
    // route into Nonni's administration, whatever permissions they hold.
    const hrefs = visibleProviderNav([PERMISSIONS.INVOICES_READ_OWN]).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/provider/invoices");
    expect(hrefs.some((h) => h.startsWith("/admin/"))).toBe(false);
  });

  it("never leaks an /admin route into a non-staff portal, for ANY permission set", () => {
    // The bug this guards: an admin entry parked in the wrong array is invisible
    // to the people who need it and one permission away from the people who
    // must not have it.
    const every = Object.values(PERMISSIONS);
    for (const nav of [visibleProviderNav(every), visibleSeekerNav(every)]) {
      const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
      expect(hrefs.filter((h) => h.startsWith("/admin/"))).toEqual([]);
    }
  });
});
