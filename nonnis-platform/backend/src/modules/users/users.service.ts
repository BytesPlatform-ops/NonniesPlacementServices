import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { type UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS, ROLE_ALLOWED_ORGANIZATION_TYPES, assignableRoleCodes, isRoleAllowedForOrganizationType, roleOrganizationTypeError } from "../../common/rbac";
import type { RoleCode } from "../../common/rbac";
import { AuditService } from "../audit/audit.service";
import { SupabaseService } from "../auth/supabase.service";
import { InvitationEmailError, InvitationService, type InvitationEmailKind } from "../auth/invitation.service";
import { requireActiveOrganization } from "../auth/org-context";
import type { RequestUser } from "../auth/request-user";
import {
  toMembershipView,
  toUserDetailView,
  toUserView,
  type MembershipView,
  type UserDetailView,
  type UserView,
} from "./users.serializer";
import type {
  ChangeMembershipRoleDto,
  InviteUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from "./dto/user.dto";

export interface UserListItem extends UserView {
  membership: MembershipView;
}

export interface InviteResult {
  userId: string;
  email: string;
  organizationId: string;
  roleCode: string;
  status: "INVITED";
  /** Which email was sent — an invitation, or a password-setup link for an
   *  address that is already registered. */
  emailKind: InvitationEmailKind;
}

const membershipInclude = { organization: true, role: true } as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
    private readonly invitations: InvitationService,
  ) {}

  async list(actor: RequestUser, query: ListUsersQueryDto): Promise<PaginatedResult<UserListItem>> {
    const organizationId = this.resolveReadableOrg(actor, query.organizationId);
    const { page, pageSize, q, status } = query;

    const userFilter = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(Object.keys(userFilter).length ? { user: userFilter } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.organizationMembership.findMany({
        where,
        include: { ...membershipInclude, user: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organizationMembership.count({ where }),
    ]);

    return {
      items: rows.map((m) => ({ ...toUserView(m.user), membership: toMembershipView(m) })),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findOne(actor: RequestUser, id: string): Promise<UserDetailView> {
    const organizationId = this.resolveReadableOrg(actor);
    const inOrg = await this.prisma.organizationMembership.findFirst({
      where: { userId: id, ...(organizationId ? { organizationId } : {}) },
      include: membershipInclude,
    });
    if (!inOrg) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const isPlatform = actor.activePermissions.has(PERMISSIONS.USERS_MANAGE);
    const memberships = isPlatform
      ? await this.prisma.organizationMembership.findMany({ where: { userId: id }, include: membershipInclude })
      : [inOrg];

    return toUserDetailView(user, memberships);
  }

  /**
   * Roles the actor is permitted to assign, each carrying the organization types
   * it is valid in.
   *
   * The types travel with the role so the UI can hide an incompatible option
   * using the same rules the server enforces, instead of keeping its own copy
   * that can drift out of step with them.
   */
  async assignableRoles(
    actor: RequestUser,
  ): Promise<Array<{ code: string; name: string; allowedOrganizationTypes: string[] }>> {
    const codes = assignableRoleCodes(actor.activePermissions);
    const roles = await this.prisma.role.findMany({ where: { code: { in: codes } }, orderBy: { code: "asc" } });
    return roles.map((r) => ({
      code: r.code,
      name: r.name,
      allowedOrganizationTypes: [...(ROLE_ALLOWED_ORGANIZATION_TYPES[r.code as RoleCode] ?? [])],
    }));
  }

  async invite(actor: RequestUser, dto: InviteUserDto): Promise<InviteResult> {
    const organizationId = this.resolveManageableOrg(actor, dto.organizationId);

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new BadRequestException("Target organization does not exist.");
    }
    if (org.status !== "ACTIVE") {
      throw new BadRequestException("Cannot invite into an inactive organization.");
    }

    this.assertAssignable(actor, dto.roleCode);
    this.assertRoleFitsOrganization(dto.roleCode, org.type);
    const role = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
    if (!role) {
      throw new BadRequestException("Unknown role.");
    }

    const email = dto.email.toLowerCase();

    // Database writes are atomic; the external Supabase invite happens after.
    const userId = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            displayName: dto.displayName,
            status: "INVITED",
          },
        });
      }

      const existing = await tx.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
      });
      if (existing && existing.status === "ACTIVE") {
        throw new ConflictException("User is already an active member of this organization.");
      }
      if (existing) {
        await tx.organizationMembership.update({
          where: { id: existing.id },
          data: { roleId: role.id, status: "INVITED", invitedAt: new Date() },
        });
      } else {
        await tx.organizationMembership.create({
          data: { userId: user.id, organizationId, roleId: role.id, status: "INVITED", invitedAt: new Date() },
        });
      }

      await this.audit.record(
        {
          action: "user.invited",
          entityType: "User",
          entityId: user.id,
          organizationId,
          actorUserId: actor.id,
          metadata: { email, roleCode: dto.roleCode },
        },
        tx,
      );
      await this.audit.record(
        {
          action: "membership.created",
          entityType: "OrganizationMembership",
          entityId: user.id,
          organizationId,
          actorUserId: actor.id,
          metadata: { roleCode: dto.roleCode },
        },
        tx,
      );

      return user.id;
    });

    // External invite — cannot participate in the DB transaction. The pending
    // record stays consistent either way, and a failure is surfaced rather than
    // swallowed so it can be resent.
    const emailKind = await this.sendInvitationEmail(
      userId,
      email,
      "The invitation was recorded, but the email",
    );

    return { userId, email, organizationId, roleCode: dto.roleCode, status: "INVITED", emailKind };
  }

  /**
   * Sends the invitation email again for a user who has not accepted yet.
   *
   * Necessary because the first send can fail on its own (a provider rate
   * limit) and because an invitation that did arrive and was ignored cannot be
   * re-issued as an invitation at all — the address is registered by then. The
   * shared invitation service picks the email that will actually go out.
   */
  async resendInvitation(
    actor: RequestUser,
    id: string,
  ): Promise<{ userId: string; email: string; emailKind: InvitationEmailKind }> {
    const organizationId = await this.assertManageableTarget(actor, id);
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, status: true } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (user.status !== "INVITED") {
      throw new BadRequestException("This user has already accepted their invitation.");
    }

    const emailKind = await this.sendInvitationEmail(user.id, user.email, "The invitation email");
    await this.audit.record({
      action: "user.invitation_resent",
      entityType: "User",
      entityId: user.id,
      organizationId,
      actorUserId: actor.id,
      metadata: { email: user.email, emailKind },
    });

    return { userId: user.id, email: user.email, emailKind };
  }

  /**
   * Sends an invitation email and turns a failure into something the person who
   * pressed the button can act on. `prefix` completes the sentence, so the
   * distinction that matters — a rate limit is waited out, a broken sender is
   * not — reads the same wherever an invitation is sent from.
   */
  private async sendInvitationEmail(userId: string, email: string, prefix: string): Promise<InvitationEmailKind> {
    try {
      return await this.invitations.send(userId, email);
    } catch (error) {
      if (error instanceof InvitationEmailError) {
        throw new ServiceUnavailableException(
          error.rateLimited
            ? `${prefix} was not sent: the email provider's sending rate limit was reached. Wait a few minutes and try again.`
            : `${prefix} could not be sent. Please retry.`,
        );
      }
      throw error;
    }
  }

  async updateProfile(actor: RequestUser, id: string, dto: UpdateUserDto): Promise<UserDetailView> {
    await this.assertManageableTarget(actor, id);
    await this.prisma.user.update({
      where: { id },
      data: { firstName: dto.firstName, lastName: dto.lastName, displayName: dto.displayName },
    });
    await this.audit.record({
      action: "user.updated",
      entityType: "User",
      entityId: id,
      organizationId: actor.activeOrganizationId ?? undefined,
      actorUserId: actor.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.findOne(actor, id);
  }

  async setStatus(actor: RequestUser, id: string, status: UserStatus): Promise<UserDetailView> {
    const organizationId = await this.assertManageableTarget(actor, id);
    if (id === actor.id) {
      throw new BadRequestException("You cannot change your own status.");
    }
    await this.prisma.user.update({ where: { id }, data: { status } });
    const action =
      status === "SUSPENDED" ? "user.suspended" : status === "ACTIVE" ? "user.reactivated" : "user.deactivated";
    await this.audit.record({
      action,
      entityType: "User",
      entityId: id,
      organizationId,
      actorUserId: actor.id,
      metadata: { status },
    });
    return this.findOne(actor, id);
  }

  /**
   * Permanently remove a user account, sign-in identity included.
   *
   * Deleting the Supabase identity is as much the point as the row: an address
   * that is still registered cannot be invited again, so an account cleared out
   * of our tables alone would leave the invitation permanently unrepeatable.
   *
   * An ACTIVE user is refused. Suspension is reversible and this is not, so the
   * destructive step is only reachable from a state someone chose deliberately
   * (invited, suspended or deactivated) — which is also the state a pending or
   * finished test account is already in.
   */
  async deleteUser(actor: RequestUser, id: string): Promise<{ id: string }> {
    const organizationId = await this.assertManageableTarget(actor, id);
    if (id === actor.id) {
      throw new BadRequestException("You cannot delete your own account.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        supabaseAuthUserId: true,
        _count: { select: { memberships: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (user.status === "ACTIVE") {
      throw new BadRequestException(
        "Suspend or deactivate this user before deleting the account.",
      );
    }
    // A user row is global, so removing it also ends memberships in
    // organizations the actor may not manage. An organization-scoped manager is
    // therefore confined to someone who belongs only to theirs.
    if (user._count.memberships > 1 && !actor.activePermissions.has(PERMISSIONS.USERS_MANAGE)) {
      throw new ForbiddenException(
        "This user also belongs to another organization, so only a platform administrator can delete the account.",
      );
    }

    // The identity goes first: were it to survive a failed row delete, the
    // address would stay unusable for a new invitation, which is the whole
    // reason for deleting rather than deactivating. Re-running this after a
    // partial failure is harmless — an identity that is already gone is not an
    // error.
    if (user.supabaseAuthUserId) {
      try {
        await this.supabase.deleteAuthUser(user.supabaseAuthUserId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        this.logger.warn(`Sign-in identity for user ${id} was not removed: ${reason}`);
        throw new ServiceUnavailableException(
          "The sign-in identity could not be removed, so the account was left in place. Please retry.",
        );
      }
    }

    // Memberships and this user's own case-access grants cascade away with the
    // row; case assignments and audit/workflow actors are nulled instead, so
    // the record of what happened outlives the account it happened under. The
    // audit event is written in the same transaction as the delete, and names
    // the email because the row that held it is about to be gone.
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(
        {
          action: "user.deleted",
          entityType: "User",
          entityId: id,
          organizationId,
          actorUserId: actor.id,
          metadata: { email: user.email, status: user.status },
        },
        tx,
      );
      await tx.user.delete({ where: { id } });
    });

    return { id: user.id };
  }

  async changeMembershipRole(
    actor: RequestUser,
    userId: string,
    membershipId: string,
    dto: ChangeMembershipRoleDto,
  ): Promise<UserDetailView> {
    const organizationId = requireActiveOrganization(actor);
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { id: membershipId, userId, organizationId },
      include: { role: true, organization: { select: { type: true } } },
    });
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }

    const assignable = assignableRoleCodes(actor.activePermissions) as string[];
    if (!assignable.includes(membership.role.code) || !assignable.includes(dto.roleCode)) {
      throw new ForbiddenException("You cannot assign this role.");
    }
    // The organization a membership belongs to cannot change, so the new role
    // has to fit the organization the membership is already in.
    this.assertRoleFitsOrganization(dto.roleCode, membership.organization.type);
    const newRole = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
    if (!newRole) {
      throw new BadRequestException("Unknown role.");
    }

    await this.prisma.organizationMembership.update({ where: { id: membershipId }, data: { roleId: newRole.id } });
    await this.audit.record({
      action: "membership.role_changed",
      entityType: "OrganizationMembership",
      entityId: membershipId,
      organizationId,
      actorUserId: actor.id,
      metadata: { userId, from: membership.role.code, to: dto.roleCode },
    });
    return this.findOne(actor, userId);
  }

  // ---- authorization helpers ----

  /**
   * Rejects a role that does not belong in this organization type.
   *
   * Separate from `assertAssignable`, which asks whether the *actor* may hand
   * out the role at all. This asks whether the role makes sense where it is
   * going — a distinct question with a distinct answer (400, not 403).
   */
  private assertRoleFitsOrganization(roleCode: string, organizationType: string): void {
    if (!isRoleAllowedForOrganizationType(roleCode, organizationType)) {
      throw new BadRequestException(roleOrganizationTypeError(roleCode, organizationType));
    }
  }

  /**
   * The organization a read is bounded by, or `null` for "every organization".
   *
   * The read counterpart of `resolveManageableOrg`, and it follows the same
   * rule that has always governed writes: a platform user manager acts across
   * organizations, everyone else is confined to their own active one. Without
   * it the list could only ever show the manager's own organization, so a
   * provider user invited from here would be invisible immediately afterwards.
   *
   * A requested id from a non-manager is ignored rather than rejected — they
   * are simply bounded to their own organization, exactly as before.
   */
  private resolveReadableOrg(actor: RequestUser, requestedOrganizationId?: string): string | null {
    if (actor.activePermissions.has(PERMISSIONS.USERS_MANAGE)) {
      return requestedOrganizationId ?? null;
    }
    return requireActiveOrganization(actor);
  }

  private resolveManageableOrg(actor: RequestUser, requestedOrganizationId: string): string {
    if (actor.activePermissions.has(PERMISSIONS.USERS_MANAGE)) {
      return requestedOrganizationId; // platform manager: any organization
    }
    const active = requireActiveOrganization(actor);
    if (requestedOrganizationId !== active) {
      throw new ForbiddenException("You can only manage users within your own organization.");
    }
    return active;
  }

  private assertAssignable(actor: RequestUser, roleCode: string): void {
    const assignable = assignableRoleCodes(actor.activePermissions) as string[];
    if (!assignable.includes(roleCode)) {
      throw new ForbiddenException("You are not permitted to assign this role.");
    }
  }

  /**
   * Verifies the target user is a member of the actor's active organization AND
   * that the actor is permitted to manage that user's role (escalation guard).
   * Returns the organization id.
   */
  private async assertManageableTarget(actor: RequestUser, targetUserId: string): Promise<string> {
    const organizationId = this.resolveReadableOrg(actor);
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId: targetUserId, ...(organizationId ? { organizationId } : {}) },
      include: { role: true },
    });
    if (!membership) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }
    const assignable = assignableRoleCodes(actor.activePermissions) as string[];
    if (!assignable.includes(membership.role.code)) {
      throw new ForbiddenException("You cannot manage a user with this role.");
    }
    // The organization the action is attributed to: for a platform manager that
    // is the target's own organization, not the manager's.
    return membership.organizationId;
  }
}
