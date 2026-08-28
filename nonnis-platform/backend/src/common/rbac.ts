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
  PROVIDERS_READ: "providers.read",
  PROVIDERS_MANAGE: "providers.manage",
  PROVIDERS_MANAGE_OWN: "providers.manage_own",
  SERVICE_CATEGORIES_READ: "service_categories.read",
  SERVICE_CATEGORIES_MANAGE: "service_categories.manage",
  PROVIDER_CAPACITY_MANAGE: "provider_capacity.manage",
  PROVIDER_CAPACITY_MANAGE_OWN: "provider_capacity.manage_own",
  FORM_SUBMISSIONS_READ: "form_submissions.read",
  FORM_SUBMISSIONS_MANAGE: "form_submissions.manage",
  REFERRALS_READ: "referrals.read",
  REFERRALS_MANAGE: "referrals.manage",
  REFERRALS_READ_ALL: "referrals.read_all",
  REFERRALS_RESPOND_OWN: "referrals.respond_own",
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
  [PERMISSIONS.PROVIDERS_READ]: "Read the provider directory",
  [PERMISSIONS.PROVIDERS_MANAGE]: "Create, update and (de)activate any provider and its profile",
  [PERMISSIONS.PROVIDERS_MANAGE_OWN]: "Manage the actor's own provider profile, services and coverage",
  [PERMISSIONS.SERVICE_CATEGORIES_READ]: "Read service categories",
  [PERMISSIONS.SERVICE_CATEGORIES_MANAGE]: "Create, update and (de)activate service categories and reference catalogs",
  [PERMISSIONS.PROVIDER_CAPACITY_MANAGE]: "Update capacity/availability for any provider",
  [PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN]: "Update capacity/availability for the actor's own provider",
  [PERMISSIONS.FORM_SUBMISSIONS_READ]: "Read website form submissions",
  [PERMISSIONS.FORM_SUBMISSIONS_MANAGE]: "Review, annotate and update website form submissions",
  [PERMISSIONS.REFERRALS_READ]: "Read referrals for authorized cases/providers",
  [PERMISSIONS.REFERRALS_MANAGE]: "Create, send and manage referrals for authorized cases",
  [PERMISSIONS.REFERRALS_READ_ALL]: "Read referrals across all organizations (platform-wide)",
  [PERMISSIONS.REFERRALS_RESPOND_OWN]: "Respond to referrals for the actor's own provider",
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
      PERMISSIONS.PROVIDERS_READ,
      PERMISSIONS.PROVIDERS_MANAGE,
      PERMISSIONS.SERVICE_CATEGORIES_READ,
      PERMISSIONS.PROVIDER_CAPACITY_MANAGE,
      PERMISSIONS.FORM_SUBMISSIONS_READ,
      PERMISSIONS.FORM_SUBMISSIONS_MANAGE,
      PERMISSIONS.REFERRALS_READ,
      PERMISSIONS.REFERRALS_MANAGE,
      PERMISSIONS.REFERRALS_READ_ALL,
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
      PERMISSIONS.PROVIDERS_READ,
      PERMISSIONS.SERVICE_CATEGORIES_READ,
      PERMISSIONS.REFERRALS_READ,
      PERMISSIONS.REFERRALS_MANAGE,
    ],
  },
  [ROLES.PROVIDER_ADMIN]: {
    name: "Provider Administrator",
    description: "Manage users, facilities and the provider profile within its own provider organization.",
    permissions: [
      PERMISSIONS.ORGANIZATIONS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION,
      PERMISSIONS.FACILITIES_READ,
      PERMISSIONS.FACILITIES_MANAGE,
      PERMISSIONS.PROVIDERS_READ,
      PERMISSIONS.PROVIDERS_MANAGE_OWN,
      PERMISSIONS.SERVICE_CATEGORIES_READ,
      PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN,
      PERMISSIONS.REFERRALS_READ,
      PERMISSIONS.REFERRALS_RESPOND_OWN,
    ],
  },
  [ROLES.PROVIDER_STAFF]: {
    name: "Provider Staff",
    description: "Organization-scoped operational access, including own-provider capacity updates.",
    permissions: [
      PERMISSIONS.ORGANIZATIONS_READ,
      PERMISSIONS.FACILITIES_READ,
      PERMISSIONS.PROVIDERS_READ,
      PERMISSIONS.SERVICE_CATEGORIES_READ,
      PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN,
      PERMISSIONS.REFERRALS_READ,
      PERMISSIONS.REFERRALS_RESPOND_OWN,
    ],
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
