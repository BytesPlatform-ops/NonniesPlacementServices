import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { CaseAccessContext, RequestUser } from "../auth/request-user";

/**
 * Row-level authorization for the family portal.
 *
 * The permission guard has already decided that the caller holds the seeker
 * permissions at all; this decides WHICH case they may see. It is the family
 * counterpart of `ensureCaseAccess`, and follows the same two rules the rest of
 * the platform follows:
 *
 *  - the browser's case id is never trusted — access is re-derived from the
 *    grant rows resolved server-side for this request;
 *  - an unauthorized case returns 404, not 403, so a family member cannot probe
 *    ids to learn which cases exist.
 *
 * Grants are already filtered by `AuthContextService` to ACTIVE rows on a
 * non-cancelled case held by an ACTIVE user, so a revoked family member fails
 * here for the same reason a stranger does: the grant is simply not in the
 * request's list.
 */
@Injectable()
export class SeekerCaseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every case this request may read. Empty for staff and provider users. */
  authorizedCaseIds(user: RequestUser): string[] {
    return user.caseAccess.map((a) => a.caseId);
  }

  /**
   * The grant for `caseId`, or 404.
   *
   * Resolved from the request's own grants rather than by querying, so a case
   * whose grant was revoked mid-session cannot be reached with a stale id: the
   * next request rebuilds this list from the database.
   */
  requireCase(user: RequestUser, caseId: string): CaseAccessContext {
    const grant = user.caseAccess.find((a) => a.caseId === caseId);
    if (!grant) throw new NotFoundException(`Case ${caseId} not found`);
    return grant;
  }

  /**
   * The case the portal should open by default.
   *
   * Most families have exactly one. When someone is authorized for several —
   * two relatives placed through Nonnis, say — the first grant wins, and the
   * ordering that makes "first" stable lives in the auth context's include.
   */
  defaultCase(user: RequestUser): CaseAccessContext | null {
    return user.caseAccess[0] ?? null;
  }

  /**
   * Resolves an optional caseId parameter to an authorized grant.
   *
   * Passing no id opens the default case; passing one the caller does not hold
   * is a 404, never a silent fallback to the default — quietly showing a
   * different case than the one asked for would be a worse failure than an
   * error.
   */
  resolveCase(user: RequestUser, caseId?: string | null): CaseAccessContext {
    if (caseId) return this.requireCase(user, caseId);
    const fallback = this.defaultCase(user);
    if (!fallback) throw new NotFoundException("No case is linked to this account.");
    return fallback;
  }

  /**
   * Confirms a referral belongs to an authorized case before its detail is
   * shown, returning the case id it hangs from.
   *
   * The family may only see referrals raised for their own case; a referral id
   * from anywhere else is a 404 like any other unauthorized record.
   */
  async requireReferral(user: RequestUser, referralId: string): Promise<{ caseId: string; providerId: string }> {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { caseId: true, providerId: true },
    });
    if (!referral) throw new NotFoundException(`Referral ${referralId} not found`);
    // Re-checked against the request's grants, not against the referral's own
    // organization: a family member belongs to no organization at all.
    if (!user.caseAccess.some((a) => a.caseId === referral.caseId)) {
      throw new NotFoundException(`Referral ${referralId} not found`);
    }
    return referral;
  }
}
