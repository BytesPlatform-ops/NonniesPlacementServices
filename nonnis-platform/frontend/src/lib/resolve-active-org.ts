/**
 * Chooses the active organization for a session: prefer a valid stored choice,
 * then the backend's resolution, then the first membership. Returns null when
 * the user has no memberships. Never returns an organization the user is not a
 * member of.
 */
export function resolveActiveOrg(
  stored: string | null,
  backendActive: string | null,
  membershipOrgIds: readonly string[],
): string | null {
  if (membershipOrgIds.length === 0) return null;
  const valid = new Set(membershipOrgIds);
  if (stored && valid.has(stored)) return stored;
  if (backendActive && valid.has(backendActive)) return backendActive;
  return membershipOrgIds[0] ?? null;
}
