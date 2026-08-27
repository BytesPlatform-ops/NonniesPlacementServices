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
    organization: { findUnique: jest.fn().mockResolvedValue({ id: "prov", status: "ACTIVE" }) },
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
