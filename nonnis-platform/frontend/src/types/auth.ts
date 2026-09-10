export interface MeMembership {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  roleCode: string;
  roleName: string;
  isPrimary: boolean;
  permissions: string[];
}

export interface MeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: string;
}

/** A case this user may open as a family member (Care Seeker). */
export interface MeCaseAccess {
  caseId: string;
  caseNumber: string;
  careRecipientName: string;
  relationship: string | null;
  roleCode: string;
  roleName: string;
}

export interface MeResponse {
  authenticated: boolean;
  provisioned: boolean;
  user: MeUser | null;
  activeOrganizationId: string | null;
  memberships: MeMembership[];
  organizations: Array<{ id: string; name: string; type: string }>;
  /**
   * Empty for every organization user; populated only for a Care Seeker.
   * Optional because the CRM and the API deploy independently — an API one
   * deployment behind does not send it. Read it through `isCareSeeker`, which
   * treats its absence as "no family access".
   */
  caseAccess?: MeCaseAccess[];
  permissions: string[];
}
