import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { SupabaseService } from "../auth/supabase.service";
import type { ConfigService } from "@nestjs/config";
import type { RequestUser } from "../auth/request-user";
import type { AppConfig } from "../../config/configuration";
import { PERMISSIONS, ROLES } from "../../common/rbac";
import type { InviteUserDto } from "./dto/user.dto";
import type { UserStatus } from "@prisma/client";

function providerAdmin(): RequestUser {
  return {
    id: "admin-1",
    supabaseUserId: "sb-admin",
    email: "admin@prov.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    activeOrganizationId: "prov",
    activePermissions: new Set([PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION, PERMISSIONS.USERS_READ]),
  };
}

function makeDeps() {
  const audit = { record: jest.fn() } as unknown as AuditService;
  const supabase = { inviteByEmail: jest.fn().mockResolvedValue({ supabaseUserId: "sb-new" }) } as unknown as SupabaseService;
  const config = { get: jest.fn().mockReturnValue("http://localhost:3001") } as unknown as ConfigService<AppConfig, true>;
  return { audit, supabase, config };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const membership = {
    id: "mem",
    userId: "target",
    organizationId: "prov",
    status: "ACTIVE",
    isPrimary: false,
    organization: { name: "Provider Co" },
    role: { code: ROLES.PROVIDER_STAFF, name: "Provider Staff" },
  };
  const targetUser = {
    id: "target",
    email: "t@x.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  const p: Record<string, unknown> = {
    // A real Organization always carries a type; role compatibility is checked against it.
    organization: { findUnique: jest.fn().mockResolvedValue({ id: "prov", status: "ACTIVE", type: "PROVIDER" }) },
    role: { findUnique: jest.fn().mockResolvedValue({ id: "role-x", code: ROLES.PROVIDER_STAFF, name: "Provider Staff" }), findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "newuser" }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue(targetUser),
    },
    organizationMembership: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(membership),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([membership]),
    },
    ...overrides,
  };
  p.$transaction = jest.fn().mockImplementation((cb: (t: unknown) => unknown) => cb(p));
  return p as unknown as PrismaService;
}

function service(prisma: PrismaService) {
  const { audit, supabase, config } = makeDeps();
  return { svc: new UsersService(prisma, audit, supabase, config), audit, supabase };
}

const inviteDto = (over: Partial<InviteUserDto> = {}): InviteUserDto => ({
  email: "new@prov.com",
  organizationId: "prov",
  roleCode: ROLES.PROVIDER_STAFF,
  ...over,
});

describe("UsersService — invitation & role escalation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prevents a provider admin from assigning a Nonnis admin role", async () => {
    const { svc } = service(makePrisma());
    await expect(svc.invite(providerAdmin(), inviteDto({ roleCode: ROLES.NONNIS_ADMIN }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("prevents inviting into an organization the admin does not manage", async () => {
    const { svc } = service(makePrisma());
    await expect(svc.invite(providerAdmin(), inviteDto({ organizationId: "other-org" }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects inviting into an inactive organization", async () => {
    const prisma = makePrisma({ organization: { findUnique: jest.fn().mockResolvedValue({ id: "prov", status: "INACTIVE" }) } });
    const { svc } = service(prisma);
    await expect(svc.invite(providerAdmin(), inviteDto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it("invites a provider-scoped user: records audit and issues a Supabase invite", async () => {
    const { svc, audit, supabase } = service(makePrisma());
    const result = await svc.invite(providerAdmin(), inviteDto());
    expect(result.status).toBe("INVITED");
    expect(result.userId).toBe("newuser");
    expect(supabase.inviteByEmail).toHaveBeenCalledWith("new@prov.com", expect.stringContaining("/auth/callback"));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "user.invited" }), expect.anything());
  });

  it("prevents a provider admin from promoting a member to a Nonnis role", async () => {
    const { svc } = service(makePrisma());
    await expect(
      svc.changeMembershipRole(providerAdmin(), "target", "mem", { roleCode: ROLES.NONNIS_ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("UsersService — status changes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prevents managing a user whose role is above the actor's authority", async () => {
    const prisma = makePrisma({
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({
          id: "mem",
          userId: "target",
          organizationId: "prov",
          status: "ACTIVE",
          isPrimary: false,
          organization: { name: "Provider Co" },
          role: { code: ROLES.NONNIS_ADMIN, name: "Nonnis Administrator" },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const { svc } = service(prisma);
    await expect(svc.setStatus(providerAdmin(), "target", "SUSPENDED" as UserStatus)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("prevents an admin from changing their own status", async () => {
    const { svc } = service(makePrisma());
    await expect(svc.setStatus(providerAdmin(), "admin-1", "SUSPENDED" as UserStatus)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("suspends a manageable member and writes an audit event", async () => {
    const { svc, audit } = service(makePrisma());
    await svc.setStatus(providerAdmin(), "target", "SUSPENDED" as UserStatus);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "user.suspended" }));
  });
});

describe("role must fit the organization type", () => {
  /** A Nonnis administrator, who may assign any role. */
  function nonnisAdmin(): RequestUser {
    return {
      ...providerAdmin(),
      id: "nonnis-1",
      activeOrganizationId: "nonnis",
      activePermissions: new Set([PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_READ]),
    };
  }

  function prismaForOrg(type: string, roleCode: string) {
    return makePrisma({
      organization: { findUnique: jest.fn().mockResolvedValue({ id: "org", status: "ACTIVE", type }) },
      role: { findUnique: jest.fn().mockResolvedValue({ id: "r", code: roleCode, name: roleCode }), findMany: jest.fn().mockResolvedValue([]) },
    });
  }

  const VALID: Array<[string, string]> = [
    [ROLES.NONNIS_ADMIN, "NONNIS"],
    [ROLES.NONNIS_OPERATIONS, "NONNIS"],
    [ROLES.DISCHARGE_PROFESSIONAL, "HOSPITAL"],
    [ROLES.DISCHARGE_PROFESSIONAL, "REHABILITATION_CENTER"],
    [ROLES.DISCHARGE_PROFESSIONAL, "SKILLED_NURSING_FACILITY"],
    [ROLES.DISCHARGE_PROFESSIONAL, "PARTNER"],
    [ROLES.PROVIDER_ADMIN, "PROVIDER"],
    [ROLES.PROVIDER_STAFF, "PROVIDER"],
  ];

  const INVALID: Array<[string, string]> = [
    [ROLES.PROVIDER_ADMIN, "HOSPITAL"],
    [ROLES.PROVIDER_ADMIN, "NONNIS"],
    [ROLES.PROVIDER_STAFF, "SKILLED_NURSING_FACILITY"],
    [ROLES.PROVIDER_STAFF, "PARTNER"],
    [ROLES.NONNIS_ADMIN, "PROVIDER"],
    [ROLES.NONNIS_ADMIN, "HOSPITAL"],
    [ROLES.NONNIS_OPERATIONS, "PARTNER"],
    [ROLES.DISCHARGE_PROFESSIONAL, "PROVIDER"],
    [ROLES.DISCHARGE_PROFESSIONAL, "NONNIS"],
  ];

  it.each(VALID)("invite: accepts %s into a %s organization", async (roleCode, orgType) => {
    const prisma = prismaForOrg(orgType, roleCode);
    const { svc } = service(prisma);
    await expect(svc.invite(nonnisAdmin(), inviteDto({ organizationId: "org", roleCode }))).resolves.toMatchObject({ roleCode });
  });

  it.each(INVALID)("invite: rejects %s in a %s organization with a 400", async (roleCode, orgType) => {
    const prisma = prismaForOrg(orgType, roleCode);
    const { svc } = service(prisma);
    await expect(svc.invite(nonnisAdmin(), inviteDto({ organizationId: "org", roleCode }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("invite: never creates a membership for a rejected pairing", async () => {
    const prisma = prismaForOrg("HOSPITAL", ROLES.PROVIDER_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "org", roleCode: ROLES.PROVIDER_ADMIN })),
    ).rejects.toBeInstanceOf(BadRequestException);
    const memberships = (prisma as unknown as { organizationMembership: { create: jest.Mock } }).organizationMembership;
    expect(memberships.create).not.toHaveBeenCalled();
  });

  function prismaForRoleChange(orgType: string, currentRole: string, newRole: string) {
    return makePrisma({
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          id: "mem",
          userId: "target",
          organizationId: "nonnis",
          role: { code: currentRole, name: currentRole },
          organization: { type: orgType },
        }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: "r2", code: newRole, name: newRole }), findMany: jest.fn().mockResolvedValue([]) },
    });
  }

  it("role change: accepts a role valid for the membership's organization", async () => {
    const prisma = prismaForRoleChange("NONNIS", ROLES.NONNIS_OPERATIONS, ROLES.NONNIS_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.changeMembershipRole(nonnisAdmin(), "target", "mem", { roleCode: ROLES.NONNIS_ADMIN }),
    ).resolves.toBeDefined();
  });

  it("role change: rejects a role that does not fit the membership's organization", async () => {
    // The organization of a membership cannot change, so a provider role can
    // never become valid here — this is a 400, not a permission problem.
    const prisma = prismaForRoleChange("NONNIS", ROLES.NONNIS_OPERATIONS, ROLES.PROVIDER_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.changeMembershipRole(nonnisAdmin(), "target", "mem", { roleCode: ROLES.PROVIDER_ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const memberships = (prisma as unknown as { organizationMembership: { update: jest.Mock } }).organizationMembership;
    expect(memberships.update).not.toHaveBeenCalled();
  });

  it("exposes the allowed organization types alongside each assignable role", async () => {
    const prisma = makePrisma({
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ code: ROLES.PROVIDER_ADMIN, name: "Provider Administrator" }]),
      },
    });
    const { svc } = service(prisma);
    await expect(svc.assignableRoles(providerAdmin())).resolves.toEqual([
      { code: ROLES.PROVIDER_ADMIN, name: "Provider Administrator", allowedOrganizationTypes: ["PROVIDER"] },
    ]);
  });
});
