import { assignableRoleCodes, isOrganizationRole, ORGANIZATION_ROLES, PERMISSIONS, ROLE_DEFINITIONS, ROLES } from "./rbac";

describe("RBAC role→permission matrix", () => {
  it("gives NONNIS_ADMIN every permission", () => {
    const all = Object.values(PERMISSIONS).sort();
    expect([...ROLE_DEFINITIONS[ROLES.NONNIS_ADMIN].permissions].sort()).toEqual(all);
  });

  it("does not grant provider roles any platform or user-management permission", () => {
    for (const code of [ROLES.PROVIDER_STAFF]) {
      const perms = ROLE_DEFINITIONS[code].permissions;
      expect(perms).not.toContain(PERMISSIONS.PLATFORM_MANAGE);
      expect(perms).not.toContain(PERMISSIONS.USERS_MANAGE);
      expect(perms).not.toContain(PERMISSIONS.CASES_READ_ALL);
    }
  });

  it("gives PROVIDER_ADMIN own-org user management but not full user management", () => {
    const perms = ROLE_DEFINITIONS[ROLES.PROVIDER_ADMIN].permissions;
    expect(perms).toContain(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION);
    expect(perms).not.toContain(PERMISSIONS.USERS_MANAGE);
  });
});

describe("assignableRoleCodes (role escalation protection)", () => {
  it("lets a full user manager assign every organization role", () => {
    const roles = assignableRoleCodes(new Set([PERMISSIONS.USERS_MANAGE]));
    expect(roles.sort()).toEqual([...ORGANIZATION_ROLES].sort());
  });

  it("never offers CARE_SEEKER through the organization invite path", () => {
    // Family access is granted per case, not by adding someone to an
    // organization. Offering it here would create a member with no case and no
    // console, so it is excluded for every actor.
    for (const perm of [PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION]) {
      expect(assignableRoleCodes(new Set([perm]))).not.toContain(ROLES.CARE_SEEKER);
    }
    expect(ORGANIZATION_ROLES).not.toContain(ROLES.CARE_SEEKER);
    expect(isOrganizationRole(ROLES.CARE_SEEKER)).toBe(false);
    for (const code of ORGANIZATION_ROLES) {
      expect(isOrganizationRole(code)).toBe(true);
    }
  });

  it("lets an org-scoped manager assign only provider roles", () => {
    const roles = assignableRoleCodes(new Set([PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION]));
    expect(roles.sort()).toEqual([ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF].sort());
    expect(roles).not.toContain(ROLES.NONNIS_ADMIN);
    expect(roles).not.toContain(ROLES.NONNIS_OPERATIONS);
    expect(roles).not.toContain(ROLES.DISCHARGE_PROFESSIONAL);
  });

  it("grants nothing without user-management permissions", () => {
    expect(assignableRoleCodes(new Set([PERMISSIONS.CASES_READ]))).toEqual([]);
  });
});
