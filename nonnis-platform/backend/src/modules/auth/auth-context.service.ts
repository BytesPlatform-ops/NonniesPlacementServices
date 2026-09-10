import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CaseAccessContext, MembershipContext, RequestUser } from "./request-user";
import type { VerifiedIdentity } from "./token-verifier";

const userWithAccessInclude = {
  memberships: {
    include: {
      organization: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
    // Ordered so the membership list is stable across requests. Without this,
    // Postgres returns rows in whatever order it likes, and a multi-membership
    // user with no stored choice could be dropped into a different organization
    // — and so a different landing page — on each first sign-in.
    //
    // `isPrimary` first because that flag exists precisely to name the default.
    // `createdAt` then `id` break the remaining ties: `createdAt` is the
    // meaningful order (longest-standing membership wins) and `id` guarantees
    // determinism even for rows created in the same transaction.
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
  },
  // Case-scoped grants for family members. Loaded for every user because the
  // query is bounded by userId and an organization user simply has none — a
  // conditional include would branch the hot path for no benefit.
  //
  // Ordered oldest-first so the portal's default case is stable across
  // requests, for the same reason memberships are ordered.
  careSeekerAccess: {
    include: { case: { include: { patient: true } }, role: { include: { permissions: { include: { permission: true } } } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccessInclude }>;

/**
 * Resolves a verified external identity into an application RequestUser,
 * including safe just-in-time provisioning of invited users and validation of
 * the requested active-organization context.
 */
@Injectable()
export class AuthContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(identity: VerifiedIdentity, requestedOrganizationId?: string | null): Promise<RequestUser | null> {
    const user = await this.loadOrProvision(identity);
    if (!user) return null; // authenticated but not provisioned → no access

    // Only an ACTIVE user with ACTIVE membership in an ACTIVE organization has access.
    const usable =
      user.status === "ACTIVE"
        ? user.memberships.filter((m) => m.status === "ACTIVE" && m.organization.status === "ACTIVE")
        : [];

    const memberships: MembershipContext[] = usable.map((m) => ({
      membershipId: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationType: m.organization.type,
      organizationStatus: m.organization.status,
      roleId: m.roleId,
      roleCode: m.role.code,
      roleName: m.role.name,
      isPrimary: m.isPrimary,
      permissions: m.role.permissions.map((rp) => rp.permission.code),
    }));

    // Only an ACTIVE user with an ACTIVE grant on a live case has family access.
    // A case that has been cancelled or completed stops being reachable, which
    // matches how staff writes are already refused on those statuses.
    const usableCaseAccess =
      user.status === "ACTIVE"
        ? user.careSeekerAccess.filter(
            (a) => a.status === "ACTIVE" && a.case.status !== "CANCELLED",
          )
        : [];

    const caseAccess: CaseAccessContext[] = usableCaseAccess.map((a) => ({
      accessId: a.id,
      caseId: a.caseId,
      caseNumber: a.case.caseNumber,
      careRecipientName: `${a.case.patient.firstName} ${a.case.patient.lastName}`.trim(),
      relationship: a.relationship,
      roleCode: a.role.code,
      roleName: a.role.name,
      permissions: a.role.permissions.map((rp) => rp.permission.code),
    }));

    const active = this.resolveActive(memberships, requestedOrganizationId);

    return {
      id: user.id,
      supabaseUserId: identity.supabaseUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      status: user.status,
      memberships,
      caseAccess,
      activeOrganizationId: active?.organizationId ?? null,
      activePermissions: new Set(active?.permissions ?? this.caseAccessPermissions(memberships, caseAccess)),
    };
  }

  /**
   * Permissions for a request with no active organization.
   *
   * Deliberately narrow: it returns something only when the user has NO
   * organization membership at all. An organization user who simply did not
   * send X-Organization-Id keeps their existing empty permission set and the
   * 400 that follows — that behaviour is relied on by the multi-organization
   * flow and is not changed here.
   *
   * Every grant carries the same CARE_SEEKER role today, so the union is that
   * role's permissions. Which CASE may be read is a separate, row-level
   * decision made per request by `ensureSeekerCaseAccess`.
   */
  private caseAccessPermissions(
    memberships: MembershipContext[],
    caseAccess: CaseAccessContext[],
  ): string[] | null {
    if (memberships.length > 0 || caseAccess.length === 0) return null;
    return [...new Set(caseAccess.flatMap((a) => a.permissions))];
  }

  private resolveActive(
    memberships: MembershipContext[],
    requestedOrganizationId?: string | null,
  ): MembershipContext | null {
    if (requestedOrganizationId) {
      const match = memberships.find((m) => m.organizationId === requestedOrganizationId);
      if (!match) {
        throw new ForbiddenException("You are not a member of the requested organization.");
      }
      return match;
    }
    return memberships.length === 1 ? memberships[0]! : null;
  }

  private async loadOrProvision(identity: VerifiedIdentity): Promise<UserWithAccess | null> {
    let user = await this.prisma.user.findUnique({
      where: { supabaseAuthUserId: identity.supabaseUserId },
      include: userWithAccessInclude,
    });

    // Link an invited (unlinked) application user by email on first sign-in.
    if (!user && identity.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: identity.email.toLowerCase() },
        include: userWithAccessInclude,
      });
      if (byEmail && byEmail.supabaseAuthUserId === null) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { supabaseAuthUserId: identity.supabaseUserId },
          include: userWithAccessInclude,
        });
      }
    }

    if (!user) return null;

    // Accept the invitation on first authenticated request.
    const needsUserActivation = user.status === "INVITED";
    const invitedMembershipIds = user.memberships.filter((m) => m.status === "INVITED").map((m) => m.id);

    // A family member's invitation lives on the grant, not on a membership, so
    // it has to be accepted here too — otherwise the user activates, the grant
    // stays INVITED, `resolveActive` finds no usable case access, and someone
    // who just set their password is shown "no organization access".
    //
    // A grant on a cancelled case is deliberately left pending: the case is no
    // longer something to open, and accepting it would create access to a
    // closed case that `resolve` then has to filter out anyway.
    //
    // Every pending grant the user holds is accepted, not only one. Each was
    // created by a separate deliberate act by staff on a specific case, so
    // there is no basis for accepting one invitation and holding the others
    // back — and a relative invited to two cases would otherwise have to be
    // re-invited to see the second.
    const invitedGrantIds = user.careSeekerAccess
      .filter((a) => a.status === "INVITED" && a.case.status !== "CANCELLED")
      .map((a) => a.id);

    if (needsUserActivation || invitedMembershipIds.length > 0 || invitedGrantIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        if (needsUserActivation) {
          await tx.user.update({ where: { id: user!.id }, data: { status: "ACTIVE" } });
        }
        if (invitedMembershipIds.length > 0) {
          await tx.organizationMembership.updateMany({
            where: { id: { in: invitedMembershipIds } },
            data: { status: "ACTIVE", joinedAt: new Date() },
          });
        }
        if (invitedGrantIds.length > 0) {
          // `userId` and `status` are repeated in the filter on purpose. The ids
          // were read a moment ago; re-stating both means a grant revoked in
          // between, or one that somehow belongs to anyone else, cannot be
          // activated by this write.
          await tx.careSeekerCaseAccess.updateMany({
            where: { id: { in: invitedGrantIds }, userId: user!.id, status: "INVITED" },
            data: { status: "ACTIVE" },
          });
        }
      });
      user = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: userWithAccessInclude,
      });
    }

    return user;
  }
}
