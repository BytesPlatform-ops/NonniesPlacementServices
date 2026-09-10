import { describe, expect, it } from "vitest";
import { activeOrgIsProvider, activeOrgType, landingPath } from "./landing";
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
    caseAccess: [],
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

describe("organization switching", () => {
  /** A user who belongs to a Nonnis org, a provider org and a hospital. */
  function multiOrg(activeOrganizationId: string, permissions: string[]): MeResponse {
    const membership = (id: string, type: string, roleCode: string) => ({
      organizationId: id,
      organizationName: id,
      organizationType: type,
      roleCode,
      roleName: roleCode,
      isPrimary: false,
      permissions: [],
    });
    return {
      authenticated: true,
      provisioned: true,
      user: { id: "u", email: "u@x.com", firstName: null, lastName: null, displayName: null, status: "ACTIVE" },
      activeOrganizationId,
      memberships: [
        membership("nonnis", "NONNIS", "NONNIS_ADMIN"),
        membership("prov", "PROVIDER", "PROVIDER_ADMIN"),
        membership("hosp", "HOSPITAL", "DISCHARGE_PROFESSIONAL"),
      ],
      organizations: [],
      caseAccess: [],
      // The backend returns the ACTIVE membership's permissions, not a union.
      permissions,
    };
  }

  const nonnisCtx = () => multiOrg("nonnis", [PERMISSIONS.CASES_READ_ALL, PERMISSIONS.CASES_READ]);
  const providerCtx = () => multiOrg("prov", [PERMISSIONS.PROVIDERS_READ, PERMISSIONS.REFERRALS_READ]);
  const dischargeCtx = () => multiOrg("hosp", [PERMISSIONS.CASES_READ]);

  it("Nonnis → Provider lands on the portal", () => {
    expect(landingPath(nonnisCtx())).toBe("/operations");
    expect(landingPath(providerCtx())).toBe("/provider");
  });

  it("Provider → Nonnis lands on the operations centre", () => {
    expect(landingPath(providerCtx())).toBe("/provider");
    expect(landingPath(nonnisCtx())).toBe("/operations");
  });

  it("Nonnis → Discharge Professional lands on the case list", () => {
    expect(landingPath(nonnisCtx())).toBe("/operations");
    expect(landingPath(dischargeCtx())).toBe("/cases");
  });

  it("Provider → Discharge Professional lands on the case list", () => {
    expect(landingPath(providerCtx())).toBe("/provider");
    expect(landingPath(dischargeCtx())).toBe("/cases");
  });

  it("follows the active organization, never the mere presence of a provider membership", () => {
    // A user in both a Nonnis org and a provider org must not be pinned to the
    // portal just because a provider membership exists somewhere in the list.
    expect(activeOrgIsProvider(nonnisCtx(), "nonnis")).toBe(false);
    expect(activeOrgIsProvider(providerCtx(), "prov")).toBe(true);
  });
});

describe("activeOrgType", () => {
  it("reports the active organization's type", () => {
    expect(activeOrgType(me("PROVIDER"), "org-1")).toBe("PROVIDER");
    expect(activeOrgType(me("HOSPITAL"), "org-1")).toBe("HOSPITAL");
  });

  it("falls back to the first membership when the active id does not match", () => {
    expect(activeOrgType(me("NONNIS"), "unknown-org")).toBe("NONNIS");
  });

  it("returns null when there is no usable membership", () => {
    expect(activeOrgType(null, "org-1")).toBeNull();
  });
});
