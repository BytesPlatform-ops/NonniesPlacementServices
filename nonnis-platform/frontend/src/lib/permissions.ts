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
  PROVIDERS_READ: "providers.read",
  PROVIDERS_MANAGE: "providers.manage",
  PROVIDERS_MANAGE_OWN: "providers.manage_own",
  SERVICE_CATEGORIES_READ: "service_categories.read",
  SERVICE_CATEGORIES_MANAGE: "service_categories.manage",
  PROVIDER_CAPACITY_MANAGE: "provider_capacity.manage",
  PROVIDER_CAPACITY_MANAGE_OWN: "provider_capacity.manage_own",
} as const;
