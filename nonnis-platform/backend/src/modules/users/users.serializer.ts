import type { MembershipStatus, UserStatus } from "@prisma/client";

export interface MembershipView {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  roleCode: string;
  roleName: string;
  status: MembershipStatus;
  isPrimary: boolean;
}

export interface UserView {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface UserDetailView extends UserView {
  updatedAt: string;
  memberships: MembershipView[];
}

interface UserRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface MembershipRecord {
  id: string;
  organizationId: string;
  status: MembershipStatus;
  isPrimary: boolean;
  organization: { name: string };
  role: { code: string; name: string };
}

export function toUserView(user: UserRecord): UserView {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toMembershipView(m: MembershipRecord): MembershipView {
  return {
    membershipId: m.id,
    organizationId: m.organizationId,
    organizationName: m.organization.name,
    roleCode: m.role.code,
    roleName: m.role.name,
    status: m.status,
    isPrimary: m.isPrimary,
  };
}

export function toUserDetailView(user: UserRecord, memberships: MembershipRecord[]): UserDetailView {
  return {
    ...toUserView(user),
    updatedAt: user.updatedAt.toISOString(),
    memberships: memberships.map(toMembershipView),
  };
}
