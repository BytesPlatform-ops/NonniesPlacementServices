import type { MeResponse } from "@/types/auth";

/** The membership matching the active organization (falls back to the first). */
function activeMembership(me: MeResponse | null, activeOrganizationId: string | null) {
  if (!me || me.memberships.length === 0) return null;
  return me.memberships.find((m) => m.organizationId === activeOrganizationId) ?? me.memberships[0];
}

/** True when the active organization is a provider organization. */
export function activeOrgIsProvider(me: MeResponse | null, activeOrganizationId: string | null): boolean {
  return activeMembership(me, activeOrganizationId)?.organizationType === "PROVIDER";
}

/** The active organization's type, or null when there is no usable membership. */
export function activeOrgType(me: MeResponse | null, activeOrganizationId: string | null): string | null {
  return activeMembership(me, activeOrganizationId)?.organizationType ?? null;
}

/**
 * True when this session's access is case-scoped rather than organization-scoped.
 *
 * A family member holds no organization membership at all; their access comes
 * from an explicit grant on one or more cases. The two are mutually exclusive
 * by design — the CARE_SEEKER role cannot be held inside an organization.
 */
export function isCareSeeker(me: MeResponse | null): boolean {
  return !!me && me.memberships.length === 0 && (me.caseAccess?.length ?? 0) > 0;
}

/**
 * Role-aware post-login landing path. Provider-org users go to their self-service
 * portal, family members to the Care Seeker portal, and everyone else keeps the
 * operations console default.
 */
export function landingPath(me: MeResponse | null): string {
  if (!me || !me.provisioned) return "/cases";
  // Checked before the membership fallback below, which is the only reason the
  // existing outcomes are all preserved: a user with neither a membership nor a
  // grant still lands on /cases exactly as before.
  if (isCareSeeker(me)) return "/seeker";
  if (me.memberships.length === 0) return "/cases";
  if (activeOrgIsProvider(me, me.activeOrganizationId)) return "/provider";
  // Nonnis staff (platform-wide case access) land in the operations control center.
  if (me.permissions.includes("cases.read_all")) return "/operations";
  return "/cases";
}
