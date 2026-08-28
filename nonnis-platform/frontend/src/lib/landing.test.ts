import { describe, expect, it } from "vitest";
import { activeOrgIsProvider, landingPath } from "./landing";
import { visibleNav, visibleProviderNav } from "./navigation";
import { PERMISSIONS } from "./permissions";
import type { MeResponse } from "@/types/auth";

function me(orgType: string, activeOrganizationId = "org-1", permissions: string[] = []): MeResponse {
  return {
    authenticated: true,
    provisioned: true,
    user: { id: "u", email: "u@x.com", firstName: null, lastName: null, displayName: null, status: "ACTIVE" },
    activeOrganizationId,
    memberships: [
      {
        organizationId: "org-1",
        organizationName: "Org",
        organizationType: orgType,
        roleCode: "PROVIDER_ADMIN",
        roleName: "Provider Administrator",
        isPrimary: true,
        permissions,
      },
    ],
    organizations: [{ id: "org-1", name: "Org", type: orgType }],
    permissions,
  };
}

describe("landing logic", () => {
  it("sends provider-org users to the portal", () => {
    expect(landingPath(me("PROVIDER"))).toBe("/provider");
    expect(activeOrgIsProvider(me("PROVIDER"), "org-1")).toBe(true);
  });

  it("keeps non-provider users on the operations console", () => {
    expect(landingPath(me("HOSPITAL"))).toBe("/cases");
    expect(activeOrgIsProvider(me("HOSPITAL"), "org-1")).toBe(false);
  });

  it("defaults unprovisioned/empty users to /cases", () => {
    expect(landingPath(null)).toBe("/cases");
  });

  it("sends Nonnis staff (cases.read_all) to the operations center", () => {
    expect(landingPath(me("NONNIS", "org-1", [PERMISSIONS.CASES_READ_ALL]))).toBe("/operations");
  });
});

describe("operations navigation", () => {
  it("shows Operations only to users with cases.read_all", () => {
    const nonnis = visibleNav([PERMISSIONS.CASES_READ_ALL, PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(nonnis).toContain("Operations");
    const discharge = visibleNav([PERMISSIONS.CASES_READ]).flatMap((g) => g.items.map((i) => i.label));
    expect(discharge).not.toContain("Operations");
  });
});

describe("provider portal navigation", () => {
  it("shows all portal items for a provider admin (with users.read)", () => {
    const groups = visibleProviderNav([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.USERS_READ]);
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Overview");
    expect(labels).toContain("Capacity");
    expect(labels).toContain("Team");
  });

  it("hides Team from provider staff (no users.read)", () => {
    const groups = visibleProviderNav([PERMISSIONS.PROVIDERS_READ]);
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Capacity");
    expect(labels).not.toContain("Team");
  });
});
