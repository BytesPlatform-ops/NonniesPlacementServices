import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

export interface ReferralThreadRef {
  referralId: string;
  caseId: string;
  caseOrganizationId: string;
  providerOrganizationId: string;
}

/**
 * Centralized message visibility. CASE_TEAM = members of the case organization
 * (or Nonnis read_all) — providers are excluded. NONNIS_INTERNAL = Nonnis staff
 * (internal_notes.manage) only. PROVIDER_REFERRAL = the referral's provider org
 * OR the case side OR Nonnis — one provider can never see another's thread.
 * Unauthorized access returns 404 so existence is never revealed.
 */
@Injectable()
export class MessageAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private memberOf(user: RequestUser, organizationId: string): boolean {
    return user.memberships.some((m) => m.organizationId === organizationId);
  }

  async caseTeamAccess(user: RequestUser, caseId: string): Promise<string> {
    const c = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.MESSAGES_READ_ALL);
    if (!readAll && !this.memberOf(user, c.organizationId)) throw new NotFoundException(`Case ${caseId} not found`);
    return c.organizationId;
  }

  async internalAccess(user: RequestUser, caseId: string): Promise<string> {
    if (!user.activePermissions.has(PERMISSIONS.INTERNAL_NOTES_MANAGE)) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    const c = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    return c.organizationId;
  }

  async referralAccess(user: RequestUser, referralId: string): Promise<ReferralThreadRef> {
    const r = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { id: true, caseId: true, case: { select: { organizationId: true } }, provider: { select: { organizationId: true } } },
    });
    if (!r) throw new NotFoundException(`Referral ${referralId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.MESSAGES_READ_ALL);
    const providerSide = this.memberOf(user, r.provider.organizationId);
    const caseSide = this.memberOf(user, r.case.organizationId);
    if (!readAll && !providerSide && !caseSide) throw new NotFoundException(`Referral ${referralId} not found`);
    return { referralId: r.id, caseId: r.caseId, caseOrganizationId: r.case.organizationId, providerOrganizationId: r.provider.organizationId };
  }
}
