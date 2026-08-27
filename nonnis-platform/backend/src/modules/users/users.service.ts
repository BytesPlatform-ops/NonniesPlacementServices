import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { assignableRoleCodes, PERMISSIONS } from "../../common/rbac";
import type { AppConfig } from "../../config/configuration";
import { AuditService } from "../audit/audit.service";
import { SupabaseService } from "../auth/supabase.service";
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
}

const membershipInclude = { organization: true, role: true } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async list(actor: RequestUser, query: ListUsersQueryDto): Promise<PaginatedResult<UserListItem>> {
    const organizationId = requireActiveOrganization(actor);
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

    const where = { organizationId, ...(Object.keys(userFilter).length ? { user: userFilter } : {}) };

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
    const organizationId = requireActiveOrganization(actor);
    const inOrg = await this.prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId },
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

  /** Roles the actor is permitted to assign (for safe UI role options). */
  async assignableRoles(actor: RequestUser): Promise<Array<{ code: string; name: string }>> {
    const codes = assignableRoleCodes(actor.activePermissions);
    const roles = await this.prisma.role.findMany({ where: { code: { in: codes } }, orderBy: { code: "asc" } });
    return roles.map((r) => ({ code: r.code, name: r.name }));
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

    // External invite — cannot participate in the DB transaction.
    const redirectTo = `${this.config.get("frontendUrl", { infer: true })}/auth/callback`;
    try {
      const { supabaseUserId } = await this.supabase.inviteByEmail(email, redirectTo);
      await this.prisma.user.updateMany({
        where: { id: userId, supabaseAuthUserId: null },
        data: { supabaseAuthUserId: supabaseUserId },
      });
    } catch {
      // The pending invite record is consistent; surface the failure (not silent) so it can be retried.
      throw new ServiceUnavailableException(
        "The invitation was recorded, but the invite email could not be sent. Please retry.",
      );
    }

    return { userId, email, organizationId, roleCode: dto.roleCode, status: "INVITED" };
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

  async changeMembershipRole(
    actor: RequestUser,
    userId: string,
    membershipId: string,
    dto: ChangeMembershipRoleDto,
  ): Promise<UserDetailView> {
    const organizationId = requireActiveOrganization(actor);
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { id: membershipId, userId, organizationId },
      include: { role: true },
    });
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }

    const assignable = assignableRoleCodes(actor.activePermissions) as string[];
    if (!assignable.includes(membership.role.code) || !assignable.includes(dto.roleCode)) {
      throw new ForbiddenException("You cannot assign this role.");
    }
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
    const organizationId = requireActiveOrganization(actor);
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId: targetUserId, organizationId },
      include: { role: true },
    });
    if (!membership) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }
    const assignable = assignableRoleCodes(actor.activePermissions) as string[];
    if (!assignable.includes(membership.role.code)) {
      throw new ForbiddenException("You cannot manage a user with this role.");
    }
    return organizationId;
  }
}
