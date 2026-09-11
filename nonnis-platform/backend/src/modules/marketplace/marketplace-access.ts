import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import { requireActiveOrganization } from "../auth/org-context";
import type { RequestUser } from "../auth/request-user";

/**
 * Who a marketplace request acts as.
 *
 * A provider's identity is derived from the authenticated membership, exactly
 * as the provider portal derives it — a providerId from the browser is never
 * trusted. A family member has no organization at all, so their identity is
 * simply their user id.
 */
@Injectable()
export class MarketplaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The provider owned by the caller's active organization, or 403/404. */
  async requireOwnProvider(user: RequestUser): Promise<{ id: string; organizationId: string }> {
    const organizationId = requireActiveOrganization(user);
    const provider = await this.prisma.provider.findFirst({
      where: { organizationId },
      select: { id: true, organizationId: true },
    });
    if (!provider) {
      throw new ForbiddenException("This organization does not have a provider profile.");
    }
    return provider;
  }

  /**
   * A case the family member actually holds ACTIVE access to.
   *
   * Returns null when no case was supplied. A supplied id that is not theirs is
   * a 404 like everywhere else in the seeker surface — never a silent drop,
   * which would attach the order to the wrong case, and never a 403, which
   * would confirm the case exists.
   */
  requireOwnCase(user: RequestUser, caseId?: string | null): string | null {
    if (!caseId) return null;
    const grant = user.caseAccess.find((a) => a.caseId === caseId);
    if (!grant) throw new NotFoundException(`Case ${caseId} not found`);
    return grant.caseId;
  }

  /** True for a platform user who may see and moderate the whole marketplace. */
  isMarketplaceAdmin(user: RequestUser): boolean {
    return user.activePermissions.has(PERMISSIONS.MARKETPLACE_ADMIN_READ);
  }
}

/**
 * Human-readable order reference: MKT-<year>-XXXXXX, mirroring the referral
 * reference. The UUID stays the primary key; this is for people.
 */
export function generateOrderNumber(now: Date = new Date()): string {
  return `MKT-${now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
