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
    careSeekerAccess: [],
    ...overrides,
  };
}

/** A family member's grant on one case, as the include shape returns it. */
function seekerAccess(
  caseId: string,
  opts: { status?: string; caseStatus?: string; perms?: string[]; relationship?: string } = {},
) {
  const {
    status = "ACTIVE",
    caseStatus = "MATCHING",
    perms = ["seeker_case.read"],
    relationship = "Daughter",
  } = opts;
  return {
    id: `acc-${caseId}`,
    caseId,
    status,
    relationship,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    case: {
      caseNumber: `CASE-${caseId}`,
      status: caseStatus,
      patient: { firstName: "Rose", lastName: "Miller" },
    },
    role: {
      code: "CARE_SEEKER",
      name: "Care Seeker",
      permissions: perms.map((p) => ({ permission: { code: p } })),
    },
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

  // ---------------------------------------------------------------------------
  // Case-scoped (family) access
  //
  // The organization path above must stay byte-for-byte unchanged; these cover
  // the parallel path added for the family portal.
  // ---------------------------------------------------------------------------

  describe("care seeker (case-scoped) access", () => {
    function resolveWith(user: Record<string, unknown>) {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } } as unknown as PrismaService;
      return new AuthContextService(prisma).resolve(identity);
    }

    it("resolves a family member who belongs to no organization at all", async () => {
      const result = await resolveWith(userRec({ careSeekerAccess: [seekerAccess("case-a")] }));

      expect(result).not.toBeNull();
      expect(result?.memberships).toEqual([]);
      expect(result?.activeOrganizationId).toBeNull();
      expect(result?.caseAccess).toHaveLength(1);
      expect(result?.caseAccess[0]?.caseId).toBe("case-a");
      expect(result?.caseAccess[0]?.careRecipientName).toBe("Rose Miller");
      expect(result?.caseAccess[0]?.relationship).toBe("Daughter");
      // Without this the guard would refuse every seeker route.
      expect(result?.activePermissions.has("seeker_case.read")).toBe(true);
    });

    it("still returns null for a user with neither a membership nor a grant", async () => {
      // The pre-existing contract: authenticated but unprovisioned means no
      // access. Adding case access must not turn this into a usable session.
      const result = await resolveWith(userRec({ memberships: [], careSeekerAccess: [] }));
      expect(result?.memberships).toEqual([]);
      expect(result?.caseAccess).toEqual([]);
      expect([...(result?.activePermissions ?? [])]).toEqual([]);
    });

    it("ignores a revoked grant", async () => {
      const result = await resolveWith(
        userRec({ careSeekerAccess: [seekerAccess("case-a", { status: "REVOKED" })] }),
      );
      expect(result?.caseAccess).toEqual([]);
      expect([...(result?.activePermissions ?? [])]).toEqual([]);
    });

    it("ignores a grant still pending on a cancelled case", async () => {
      // A pending grant on a LIVE case is accepted on first sign-in — see
      // "care seeker invitation acceptance" below. On a cancelled case it stays
      // pending, and `resolve` only ever considers ACTIVE grants.
      const result = await resolveWith(
        userRec({ careSeekerAccess: [seekerAccess("case-a", { status: "INVITED", caseStatus: "CANCELLED" })] }),
      );
      expect(result?.caseAccess).toEqual([]);
    });

    it("drops a grant once its case is cancelled", async () => {
      const result = await resolveWith(
        userRec({ careSeekerAccess: [seekerAccess("case-a", { caseStatus: "CANCELLED" })] }),
      );
      expect(result?.caseAccess).toEqual([]);
    });

    it("gives a suspended user no access through a grant", async () => {
      const result = await resolveWith(
        userRec({ status: "SUSPENDED", careSeekerAccess: [seekerAccess("case-a")] }),
      );
      expect(result?.caseAccess).toEqual([]);
    });

    it("carries every authorized case for a relative granted more than one", async () => {
      const result = await resolveWith(
        userRec({ careSeekerAccess: [seekerAccess("case-a"), seekerAccess("case-b")] }),
      );
      expect(result?.caseAccess.map((a) => a.caseId)).toEqual(["case-a", "case-b"]);
    });

    it("unions permissions across grants without duplicating them", async () => {
      const result = await resolveWith(
        userRec({
          careSeekerAccess: [
            seekerAccess("case-a", { perms: ["seeker_case.read", "seeker_messages.read"] }),
            seekerAccess("case-b", { perms: ["seeker_case.read"] }),
          ],
        }),
      );
      expect([...(result?.activePermissions ?? [])].sort()).toEqual(["seeker_case.read", "seeker_messages.read"]);
    });

    it("never lets a grant add permissions to an organization user", async () => {
      // A user with both is not a supported state, but if one ever existed the
      // organization context must win rather than silently merging the two.
      const result = await resolveWith(
        userRec({
          memberships: [member("orgA", { perms: ["cases.read"] })],
          careSeekerAccess: [seekerAccess("case-a", { perms: ["seeker_case.read"] })],
        }),
      );
      expect(result?.activeOrganizationId).toBe("orgA");
      expect(result?.activePermissions.has("cases.read")).toBe(true);
      expect(result?.activePermissions.has("seeker_case.read")).toBe(false);
    });

    it("leaves a multi-organization user with no permissions until they pick one", async () => {
      // The documented pre-existing behaviour, re-asserted because the new
      // fallback runs in exactly this "no active organization" situation and
      // must not start filling the set.
      const result = await resolveWith(
        userRec({ memberships: [member("orgA"), member("orgB")], careSeekerAccess: [] }),
      );
      expect(result?.activeOrganizationId).toBeNull();
      expect([...(result?.activePermissions ?? [])]).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Accepting a family invitation on first sign-in
  //
  // The invite writes CareSeekerCaseAccess with status INVITED. Without this
  // step the user activated and the grant did not, so someone who had just set
  // their password was shown "no organization access".
  // ---------------------------------------------------------------------------

  describe("care seeker invitation acceptance", () => {
    /** Wires a prisma double that records what the provisioning transaction wrote. */
    function provisioning(before: Record<string, unknown>, after?: Record<string, unknown>) {
      const tx = {
        user: { update: jest.fn() },
        organizationMembership: { updateMany: jest.fn() },
        careSeekerCaseAccess: { updateMany: jest.fn() },
      };
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(before),
          findUniqueOrThrow: jest.fn().mockResolvedValue(after ?? before),
        },
        $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;
      return { svc: new AuthContextService(prisma), tx, prisma };
    }

    it("activates the user and the pending grant, and the session then carries the case", async () => {
      const invited = userRec({ status: "INVITED", careSeekerAccess: [seekerAccess("case-a", { status: "INVITED" })] });
      const activated = userRec({ status: "ACTIVE", careSeekerAccess: [seekerAccess("case-a", { status: "ACTIVE" })] });
      const { svc, tx } = provisioning(invited, activated);

      const result = await svc.resolve(identity);

      expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "ACTIVE" } }));
      expect(tx.careSeekerCaseAccess.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["acc-case-a"] }, userId: "user-1", status: "INVITED" },
        data: { status: "ACTIVE" },
      });
      // The end of the chain: a usable session on the right case.
      expect(result?.status).toBe("ACTIVE");
      expect(result?.caseAccess).toHaveLength(1);
      expect(result?.caseAccess[0]?.caseId).toBe("case-a");
      expect(result?.activePermissions.has("seeker_case.read")).toBe(true);
      expect(result?.memberships).toEqual([]);
      expect(result?.activeOrganizationId).toBeNull();
    });

    it("scopes the write to this user and to pending rows only", async () => {
      // Both are re-stated in the filter so a grant revoked between the read
      // and the write, or one belonging to anyone else, cannot be activated.
      const { svc, tx } = provisioning(
        userRec({ status: "INVITED", careSeekerAccess: [seekerAccess("case-a", { status: "INVITED" })] }),
      );
      await svc.resolve(identity);
      const where = (tx.careSeekerCaseAccess.updateMany as jest.Mock).mock.calls[0][0].where;
      expect(where.userId).toBe("user-1");
      expect(where.status).toBe("INVITED");
    });

    it("leaves a revoked grant revoked", async () => {
      const { svc, tx } = provisioning(
        userRec({ status: "ACTIVE", careSeekerAccess: [seekerAccess("case-a", { status: "REVOKED" })] }),
      );
      const result = await svc.resolve(identity);
      expect(tx.careSeekerCaseAccess.updateMany).not.toHaveBeenCalled();
      expect(result?.caseAccess).toEqual([]);
    });

    it("leaves a grant on a cancelled case pending, and unusable", async () => {
      const { svc, tx } = provisioning(
        userRec({
          status: "INVITED",
          careSeekerAccess: [seekerAccess("case-a", { status: "INVITED", caseStatus: "CANCELLED" })],
        }),
      );
      const result = await svc.resolve(identity);
      expect(tx.careSeekerCaseAccess.updateMany).not.toHaveBeenCalled();
      expect(result?.caseAccess).toEqual([]);
    });

    it("does not rewrite a grant that is already active", async () => {
      const { svc, tx } = provisioning(
        userRec({ status: "ACTIVE", careSeekerAccess: [seekerAccess("case-a", { status: "ACTIVE" })] }),
      );
      const result = await svc.resolve(identity);
      expect(tx.careSeekerCaseAccess.updateMany).not.toHaveBeenCalled();
      expect(result?.caseAccess).toHaveLength(1);
    });

    it("accepts every pending grant a relative holds, and only the pending ones", async () => {
      // Documented behaviour: each grant was a separate deliberate act by
      // staff, so accepting one and holding the rest back has no basis.
      const { svc, tx } = provisioning(
        userRec({
          status: "INVITED",
          careSeekerAccess: [
            seekerAccess("case-a", { status: "INVITED" }),
            seekerAccess("case-b", { status: "INVITED" }),
            seekerAccess("case-c", { status: "REVOKED" }),
            seekerAccess("case-d", { status: "INVITED", caseStatus: "CANCELLED" }),
          ],
        }),
      );
      await svc.resolve(identity);
      expect((tx.careSeekerCaseAccess.updateMany as jest.Mock).mock.calls[0][0].where.id.in).toEqual([
        "acc-case-a",
        "acc-case-b",
      ]);
    });

    it("still refuses a family member whose only grant is pending on a cancelled case", async () => {
      const { svc } = provisioning(
        userRec({
          status: "ACTIVE",
          careSeekerAccess: [seekerAccess("case-a", { status: "INVITED", caseStatus: "CANCELLED" })],
        }),
      );
      const result = await svc.resolve(identity);
      expect([...(result?.activePermissions ?? [])]).toEqual([]);
    });

    it("leaves organization provisioning exactly as it was", async () => {
      // An invited staff member has no grants; the grant write must not fire,
      // and the membership write must still happen.
      const { svc, tx } = provisioning(
        userRec({
          status: "INVITED",
          memberships: [member("orgA", { roleCode: "PROVIDER_STAFF", perms: ["providers.read"], status: "INVITED" })],
          careSeekerAccess: [],
        }),
        userRec({
          status: "ACTIVE",
          memberships: [member("orgA", { roleCode: "PROVIDER_STAFF", perms: ["providers.read"], status: "ACTIVE" })],
          careSeekerAccess: [],
        }),
      );
      const result = await svc.resolve(identity);
      expect(tx.user.update).toHaveBeenCalled();
      expect(tx.organizationMembership.updateMany).toHaveBeenCalled();
      expect(tx.careSeekerCaseAccess.updateMany).not.toHaveBeenCalled();
      expect(result?.activeOrganizationId).toBe("orgA");
      expect(result?.activePermissions.has("providers.read")).toBe(true);
    });

    it("never gives an organization user care seeker permissions", async () => {
      const { svc } = provisioning(
        userRec({
          status: "ACTIVE",
          memberships: [member("orgA", { perms: ["cases.read"] })],
          careSeekerAccess: [seekerAccess("case-a", { status: "INVITED" })],
        }),
      );
      const result = await svc.resolve(identity);
      expect(result?.activePermissions.has("cases.read")).toBe(true);
      expect(result?.activePermissions.has("seeker_case.read")).toBe(false);
    });

    it("does not open a transaction when there is nothing to accept", async () => {
      const { svc, prisma } = provisioning(
        userRec({ status: "ACTIVE", memberships: [member("orgA")], careSeekerAccess: [] }),
      );
      await svc.resolve(identity);
      expect((prisma as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
    });
  });
});
