import type { RoleOption } from "@/types/admin";

/**
 * The roles that may be offered inside an organization of `organizationType`.
 *
 * The server is authoritative — it rejects an incompatible pairing with a 400
 * either way — so this only decides what the invite form presents. The rules
 * travel with each role rather than being restated here, which is why a role
 * carries its own `allowedOrganizationTypes`.
 *
 * `allowedOrganizationTypes` is read defensively because the CRM and the API
 * deploy independently. A CRM running ahead of the API receives roles without
 * the field, and reading `.length` straight off `undefined` throws during
 * render — which is not a missing dropdown option but a blank page, since a
 * throw in a client component takes the whole route down. Treating the absent
 * field as "no restriction recorded" degrades to the old behaviour: every
 * assignable role is offered, and the server still refuses a bad pairing.
 *
 * An empty list means the same thing on purpose: it is what the server sends
 * for a role that belongs to no organization type at all (CARE_SEEKER), and
 * such a role never reaches this list because it is not assignable through the
 * organization invite path.
 */
export function rolesAssignableIn(
  roles: readonly RoleOption[] | null | undefined,
  organizationType: string | null,
): RoleOption[] {
  return (roles ?? []).filter((role) => {
    if (!organizationType) return true;
    const allowed = role.allowedOrganizationTypes ?? [];
    return allowed.length === 0 || allowed.includes(organizationType);
  });
}
