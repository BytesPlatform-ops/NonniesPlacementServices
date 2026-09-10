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
 * A single active case authorization resolved for the request.
 *
 * The case-scoped counterpart to MembershipContext. A family member reaches the
 * platform through one of these instead of an organization membership.
 */
export interface CaseAccessContext {
  accessId: string;
  caseId: string;
  caseNumber: string;
  /// Display name of the person being placed, for the portal header.
  careRecipientName: string;
  relationship: string | null;
  roleCode: string;
  roleName: string;
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
  /**
   * Cases this user is authorized for as a family member. Empty for every
   * organization user, so nothing that reads `memberships` changes behaviour.
   */
  caseAccess: CaseAccessContext[];
  /** Resolved active organization for this request (header or sole membership). */
  activeOrganizationId: string | null;
  /**
   * Permissions for this request. For an organization user these are the active
   * organization's; for a family member they come from the case-access grant.
   * A user is one or the other — the two grant paths never overlap, because the
   * CARE_SEEKER role cannot be held in any organization.
   */
  activePermissions: ReadonlySet<string>;
}

/** True when this request is authenticated as a family member rather than staff. */
export function isCareSeeker(user: RequestUser): boolean {
  return user.memberships.length === 0 && user.caseAccess.length > 0;
}

/** Request augmentation set by the AuthGuard. */
export interface AuthState {
  authIdentity: VerifiedIdentity;
  authUser: RequestUser | null;
}

export function hasPermission(user: RequestUser, permission: string): boolean {
  return user.activePermissions.has(permission);
}
