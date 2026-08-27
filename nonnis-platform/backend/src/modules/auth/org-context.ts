import { BadRequestException } from "@nestjs/common";
import type { RequestUser } from "./request-user";

/**
 * Returns the active organization id, or 400 if the request has no resolved
 * organization context (e.g. a multi-org user that did not send X-Organization-Id).
 * Organization-scoped queries must always be bounded by this value.
 */
export function requireActiveOrganization(user: RequestUser): string {
  if (!user.activeOrganizationId) {
    throw new BadRequestException("Organization context is required. Provide the X-Organization-Id header.");
  }
  return user.activeOrganizationId;
}

/** True if the user is a member of (has active context for) the given organization. */
export function isMemberOf(user: RequestUser, organizationId: string): boolean {
  return user.memberships.some((m) => m.organizationId === organizationId);
}
