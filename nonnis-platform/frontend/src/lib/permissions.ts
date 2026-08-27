/** Permission codes mirrored from the backend RBAC definitions (UX gating only —
 *  the backend remains authoritative for every protected action). */
export const PERMISSIONS = {
  ORGANIZATIONS_READ: "organizations.read",
  ORGANIZATIONS_MANAGE: "organizations.manage",
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  USERS_MANAGE_OWN_ORGANIZATION: "users.manage_own_organization",
  FACILITIES_READ: "facilities.read",
  FACILITIES_MANAGE: "facilities.manage",
  CASES_READ: "cases.read",
  CASES_CREATE: "cases.create",
} as const;
