import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { MembershipContext, RequestUser } from "./request-user";
import type { VerifiedIdentity } from "./token-verifier";

const userWithAccessInclude = {
  memberships: {
    include: {
      organization: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
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
      activeOrganizationId: active?.organizationId ?? null,
      activePermissions: new Set(active?.permissions ?? []),
    };
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

    if (needsUserActivation || invitedMembershipIds.length > 0) {
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
      });
      user = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: userWithAccessInclude,
      });
    }

    return user;
  }
}
