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

export interface MeResponse {
  authenticated: boolean;
  provisioned: boolean;
  user: MeUser | null;
  activeOrganizationId: string | null;
  memberships: MeMembership[];
  organizations: Array<{ id: string; name: string; type: string }>;
  permissions: string[];
}
