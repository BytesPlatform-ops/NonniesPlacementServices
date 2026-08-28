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

/**
 * Role-aware post-login landing path. Provider-org users go to their self-service
 * portal; everyone else keeps the operations console default.
 */
export function landingPath(me: MeResponse | null): string {
  if (!me || !me.provisioned || me.memberships.length === 0) return "/cases";
  return activeOrgIsProvider(me, me.activeOrganizationId) ? "/provider" : "/cases";
}
