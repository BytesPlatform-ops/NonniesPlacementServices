import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { UsersService } from "./users.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { SupabaseService } from "../auth/supabase.service";
import { InvitationEmailError, type InvitationService } from "../auth/invitation.service";
import type { RequestUser } from "../auth/request-user";
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
    caseAccess: [],
    activeOrganizationId: "prov",
    activePermissions: new Set([PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION, PERMISSIONS.USERS_READ]),
  };
}

function makeDeps() {
  const audit = { record: jest.fn() } as unknown as AuditService;
  const supabase = {
    inviteByEmail: jest.fn().mockResolvedValue({ supabaseUserId: "sb-new" }),
    deleteAuthUser: jest.fn().mockResolvedValue(true),
  } as unknown as SupabaseService;
  const invitations = { send: jest.fn().mockResolvedValue("INVITE") } as unknown as InvitationService;
  return { audit, supabase, invitations };
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
  const { audit, supabase, invitations } = makeDeps();
  return { svc: new UsersService(prisma, audit, supabase, invitations), audit, supabase, invitations };
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
    const { svc, audit, invitations } = service(makePrisma());
    const result = await svc.invite(providerAdmin(), inviteDto());
    expect(result.status).toBe("INVITED");
    expect(result.userId).toBe("newuser");
    expect(invitations.send).toHaveBeenCalledWith("newuser", "new@prov.com");
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

// ---------------------------------------------------------------------------
// Onboarding a provider organization's FIRST administrator
//
// The backend has always allowed this — `resolveManageableOrg` lets a platform
// user manager invite into any organization — but the admin UI had no
// organization selector, so it could only ever invite into the manager's own.
// These cover the path the new selector uses.
// ---------------------------------------------------------------------------

/** A Nonnis administrator: platform-wide user management, own org is NONNIS. */
function nonnisAdmin(): RequestUser {
  return {
    id: "nonnis-1",
    supabaseUserId: "sb-nonnis",
    email: "admin@nonnis.local",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    caseAccess: [],
    activeOrganizationId: "nonnis",
    activePermissions: new Set([PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_READ]),
  };
}

/** Prisma double whose organization lookup answers per organization id. */
function crossOrgPrisma(orgs: Record<string, { status: string; type: string }>, roleCode: string) {
  return makePrisma({
    organization: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const org = orgs[where.id];
        return Promise.resolve(org ? { id: where.id, ...org } : null);
      }),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: `role-${roleCode}`, code: roleCode, name: roleCode }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  });
}

const ORGS = {
  nonnis: { status: "ACTIVE", type: "NONNIS" },
  prov: { status: "ACTIVE", type: "PROVIDER" },
  hospital: { status: "ACTIVE", type: "HOSPITAL" },
  "prov-off": { status: "INACTIVE", type: "PROVIDER" },
};

describe("UsersService — cross-organization onboarding", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lets a platform user manager invite the first PROVIDER_ADMIN into a provider organization", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.PROVIDER_ADMIN);
    const { svc, invitations } = service(prisma);

    const result = await svc.invite(
      nonnisAdmin(),
      inviteDto({ organizationId: "prov", roleCode: ROLES.PROVIDER_ADMIN, email: "first@prov.com" }),
    );

    expect(result.organizationId).toBe("prov");
    expect(result.roleCode).toBe(ROLES.PROVIDER_ADMIN);
    expect(result.status).toBe("INVITED");
    // The invitation email is the same one every other invite sends — which
    // email that is, and where it points, is the invitation service's own test.
    expect(invitations.send).toHaveBeenCalledWith("newuser", "first@prov.com");
  });

  it("still refuses a provider role in the Nonnis organization", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.PROVIDER_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "nonnis", roleCode: ROLES.PROVIDER_ADMIN })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("still refuses a Nonnis role in a provider organization", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.NONNIS_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "prov", roleCode: ROLES.NONNIS_ADMIN })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows a discharge professional in a referring organization", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.DISCHARGE_PROFESSIONAL);
    const { svc } = service(prisma);
    const result = await svc.invite(
      nonnisAdmin(),
      inviteDto({ organizationId: "hospital", roleCode: ROLES.DISCHARGE_PROFESSIONAL }),
    );
    expect(result.organizationId).toBe("hospital");
  });

  it("refuses CARE_SEEKER through the organization invite path", async () => {
    // Family access is granted per case, never by adding someone to an
    // organization — and CARE_SEEKER is valid in no organization type.
    const prisma = crossOrgPrisma(ORGS, ROLES.CARE_SEEKER);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "prov", roleCode: ROLES.CARE_SEEKER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses an inactive organization even for a platform manager", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.PROVIDER_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "prov-off", roleCode: ROLES.PROVIDER_ADMIN })),
    ).rejects.toThrow(/inactive organization/i);
  });

  it("refuses an organization that does not exist", async () => {
    const prisma = crossOrgPrisma(ORGS, ROLES.PROVIDER_ADMIN);
    const { svc } = service(prisma);
    await expect(
      svc.invite(nonnisAdmin(), inviteDto({ organizationId: "nope", roleCode: ROLES.PROVIDER_ADMIN })),
    ).rejects.toThrow(/does not exist/i);
  });

  it("keeps a provider admin confined to their own organization", async () => {
    // The provider-portal Team invite is unchanged by any of this.
    const prisma = crossOrgPrisma(ORGS, ROLES.PROVIDER_STAFF);
    const { svc } = service(prisma);
    await expect(
      svc.invite(providerAdmin(), inviteDto({ organizationId: "hospital", roleCode: ROLES.PROVIDER_STAFF })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

/**
 * `list()` pages with an array-form `$transaction` and a `count`, neither of
 * which the shared harness needs for the invite tests. Built here rather than
 * widening that harness for every unrelated case.
 */
function listPrisma() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = makePrisma({
    organizationMembership: {
      findMany,
      count,
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({
        id: "mem",
        organizationId: "prov",
        role: { code: ROLES.PROVIDER_STAFF, name: "Provider Staff" },
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
  }) as unknown as { $transaction: jest.Mock };
  prisma.$transaction = jest
    .fn()
    .mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(prisma),
    );
  return { prisma: prisma as unknown as PrismaService, findMany };
}

describe("UsersService — list and manage scope", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lets a platform manager narrow the list to one organization", async () => {
    const { prisma, findMany } = listPrisma();
    const { svc } = service(prisma);
    await svc.list(nonnisAdmin(), { page: 1, pageSize: 20, organizationId: "prov" });
    expect(findMany.mock.calls[0][0].where.organizationId).toBe("prov");
  });

  it("shows a platform manager every organization when no filter is given", async () => {
    // Without this a provider user invited from this screen would be invisible
    // the moment the invite succeeded.
    const { prisma, findMany } = listPrisma();
    const { svc } = service(prisma);
    await svc.list(nonnisAdmin(), { page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.organizationId).toBeUndefined();
  });

  it("keeps an organization-scoped manager bound to their own organization", async () => {
    const { prisma, findMany } = listPrisma();
    const { svc } = service(prisma);
    await svc.list(providerAdmin(), { page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.organizationId).toBe("prov");
  });

  it("ignores an organization filter from an organization-scoped manager", async () => {
    // Not an error — they are simply confined to their own organization, as before.
    const { prisma, findMany } = listPrisma();
    const { svc } = service(prisma);
    await svc.list(providerAdmin(), { page: 1, pageSize: 20, organizationId: "hospital" });
    expect(findMany.mock.calls[0][0].where.organizationId).toBe("prov");
  });

  it("attributes a status change to the target's own organization", async () => {
    const prisma = makePrisma();
    const { svc, audit } = service(prisma);
    await svc.setStatus(nonnisAdmin(), "target", "SUSPENDED" as UserStatus);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "prov" }));
  });
});

// ---------------------------------------------------------------------------
// Deleting an account
//
// The operation exists so an address can be invited again: Supabase refuses to
// invite one that is still registered, so the sign-in identity has to go with
// the row. What must not happen is a live account disappearing by mis-click,
// hence the ACTIVE guard and the membership-scope guard below.
// ---------------------------------------------------------------------------

function deletePrisma(user: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  const del = jest.fn().mockResolvedValue({});
  const prisma = makePrisma({
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: "target",
        email: "t@x.com",
        status: "INVITED",
        supabaseAuthUserId: "sb-target",
        _count: { memberships: 1 },
        ...user,
      }),
      delete: del,
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    ...over,
  });
  return { prisma, del };
}

describe("UsersService — deleting an account", () => {
  beforeEach(() => jest.clearAllMocks());

  it("removes the sign-in identity and the row, and records the deletion", async () => {
    const { prisma, del } = deletePrisma();
    const { svc, audit, supabase } = service(prisma);

    await expect(svc.deleteUser(providerAdmin(), "target")).resolves.toEqual({ id: "target" });

    expect(supabase.deleteAuthUser).toHaveBeenCalledWith("sb-target");
    expect(del).toHaveBeenCalledWith({ where: { id: "target" } });
    // The email is captured in the audit event because the row that held it is
    // about to be gone.
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.deleted", metadata: { email: "t@x.com", status: "INVITED" } }),
      expect.anything(),
    );
  });

  it("skips the identity call for an invite that never got one", async () => {
    // An invitation whose email failed to send leaves no identity behind.
    const { prisma, del } = deletePrisma({ supabaseAuthUserId: null });
    const { svc, supabase } = service(prisma);

    await svc.deleteUser(providerAdmin(), "target");

    expect(supabase.deleteAuthUser).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalled();
  });

  it("refuses an active user, pointing at suspension instead", async () => {
    const { prisma, del } = deletePrisma({ status: "ACTIVE" });
    const { svc } = service(prisma);

    await expect(svc.deleteUser(providerAdmin(), "target")).rejects.toBeInstanceOf(BadRequestException);
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses to delete the actor's own account", async () => {
    const { prisma, del } = deletePrisma();
    const { svc } = service(prisma);

    await expect(svc.deleteUser(providerAdmin(), "admin-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(del).not.toHaveBeenCalled();
  });

  it("keeps an organization-scoped manager away from a user who belongs elsewhere too", async () => {
    const { prisma, del } = deletePrisma({ _count: { memberships: 2 } });
    const { svc } = service(prisma);

    await expect(svc.deleteUser(providerAdmin(), "target")).rejects.toBeInstanceOf(ForbiddenException);
    expect(del).not.toHaveBeenCalled();
  });

  it("lets a platform manager delete a user who belongs to several organizations", async () => {
    const { prisma, del } = deletePrisma({ _count: { memberships: 2 } });
    const { svc } = service(prisma);

    await expect(svc.deleteUser(nonnisAdmin(), "target")).resolves.toEqual({ id: "target" });
    expect(del).toHaveBeenCalled();
  });

  it("leaves the row in place when the identity cannot be removed", async () => {
    // Deleting the row first would strand a registered address that nothing in
    // the admin UI can reach any more.
    const { prisma, del } = deletePrisma();
    const { svc, supabase } = service(prisma);
    (supabase.deleteAuthUser as jest.Mock).mockRejectedValue(new Error("boom"));

    await expect(svc.deleteUser(providerAdmin(), "target")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(del).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Resending an invitation
//
// The first send can fail on its own (a provider rate limit), and an
// invitation that did arrive and was ignored cannot be re-issued as an
// invitation at all — by then the address is registered. Both are the shared
// invitation service's problem; what belongs here is who may ask for a resend
// and in which state.
// ---------------------------------------------------------------------------

function resendPrisma(user: Record<string, unknown> = {}) {
  return makePrisma({
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "target", email: "t@x.com", status: "INVITED", ...user }),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  });
}

describe("UsersService — resending an invitation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends again for a pending user and records it", async () => {
    const { svc, audit, invitations } = service(resendPrisma());

    await expect(svc.resendInvitation(providerAdmin(), "target")).resolves.toEqual({
      userId: "target",
      email: "t@x.com",
      emailKind: "INVITE",
    });
    expect(invitations.send).toHaveBeenCalledWith("target", "t@x.com");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "user.invitation_resent" }));
  });

  it("reports which email actually went out for an already-registered address", async () => {
    // The recipient gets a password-setup link rather than a second invitation;
    // the caller is told, because it is what the user will see in their inbox.
    const { svc, invitations } = service(resendPrisma());
    (invitations.send as jest.Mock).mockResolvedValue("PASSWORD_SETUP");

    await expect(svc.resendInvitation(providerAdmin(), "target")).resolves.toMatchObject({
      emailKind: "PASSWORD_SETUP",
    });
  });

  it("refuses a user who has already accepted", async () => {
    const { svc, invitations } = service(resendPrisma({ status: "ACTIVE" }));

    await expect(svc.resendInvitation(providerAdmin(), "target")).rejects.toBeInstanceOf(BadRequestException);
    expect(invitations.send).not.toHaveBeenCalled();
  });

  it("says a rate limit is a rate limit, so the caller knows to wait", async () => {
    const { svc, invitations } = service(resendPrisma());
    (invitations.send as jest.Mock).mockRejectedValue(new InvitationEmailError("429: email rate limit exceeded", true));

    await expect(svc.resendInvitation(providerAdmin(), "target")).rejects.toThrow(/rate limit/i);
  });

  it("keeps an organization-scoped manager away from a user outside their organization", async () => {
    const prisma = makePrisma({
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const { svc, invitations } = service(prisma);

    await expect(svc.resendInvitation(providerAdmin(), "target")).rejects.toBeInstanceOf(NotFoundException);
    expect(invitations.send).not.toHaveBeenCalled();
  });
});
