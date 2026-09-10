import { NotFoundException } from "@nestjs/common";
import { SeekerCaseAccessService } from "./seeker-case-access";
import type { PrismaService } from "../../database/prisma.service";
import type { CaseAccessContext, RequestUser } from "../auth/request-user";
import { isCareSeeker } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";

function grant(caseId: string, overrides: Partial<CaseAccessContext> = {}): CaseAccessContext {
  return {
    accessId: `acc-${caseId}`,
    caseId,
    caseNumber: `CASE-${caseId}`,
    careRecipientName: "Rose Miller",
    relationship: "Daughter",
    roleCode: "CARE_SEEKER",
    roleName: "Care Seeker",
    permissions: [PERMISSIONS.SEEKER_CASE_READ],
    ...overrides,
  };
}

function seeker(caseIds: string[]): RequestUser {
  return {
    id: "user-seeker",
    supabaseUserId: "sb-seeker",
    email: "family@example.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    caseAccess: caseIds.map((id) => grant(id)),
    activeOrganizationId: null,
    activePermissions: new Set([PERMISSIONS.SEEKER_CASE_READ]),
  };
}

function staff(organizationId: string): RequestUser {
  return {
    id: "user-staff",
    supabaseUserId: "sb-staff",
    email: "staff@nonnis.local",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [
      {
        membershipId: "m1",
        organizationId,
        organizationName: "Nonnis",
        organizationType: "NONNIS",
        organizationStatus: "ACTIVE",
        roleId: "r1",
        roleCode: "NONNIS_ADMIN",
        roleName: "Nonnis Administrator",
        isPrimary: true,
        permissions: [PERMISSIONS.CASES_READ_ALL],
      },
    ],
    caseAccess: [],
    activeOrganizationId: organizationId,
    activePermissions: new Set([PERMISSIONS.CASES_READ_ALL]),
  };
}

const prisma = {} as PrismaService;

describe("SeekerCaseAccessService", () => {
  const svc = new SeekerCaseAccessService(prisma);

  it("lists only the cases the request actually holds a grant for", () => {
    expect(svc.authorizedCaseIds(seeker(["case-a", "case-b"]))).toEqual(["case-a", "case-b"]);
    expect(svc.authorizedCaseIds(staff("nonnis"))).toEqual([]);
  });

  it("returns the grant for an authorized case", () => {
    const grantFound = svc.requireCase(seeker(["case-a"]), "case-a");
    expect(grantFound.caseId).toBe("case-a");
    expect(grantFound.careRecipientName).toBe("Rose Miller");
  });

  // The core cross-case rule: Seeker A must not reach Case B.
  it("refuses a case the request holds no grant for", () => {
    expect(() => svc.requireCase(seeker(["case-a"]), "case-b")).toThrow(NotFoundException);
  });

  it("hides existence by answering 404 rather than 403", () => {
    // 403 would confirm the case exists; the rest of the platform answers 404
    // for the same reason and this must not become the one place that leaks.
    try {
      svc.requireCase(seeker(["case-a"]), "case-b");
      fail("expected a rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getStatus()).toBe(404);
    }
  });

  it("refuses every case for a user with no grants at all", () => {
    expect(() => svc.requireCase(staff("nonnis"), "case-a")).toThrow(NotFoundException);
    expect(() => svc.requireCase(seeker([]), "case-a")).toThrow(NotFoundException);
  });

  describe("defaultCase", () => {
    it("opens the only case when there is one", () => {
      expect(svc.defaultCase(seeker(["case-a"]))?.caseId).toBe("case-a");
    });

    it("opens the first grant when a relative is authorized for several", () => {
      expect(svc.defaultCase(seeker(["case-a", "case-b"]))?.caseId).toBe("case-a");
    });

    it("is null when nothing is linked", () => {
      expect(svc.defaultCase(seeker([]))).toBeNull();
    });
  });

  describe("resolveCase", () => {
    it("falls back to the default case when no id is supplied", () => {
      expect(svc.resolveCase(seeker(["case-a"]), undefined).caseId).toBe("case-a");
      expect(svc.resolveCase(seeker(["case-a"]), null).caseId).toBe("case-a");
    });

    it("honours an explicitly requested authorized case", () => {
      expect(svc.resolveCase(seeker(["case-a", "case-b"]), "case-b").caseId).toBe("case-b");
    });

    it("refuses an unauthorized id instead of silently opening the default", () => {
      // Falling back here would show the family a different case than the one
      // they asked for — worse than an error.
      expect(() => svc.resolveCase(seeker(["case-a"]), "case-b")).toThrow(NotFoundException);
    });

    it("explains that nothing is linked when the account has no case", () => {
      expect(() => svc.resolveCase(seeker([]), undefined)).toThrow(/No case is linked/);
    });
  });

  describe("requireReferral", () => {
    function withReferral(referral: { caseId: string; providerId: string } | null) {
      return new SeekerCaseAccessService({
        referral: { findUnique: jest.fn().mockResolvedValue(referral) },
      } as unknown as PrismaService);
    }

    it("returns a referral raised on an authorized case", async () => {
      const s = withReferral({ caseId: "case-a", providerId: "prov-1" });
      await expect(s.requireReferral(seeker(["case-a"]), "ref-1")).resolves.toEqual({
        caseId: "case-a",
        providerId: "prov-1",
      });
    });

    it("refuses a referral belonging to another case", async () => {
      const s = withReferral({ caseId: "case-b", providerId: "prov-1" });
      await expect(s.requireReferral(seeker(["case-a"]), "ref-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a referral that does not exist", async () => {
      const s = withReferral(null);
      await expect(s.requireReferral(seeker(["case-a"]), "ref-x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a provider or staff user outright", async () => {
      const s = withReferral({ caseId: "case-a", providerId: "prov-1" });
      await expect(s.requireReferral(staff("nonnis"), "ref-1")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe("isCareSeeker", () => {
  it("is true only for a user whose access is entirely case-scoped", () => {
    expect(isCareSeeker(seeker(["case-a"]))).toBe(true);
    expect(isCareSeeker(seeker([]))).toBe(false);
    expect(isCareSeeker(staff("nonnis"))).toBe(false);
  });
});
