export interface OrganizationView {
  id: string;
  type: string;
  status: string;
  name: string;
  legalName: string | null;
  externalRef: string | null;
  facilitiesCount: number;
  membersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityView {
  id: string;
  organizationId: string;
  status: string;
  name: string;
  externalRef: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  casesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipView {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  roleCode: string;
  roleName: string;
  status: string;
  isPrimary: boolean;
}

export interface UserView {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: string;
  createdAt: string;
}

export interface UserListItem extends UserView {
  membership: MembershipView;
}

export interface UserDetailView extends UserView {
  updatedAt: string;
  memberships: MembershipView[];
}

export interface RoleOption {
  code: string;
  name: string;
}

export const ORGANIZATION_TYPES = [
  "HOSPITAL",
  "REHABILITATION_CENTER",
  "SKILLED_NURSING_FACILITY",
  "PROVIDER",
  "PARTNER",
  "NONNIS",
] as const;
