import { ForbiddenException } from "@nestjs/common";
import { AuthContextService } from "./auth-context.service";
import type { PrismaService } from "../../database/prisma.service";

function member(
  orgId: string,
  opts: { orgStatus?: string; roleCode?: string; perms?: string[]; status?: string } = {},
) {
  const { orgStatus = "ACTIVE", roleCode = "DISCHARGE_PROFESSIONAL", perms = ["cases.read"], status = "ACTIVE" } = opts;
  return {
    id: `mem-${orgId}`,
    organizationId: orgId,
    status,
    isPrimary: false,
    roleId: `role-${roleCode}`,
    organization: { name: `Org ${orgId}`, type: "HOSPITAL", status: orgStatus },
    role: { code: roleCode, name: roleCode, permissions: perms.map((p) => ({ permission: { code: p } })) },
  };
}

function userRec(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "u@example.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    supabaseAuthUserId: "sb-1",
    memberships: [],
    ...overrides,
  };
}

const identity = { supabaseUserId: "sb-1", email: "u@example.com" };

describe("AuthContextService", () => {
  it("returns null for an authenticated but unprovisioned identity", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);
    expect(await svc.resolve(identity)).toBeNull();
  });

  it("maps a valid identity to its application user and permissions", async () => {
    const u = userRec({ memberships: [member("orgA", { perms: ["cases.read", "cases.create"] })] });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(u) } } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);

    const result = await svc.resolve(identity);
    expect(result?.id).toBe("user-1");
    expect(result?.activeOrganizationId).toBe("orgA");
    expect(result?.activePermissions.has("cases.read")).toBe(true);
    expect(result?.activePermissions.has("cases.create")).toBe(true);
  });

  it("grants no access to a suspended user", async () => {
    const u = userRec({ status: "SUSPENDED", memberships: [member("orgA")] });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(u) } } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);

    const result = await svc.resolve(identity);
    expect(result?.memberships).toEqual([]);
    expect(result?.activeOrganizationId).toBeNull();
    expect(result?.activePermissions.size).toBe(0);
  });

  it("requires an explicit org when the user has multiple memberships", async () => {
    const u = userRec({ memberships: [member("orgA"), member("orgB")] });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(u) } } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);

    const result = await svc.resolve(identity);
    expect(result?.activeOrganizationId).toBeNull();
  });

  it("rejects a requested organization the user is not a member of", async () => {
    const u = userRec({ memberships: [member("orgA")] });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(u) } } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);

    await expect(svc.resolve(identity, "orgZ")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("provisions (activates) an invited user and membership on first sign-in", async () => {
    const invited = userRec({
      status: "INVITED",
      memberships: [member("orgA", { roleCode: "PROVIDER_STAFF", perms: ["facilities.read"], status: "INVITED" })],
    });
    const activated = userRec({
      status: "ACTIVE",
      memberships: [member("orgA", { roleCode: "PROVIDER_STAFF", perms: ["facilities.read"], status: "ACTIVE" })],
    });
    const tx = { user: { update: jest.fn() }, organizationMembership: { updateMany: jest.fn() } };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(invited),
        findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
      },
      $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const svc = new AuthContextService(prisma);

    const result = await svc.resolve(identity);
    expect(tx.user.update).toHaveBeenCalled();
    expect(tx.organizationMembership.updateMany).toHaveBeenCalled();
    expect(result?.status).toBe("ACTIVE");
    expect(result?.activeOrganizationId).toBe("orgA");
    expect(result?.activePermissions.has("facilities.read")).toBe(true);
  });
});
