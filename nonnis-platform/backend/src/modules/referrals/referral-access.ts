import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ReferralStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

export interface ReferralRef {
  id: string;
  caseId: string;
  serviceRequestId: string;
  providerId: string;
  status: ReferralStatus;
  caseOrganizationId: string;
  providerOrganizationId: string;
}

/**
 * Referral access control. Staff (discharge/Nonnis) are bounded by case
 * organization (unless referrals.read_all); provider users are bounded to
 * referrals for their own provider organization. Cross-scope access returns 404
 * so record existence is never revealed. `providerId` from the browser is never
 * trusted for authorization — it is always re-derived from the referral.
 */
@Injectable()
export class ReferralAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private memberOf(user: RequestUser, organizationId: string): boolean {
    return user.memberships.some((m) => m.organizationId === organizationId);
  }

  private async load(referralId: string): Promise<ReferralRef | null> {
    const r = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        caseId: true,
        serviceRequestId: true,
        providerId: true,
        status: true,
        case: { select: { organizationId: true } },
        provider: { select: { organizationId: true } },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      caseId: r.caseId,
      serviceRequestId: r.serviceRequestId,
      providerId: r.providerId,
      status: r.status,
      caseOrganizationId: r.case.organizationId,
      providerOrganizationId: r.provider.organizationId,
    };
  }

  /** Staff (discharge/Nonnis) access via the case's organization. */
  async loadForStaff(user: RequestUser, referralId: string, forWrite = false): Promise<ReferralRef> {
    const r = await this.load(referralId);
    if (!r) throw new NotFoundException(`Referral ${referralId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.REFERRALS_READ_ALL);
    if (!readAll && r.caseOrganizationId !== user.activeOrganizationId) {
      throw new NotFoundException(`Referral ${referralId} not found`);
    }
    if (forWrite && !user.activePermissions.has(PERMISSIONS.REFERRALS_MANAGE)) {
      throw new ForbiddenException("You do not have permission to manage this referral.");
    }
    return r;
  }

  /** Provider user access via their own provider organization. */
  async loadForProvider(user: RequestUser, referralId: string): Promise<ReferralRef> {
    const r = await this.load(referralId);
    if (!r) throw new NotFoundException(`Referral ${referralId} not found`);
    if (!this.memberOf(user, r.providerOrganizationId)) {
      throw new NotFoundException(`Referral ${referralId} not found`);
    }
    return r;
  }

  /** Confirm the caller may create a referral on the given case; returns its org id. */
  async ensureCaseForCreate(user: RequestUser, caseId: string): Promise<string> {
    const c = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.REFERRALS_READ_ALL);
    if (!readAll && c.organizationId !== user.activeOrganizationId) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    return c.organizationId;
  }
}
