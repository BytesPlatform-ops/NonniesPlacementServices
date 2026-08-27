/**
 * Single source of truth for roles, permissions, and the role→permission
 * matrix. Codes are STABLE — guards check permission codes (never role names),
 * and the seed builds the database from these definitions.
 */

export const PERMISSIONS = {
  PLATFORM_MANAGE: "platform.manage",
  ORGANIZATIONS_READ: "organizations.read",
  ORGANIZATIONS_MANAGE: "organizations.manage",
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  USERS_MANAGE_OWN_ORGANIZATION: "users.manage_own_organization",
  FACILITIES_READ: "facilities.read",
  FACILITIES_MANAGE: "facilities.manage",
  CASES_READ: "cases.read",
  CASES_CREATE: "cases.create",
  CASES_UPDATE: "cases.update",
  CASES_ASSIGN: "cases.assign",
  CASES_READ_ALL: "cases.read_all",
  AUDIT_READ: "audit.read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.PLATFORM_MANAGE]: "Platform-level administration",
  [PERMISSIONS.ORGANIZATIONS_READ]: "Read organizations",
  [PERMISSIONS.ORGANIZATIONS_MANAGE]: "Create, update and (de)activate organizations",
  [PERMISSIONS.USERS_READ]: "Read users",
  [PERMISSIONS.USERS_MANAGE]: "Full user administration across roles",
  [PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION]: "Manage users within the actor's own organization",
  [PERMISSIONS.FACILITIES_READ]: "Read facilities",
  [PERMISSIONS.FACILITIES_MANAGE]: "Create, update and (de)activate facilities",
  [PERMISSIONS.CASES_READ]: "Read cases within the active organization",
  [PERMISSIONS.CASES_CREATE]: "Create cases within the active organization",
  [PERMISSIONS.CASES_UPDATE]: "Update cases within the active organization",
  [PERMISSIONS.CASES_ASSIGN]: "Assign a discharge professional to a case",
  [PERMISSIONS.CASES_READ_ALL]: "Read cases across all organizations (platform-wide)",
  [PERMISSIONS.AUDIT_READ]: "Read audit history",
};

export const ROLES = {
  NONNIS_ADMIN: "NONNIS_ADMIN",
  NONNIS_OPERATIONS: "NONNIS_OPERATIONS",
  DISCHARGE_PROFESSIONAL: "DISCHARGE_PROFESSIONAL",
  PROVIDER_ADMIN: "PROVIDER_ADMIN",
  PROVIDER_STAFF: "PROVIDER_STAFF",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: PermissionCode[];
}

export const ROLE_DEFINITIONS: Record<RoleCode, RoleDefinition> = {
  [ROLES.NONNIS_ADMIN]: {
    name: "Nonnis Administrator",
    description: "Full platform and identity administration.",
    permissions: Object.values(PERMISSIONS),
  },
  [ROLES.NONNIS_OPERATIONS]: {
    name: "Nonnis Operations",
    description: "Operational case and network access across organizations.",
    permissions: [
      PERMISSIONS.ORGANIZATIONS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.FACILITIES_READ,
      PERMISSIONS.CASES_READ,
      PERMISSIONS.CASES_CREATE,
      PERMISSIONS.CASES_UPDATE,
      PERMISSIONS.CASES_ASSIGN,
      PERMISSIONS.CASES_READ_ALL,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  [ROLES.DISCHARGE_PROFESSIONAL]: {
    name: "Discharge Professional",
    description: "Create and manage cases within an authorized organization.",
    permissions: [
      PERMISSIONS.ORGANIZATIONS_READ,
      PERMISSIONS.FACILITIES_READ,
      PERMISSIONS.CASES_READ,
      PERMISSIONS.CASES_CREATE,
      PERMISSIONS.CASES_UPDATE,
    ],
  },
  [ROLES.PROVIDER_ADMIN]: {
    name: "Provider Administrator",
    description: "Manage users and facilities within its own provider organization.",
    permissions: [
      PERMISSIONS.ORGANIZATIONS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION,
      PERMISSIONS.FACILITIES_READ,
      PERMISSIONS.FACILITIES_MANAGE,
    ],
  },
  [ROLES.PROVIDER_STAFF]: {
    name: "Provider Staff",
    description: "Organization-scoped operational access.",
    permissions: [PERMISSIONS.ORGANIZATIONS_READ, PERMISSIONS.FACILITIES_READ],
  },
};

/**
 * Which role codes an actor may assign, given their permissions. Enforces role
 * escalation protection: only full user-managers (Nonnis admin) may assign
 * Nonnis/discharge roles; org-scoped user-managers (provider admin) may assign
 * provider roles only.
 */
export function assignableRoleCodes(actorPermissions: ReadonlySet<string>): RoleCode[] {
  if (actorPermissions.has(PERMISSIONS.USERS_MANAGE)) {
    return Object.values(ROLES);
  }
  if (actorPermissions.has(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION)) {
    return [ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF];
  }
  return [];
}
