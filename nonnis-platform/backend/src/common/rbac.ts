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
  TASKS_READ: "tasks.read",
  TASKS_MANAGE: "tasks.manage",
  TASKS_READ_ALL: "tasks.read_all",
  MESSAGES_READ: "messages.read",
  MESSAGES_SEND: "messages.send",
  MESSAGES_READ_ALL: "messages.read_all",
  INTERNAL_NOTES_MANAGE: "internal_notes.manage",
  CONTENT_READ: "content.read",
  CONTENT_MANAGE: "content.manage",
  REPORTS_READ: "reports.read",
  REPORTS_EXPORT: "reports.export",
  COMMUNICATIONS_READ: "communications.read",
  COMMUNICATIONS_MANAGE: "communications.manage",
  COMMUNICATIONS_IMPORT: "communications.import",
  COMMUNICATIONS_SEND: "communications.send",

  // --- Case sub-resources introduced for the family portal -----------------
  // Staff-side. Documents and appointments follow the same shape as tasks:
  // their own permission pair rather than riding on cases.read/update, so a
  // role can be given case access without automatically gaining either.
  CASE_DOCUMENTS_READ: "case_documents.read",
  CASE_DOCUMENTS_MANAGE: "case_documents.manage",
  CASE_APPOINTMENTS_READ: "case_appointments.read",
  CASE_APPOINTMENTS_MANAGE: "case_appointments.manage",
  /// Grant, edit and revoke a family member's access to a case.
  CARE_SEEKERS_MANAGE: "care_seekers.manage",

  // --- Care Seeker (family) portal ----------------------------------------
  // Deliberately a separate namespace from the staff permissions above. A
  // seeker holds ONLY these, so every staff and provider route is closed to
  // them by the permission guard alone, before any row-level check runs.
  SEEKER_CASE_READ: "seeker_case.read",
  SEEKER_DOCUMENTS_READ: "seeker_documents.read",
  SEEKER_DOCUMENTS_UPLOAD: "seeker_documents.upload",
  SEEKER_MESSAGES_READ: "seeker_messages.read",
  SEEKER_MESSAGES_SEND: "seeker_messages.send",
  SEEKER_APPOINTMENTS_READ: "seeker_appointments.read",
  SEEKER_APPOINTMENTS_REQUEST: "seeker_appointments.request",
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
  [PERMISSIONS.TASKS_READ]: "Read case tasks for authorized cases",
  [PERMISSIONS.TASKS_MANAGE]: "Create, assign and update case tasks",
  [PERMISSIONS.TASKS_READ_ALL]: "Read case tasks across all organizations (platform-wide)",
  [PERMISSIONS.MESSAGES_READ]: "Read case-linked messages the actor is authorized for",
  [PERMISSIONS.MESSAGES_SEND]: "Send case-linked messages the actor is authorized for",
  [PERMISSIONS.MESSAGES_READ_ALL]: "Read case messages across all organizations (platform-wide)",
  [PERMISSIONS.INTERNAL_NOTES_MANAGE]: "Read and add Nonnis-internal case notes",
  [PERMISSIONS.CONTENT_READ]: "Read public-website CMS content (blog, videos, testimonials)",
  [PERMISSIONS.CONTENT_MANAGE]: "Create, update and (un)publish public-website CMS content",
  [PERMISSIONS.REPORTS_READ]: "Read administrative reports (counts, grouped summaries, filtered lists)",
  [PERMISSIONS.REPORTS_EXPORT]: "Export administrative reports as CSV",
  [PERMISSIONS.COMMUNICATIONS_READ]: "Read communications contacts, lists, tags and consent",
  [PERMISSIONS.COMMUNICATIONS_MANAGE]: "Create, edit, archive communications contacts, lists, tags, consent and suppressions",
  [PERMISSIONS.COMMUNICATIONS_IMPORT]: "Import communications contacts (paste/CSV/TXT)",
  [PERMISSIONS.COMMUNICATIONS_SEND]: "Queue and send bulk email campaigns and test emails",
  [PERMISSIONS.CASE_DOCUMENTS_READ]: "Read documents attached to authorized cases",
  [PERMISSIONS.CASE_DOCUMENTS_MANAGE]: "Request, upload, review and remove case documents",
  [PERMISSIONS.CASE_APPOINTMENTS_READ]: "Read tours and appointments for authorized cases",
  [PERMISSIONS.CASE_APPOINTMENTS_MANAGE]: "Schedule, reschedule and complete tours and appointments",
  [PERMISSIONS.CARE_SEEKERS_MANAGE]: "Grant, edit and revoke family (Care Seeker) access to a case",
  [PERMISSIONS.SEEKER_CASE_READ]: "Read the family-facing view of an authorized case",
  [PERMISSIONS.SEEKER_DOCUMENTS_READ]: "Read documents shared with the family on an authorized case",
  [PERMISSIONS.SEEKER_DOCUMENTS_UPLOAD]: "Upload requested documents to an authorized case",
  [PERMISSIONS.SEEKER_MESSAGES_READ]: "Read the family message thread on an authorized case",
  [PERMISSIONS.SEEKER_MESSAGES_SEND]: "Send a message to Nonnis on an authorized case",
  [PERMISSIONS.SEEKER_APPOINTMENTS_READ]: "Read tours and appointments on an authorized case",
  [PERMISSIONS.SEEKER_APPOINTMENTS_REQUEST]: "Request or ask to change a tour on an authorized case",
};

export const ROLES = {
  NONNIS_ADMIN: "NONNIS_ADMIN",
  NONNIS_OPERATIONS: "NONNIS_OPERATIONS",
  DISCHARGE_PROFESSIONAL: "DISCHARGE_PROFESSIONAL",
  PROVIDER_ADMIN: "PROVIDER_ADMIN",
  PROVIDER_STAFF: "PROVIDER_STAFF",
  CARE_SEEKER: "CARE_SEEKER",
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
      PERMISSIONS.TASKS_READ,
      PERMISSIONS.TASKS_MANAGE,
      PERMISSIONS.TASKS_READ_ALL,
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_SEND,
      PERMISSIONS.MESSAGES_READ_ALL,
      PERMISSIONS.INTERNAL_NOTES_MANAGE,
      PERMISSIONS.CASE_DOCUMENTS_READ,
      PERMISSIONS.CASE_DOCUMENTS_MANAGE,
      PERMISSIONS.CASE_APPOINTMENTS_READ,
      PERMISSIONS.CASE_APPOINTMENTS_MANAGE,
      PERMISSIONS.CARE_SEEKERS_MANAGE,
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.COMMUNICATIONS_READ,
      PERMISSIONS.COMMUNICATIONS_MANAGE,
      PERMISSIONS.COMMUNICATIONS_IMPORT,
      PERMISSIONS.COMMUNICATIONS_SEND,
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
      PERMISSIONS.TASKS_READ,
      PERMISSIONS.TASKS_MANAGE,
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_SEND,
      PERMISSIONS.CASE_DOCUMENTS_READ,
      PERMISSIONS.CASE_DOCUMENTS_MANAGE,
      PERMISSIONS.CASE_APPOINTMENTS_READ,
      PERMISSIONS.CASE_APPOINTMENTS_MANAGE,
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
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_SEND,
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
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_SEND,
    ],
  },
  [ROLES.CARE_SEEKER]: {
    name: "Care Seeker",
    description: "A family member or authorized representative, scoped to the cases they are explicitly granted.",
    // Holds none of the staff or provider permissions. Every operations,
    // provider-portal and administration route is therefore refused by the
    // permission guard before any handler runs — the case-level check that
    // follows only decides WHICH case, never WHETHER the portal is reachable.
    permissions: [
      PERMISSIONS.SEEKER_CASE_READ,
      PERMISSIONS.SEEKER_DOCUMENTS_READ,
      PERMISSIONS.SEEKER_DOCUMENTS_UPLOAD,
      PERMISSIONS.SEEKER_MESSAGES_READ,
      PERMISSIONS.SEEKER_MESSAGES_SEND,
      PERMISSIONS.SEEKER_APPOINTMENTS_READ,
      PERMISSIONS.SEEKER_APPOINTMENTS_REQUEST,
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
    // Organization roles only. CARE_SEEKER is deliberately absent: it is not
    // granted by adding someone to an organization, and offering it here would
    // produce a member with no case and no console.
    return [...ORGANIZATION_ROLES];
  }
  if (actorPermissions.has(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION)) {
    return [ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Role ↔ organization type compatibility
// ---------------------------------------------------------------------------

/**
 * The organization types each role may be assigned to.
 *
 * A role and an organization type are two halves of one decision, and the
 * platform already behaves as if they are: the CRM picks the provider portal or
 * the staff console purely from `Organization.type`, never from the role code.
 * A provider role sitting in a hospital organization therefore produced a user
 * with provider permissions and a staff console — a combination nothing in the
 * product means to support. These rules make that impossible to create.
 *
 * DISCHARGE_PROFESSIONAL covers the referring side of the network: the
 * organizations that discharge or refer patients. NONNIS and PROVIDER are
 * excluded because each already has its own dedicated roles. PARTNER is
 * included by elimination — it is neither the platform operator nor a care
 * provider — and excluding it would make PARTNER organizations unusable, since
 * no role could then be assigned to anyone in one.
 */
export const ROLE_ALLOWED_ORGANIZATION_TYPES: Record<RoleCode, readonly OrganizationTypeCode[]> = {
  [ROLES.NONNIS_ADMIN]: ["NONNIS"],
  [ROLES.NONNIS_OPERATIONS]: ["NONNIS"],
  [ROLES.DISCHARGE_PROFESSIONAL]: ["HOSPITAL", "REHABILITATION_CENTER", "SKILLED_NURSING_FACILITY", "PARTNER"],
  [ROLES.PROVIDER_ADMIN]: ["PROVIDER"],
  [ROLES.PROVIDER_STAFF]: ["PROVIDER"],
  // Empty on purpose, and the only role for which that is true. A family member
  // is scoped to a CASE, not to an organization: their access lives in
  // CareSeekerCaseAccess, not in an OrganizationMembership. Listing no type
  // means `isRoleAllowedForOrganizationType` refuses it for every organization,
  // so it can never be granted through the organization invite path — which is
  // exactly the intent, not an oversight.
  [ROLES.CARE_SEEKER]: [],
};

/** Every organization type in the schema's `OrganizationType` enum. */
export type OrganizationTypeCode =
  | "NONNIS"
  | "HOSPITAL"
  | "REHABILITATION_CENTER"
  | "SKILLED_NURSING_FACILITY"
  | "PROVIDER"
  | "PARTNER";

/**
 * Roles granted through an OrganizationMembership.
 *
 * Every role except CARE_SEEKER. Kept as a derived list rather than a second
 * hand-written one so a future role cannot appear in `ROLES` and be silently
 * omitted here.
 */
export const ORGANIZATION_ROLES: readonly RoleCode[] = (Object.keys(ROLE_ALLOWED_ORGANIZATION_TYPES) as RoleCode[])
  .filter((code) => ROLE_ALLOWED_ORGANIZATION_TYPES[code].length > 0);

/** True when this role is granted through organization membership at all. */
export function isOrganizationRole(roleCode: string): boolean {
  return (ORGANIZATION_ROLES as readonly string[]).includes(roleCode);
}

/** True when `roleCode` may be held inside an organization of `organizationType`. */
export function isRoleAllowedForOrganizationType(roleCode: string, organizationType: string): boolean {
  const allowed = ROLE_ALLOWED_ORGANIZATION_TYPES[roleCode as RoleCode];
  return !!allowed && (allowed as readonly string[]).includes(organizationType);
}

/** The roles that may be assigned inside an organization of this type. */
export function rolesForOrganizationType(organizationType: string): RoleCode[] {
  return (Object.keys(ROLE_ALLOWED_ORGANIZATION_TYPES) as RoleCode[]).filter((code) =>
    isRoleAllowedForOrganizationType(code, organizationType),
  );
}

/** Human-readable reason for a rejected role/organization pairing. */
export function roleOrganizationTypeError(roleCode: string, organizationType: string): string {
  const allowed = ROLE_ALLOWED_ORGANIZATION_TYPES[roleCode as RoleCode];
  if (!allowed) return `Unknown role: ${roleCode}.`;
  return `The ${roleCode} role cannot be assigned in a ${organizationType} organization. It is only valid in: ${allowed.join(", ")}.`;
}
