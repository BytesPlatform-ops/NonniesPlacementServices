import { describe, expect, it } from "vitest";
import { isCareSeeker, landingPath, activeOrgIsProvider, activeOrgType } from "./landing";
import { visibleNav, visibleProviderNav, visibleSeekerNav } from "./navigation";
import { PERMISSIONS } from "./permissions";
import type { MeCaseAccess, MeMembership, MeResponse } from "@/types/auth";

const SEEKER_PERMISSIONS = [
  PERMISSIONS.SEEKER_CASE_READ,
  PERMISSIONS.SEEKER_DOCUMENTS_READ,
  PERMISSIONS.SEEKER_DOCUMENTS_UPLOAD,
  PERMISSIONS.SEEKER_MESSAGES_READ,
  PERMISSIONS.SEEKER_MESSAGES_SEND,
  PERMISSIONS.SEEKER_APPOINTMENTS_READ,
  PERMISSIONS.SEEKER_APPOINTMENTS_REQUEST,
];

function grant(caseId: string): MeCaseAccess {
  return {
    caseId,
    caseNumber: `CASE-${caseId}`,
    careRecipientName: "Rose Miller",
    relationship: "Daughter",
    roleCode: "CARE_SEEKER",
    roleName: "Care Seeker",
  };
}

function membership(organizationType: string, roleCode: string, permissions: string[]): MeMembership {
  return {
    organizationId: "org-1",
    organizationName: "Org",
    organizationType,
    roleCode,
    roleName: roleCode,
    isPrimary: true,
    permissions,
  };
}

function me(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    authenticated: true,
    provisioned: true,
    user: { id: "u", email: "u@x.com", firstName: null, lastName: null, displayName: null, status: "ACTIVE" },
    activeOrganizationId: null,
    memberships: [],
    organizations: [],
    caseAccess: [],
    permissions: [],
    ...overrides,
  };
}

const seeker = me({ caseAccess: [grant("case-a")], permissions: SEEKER_PERMISSIONS });

describe("isCareSeeker", () => {
  it("is true only when access is entirely case-scoped", () => {
    expect(isCareSeeker(seeker)).toBe(true);
    expect(isCareSeeker(me())).toBe(false);
    expect(isCareSeeker(null)).toBe(false);
  });

  it("is false for an organization user even if a grant somehow existed", () => {
    // Not a supported state, but the organization context must win rather than
    // dropping a staff user into the family portal.
    const both = me({
      memberships: [membership("NONNIS", "NONNIS_ADMIN", [PERMISSIONS.CASES_READ_ALL])],
      caseAccess: [grant("case-a")],
      activeOrganizationId: "org-1",
      permissions: [PERMISSIONS.CASES_READ_ALL],
    });
    expect(isCareSeeker(both)).toBe(false);
  });

  it("tolerates a payload from a backend that predates the field", () => {
    const legacy = { ...me(), caseAccess: undefined } as unknown as MeResponse;
    expect(isCareSeeker(legacy)).toBe(false);
  });
});

describe("landingPath", () => {
  it("sends a care seeker to the family portal", () => {
    expect(landingPath(seeker)).toBe("/seeker");
  });

  // Regression guards: the four existing roles must land exactly where they did.
  it("keeps provider users on the provider portal", () => {
    const providerUser = me({
      memberships: [membership("PROVIDER", "PROVIDER_ADMIN", [PERMISSIONS.PROVIDERS_READ])],
      activeOrganizationId: "org-1",
      permissions: [PERMISSIONS.PROVIDERS_READ],
    });
    expect(landingPath(providerUser)).toBe("/provider");
  });

  it("keeps Nonnis staff on operations", () => {
    const staff = me({
      memberships: [membership("NONNIS", "NONNIS_ADMIN", [PERMISSIONS.CASES_READ_ALL])],
      activeOrganizationId: "org-1",
      permissions: [PERMISSIONS.CASES_READ_ALL],
    });
    expect(landingPath(staff)).toBe("/operations");
  });

  it("keeps discharge professionals on cases", () => {
    const discharge = me({
      memberships: [membership("HOSPITAL", "DISCHARGE_PROFESSIONAL", [PERMISSIONS.CASES_READ])],
      activeOrganizationId: "org-1",
      permissions: [PERMISSIONS.CASES_READ],
    });
    expect(landingPath(discharge)).toBe("/cases");
  });

  it("still sends a user with neither a membership nor a grant to cases", () => {
    expect(landingPath(me())).toBe("/cases");
    expect(landingPath(me({ provisioned: false }))).toBe("/cases");
    expect(landingPath(null)).toBe("/cases");
  });
});

describe("activeOrg helpers with a care seeker", () => {
  it("report no organization rather than guessing one", () => {
    expect(activeOrgIsProvider(seeker, null)).toBe(false);
    expect(activeOrgType(seeker, null)).toBeNull();
  });
});

describe("navigation", () => {
  it("gives a care seeker the family portal navigation only", () => {
    const groups = visibleSeekerNav(SEEKER_PERMISSIONS);
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toEqual([
      "Dashboard",
      "My Care Plan",
      "My Matches",
      "Tours & Appointments",
      "Documents",
      "Messages",
      "Progress",
      "Account",
    ]);
    expect(groups.flatMap((g) => g.items.map((i) => i.href)).every((h) => h.startsWith("/seeker"))).toBe(true);
  });

  it("shows a care seeker nothing from the staff or provider navigation", () => {
    // Their permission set holds none of the codes those menus are gated on.
    expect(visibleNav(SEEKER_PERMISSIONS)).toEqual([]);
    expect(visibleProviderNav(SEEKER_PERMISSIONS)).toEqual([]);
  });

  it("shows staff and provider users nothing from the family navigation", () => {
    expect(visibleSeekerNav([PERMISSIONS.CASES_READ_ALL, PERMISSIONS.USERS_MANAGE])).toEqual([]);
    expect(visibleSeekerNav([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.REFERRALS_READ])).toEqual([]);
  });

  it("leaves the existing staff navigation unchanged for Nonnis admin", () => {
    const labels = visibleNav([
      PERMISSIONS.CASES_READ_ALL,
      PERMISSIONS.CASES_READ,
      PERMISSIONS.PROVIDERS_READ,
      PERMISSIONS.USERS_READ,
    ]).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Operations");
    expect(labels).toContain("Cases");
    expect(labels).toContain("Providers");
    expect(labels).toContain("Users");
    expect(labels.some((l) => l.startsWith("Seeker"))).toBe(false);
  });
});
