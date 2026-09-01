import { PERMISSIONS, ROLE_DEFINITIONS, ROLES } from "../../common/rbac";

describe("Communications RBAC", () => {
  const COMMS = [PERMISSIONS.COMMUNICATIONS_READ, PERMISSIONS.COMMUNICATIONS_MANAGE, PERMISSIONS.COMMUNICATIONS_IMPORT];
  it("grants read/manage/import to Nonnis Admin and Operations", () => {
    for (const role of [ROLES.NONNIS_ADMIN, ROLES.NONNIS_OPERATIONS]) {
      for (const p of COMMS) expect(ROLE_DEFINITIONS[role].permissions).toContain(p);
    }
  });
  it("denies communications to discharge and provider roles", () => {
    for (const role of [ROLES.DISCHARGE_PROFESSIONAL, ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF]) {
      for (const p of COMMS) expect(ROLE_DEFINITIONS[role].permissions).not.toContain(p);
    }
  });
});
