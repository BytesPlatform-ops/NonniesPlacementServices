import { PERMISSIONS, ROLE_DEFINITIONS, ROLES } from "../../common/rbac";

describe("Reports RBAC mapping", () => {
  it("grants reports.read and reports.export to Nonnis Admin", () => {
    const perms = ROLE_DEFINITIONS[ROLES.NONNIS_ADMIN].permissions;
    expect(perms).toContain(PERMISSIONS.REPORTS_READ);
    expect(perms).toContain(PERMISSIONS.REPORTS_EXPORT);
  });

  it("grants reports.read and reports.export to Nonnis Operations", () => {
    const perms = ROLE_DEFINITIONS[ROLES.NONNIS_OPERATIONS].permissions;
    expect(perms).toContain(PERMISSIONS.REPORTS_READ);
    expect(perms).toContain(PERMISSIONS.REPORTS_EXPORT);
  });

  it("does not grant reports access to discharge or provider roles", () => {
    for (const role of [ROLES.DISCHARGE_PROFESSIONAL, ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF]) {
      const perms = ROLE_DEFINITIONS[role].permissions;
      expect(perms).not.toContain(PERMISSIONS.REPORTS_READ);
      expect(perms).not.toContain(PERMISSIONS.REPORTS_EXPORT);
    }
  });
});
