import type { UserStatus } from "@prisma/client";
import type { VerifiedIdentity } from "./token-verifier";

/** A single active organization membership resolved for the request. */
export interface MembershipContext {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  organizationStatus: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isPrimary: boolean;
  permissions: string[];
}

/**
 * The authenticated application user attached to a request. Built server-side
 * from a verified identity — never from anything the browser asserts.
 */
export interface RequestUser {
  id: string;
  supabaseUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: UserStatus;
  memberships: MembershipContext[];
  /** Resolved active organization for this request (header or sole membership). */
  activeOrganizationId: string | null;
  /** Permissions granted within the active organization. */
  activePermissions: ReadonlySet<string>;
}

/** Request augmentation set by the AuthGuard. */
export interface AuthState {
  authIdentity: VerifiedIdentity;
  authUser: RequestUser | null;
}

export function hasPermission(user: RequestUser, permission: string): boolean {
  return user.activePermissions.has(permission);
}
