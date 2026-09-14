import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { PermissionCode } from "../../common/rbac";

/**
 * Who should receive a notification.
 *
 * Every audience here is derived from authorization the recipient ALREADY
 * holds — an ACTIVE membership in the organization the event belongs to, whose
 * role carries the permission the event requires; or an ACTIVE case grant for a
 * family member. Nothing invents an audience of its own.
 *
 * That is what keeps role-specific delivery honest without a second
 * permission model: Provider Staff receive an order notification because they
 * hold `marketplace_orders.manage_own`, and do not receive a listing one
 * because they do not hold `marketplace_listings.manage_own`. Change the role
 * definition and delivery follows, with nothing here to update.
 */
@Injectable()
export class NotificationAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active members of one organization whose role holds `permission`.
   *
   * Used for every staff and provider audience. The organization bound is what
   * keeps Provider A out of Provider B's feed: the id comes from the record the
   * event happened on, never from a request.
   */
  async organizationUsers(organizationId: string, permission: PermissionCode): Promise<string[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        role: { permissions: { some: { permission: { code: permission } } } },
      },
      select: { userId: true },
    });
    return [...new Set(memberships.map((m) => m.userId))];
  }

  /** The provider organization that owns a provider record. */
  async providerOrganizationId(providerId: string): Promise<string | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { organizationId: true },
    });
    return provider?.organizationId ?? null;
  }

  /** Provider-organization users holding `permission`, resolved from a provider id. */
  async providerUsers(providerId: string, permission: PermissionCode): Promise<string[]> {
    const organizationId = await this.providerOrganizationId(providerId);
    return organizationId ? this.organizationUsers(organizationId, permission) : [];
  }

  /**
   * Family members with live access to one case.
   *
   * Mirrors the portal's own rule exactly: the grant must be ACTIVE, the user
   * ACTIVE, and the case not cancelled. A revoked relative stops being notified
   * for the same reason they stop being able to open the case.
   */
  async caseFamilyUsers(caseId: string): Promise<string[]> {
    const grants = await this.prisma.careSeekerCaseAccess.findMany({
      where: {
        caseId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        case: { status: { not: "CANCELLED" } },
      },
      select: { userId: true },
    });
    return [...new Set(grants.map((g) => g.userId))];
  }

  /**
   * The staff who work a case: its organization's members holding `permission`,
   * plus the assigned professional when there is one.
   */
  async caseTeamUsers(caseId: string, permission: PermissionCode): Promise<string[]> {
    const record = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { organizationId: true, assignedDischargeProfessionalId: true },
    });
    if (!record) return [];
    const team = await this.organizationUsers(record.organizationId, permission);
    return [...new Set([...team, ...(record.assignedDischargeProfessionalId ? [record.assignedDischargeProfessionalId] : [])])];
  }

  /**
   * Platform staff holding `permission`, across every Nonnis organization.
   *
   * The only audience not bounded to one organization, and deliberately so:
   * operations and administration are platform-wide roles. It still selects by
   * permission, so a role without it is never included.
   */
  async platformUsers(permission: PermissionCode): Promise<string[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        organization: { type: "NONNIS", status: "ACTIVE" },
        role: { permissions: { some: { permission: { code: permission } } } },
      },
      select: { userId: true },
    });
    return [...new Set(memberships.map((m) => m.userId))];
  }
}
