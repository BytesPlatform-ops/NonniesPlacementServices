import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { MessageAccessService } from "./message-access";

function makeUser(permissions: string[], orgIds: string[]): RequestUser {
  return {
    id: "u",
    supabaseUserId: "sb",
    email: "u@x.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: orgIds.map((organizationId, i) => ({
      membershipId: `m${i}`,
      organizationId,
      organizationName: "O",
      organizationType: "PROVIDER",
      organizationStatus: "ACTIVE",
      roleId: "r",
      roleCode: "PROVIDER_ADMIN",
      roleName: "R",
      isPrimary: true,
      permissions,
    })),
    activeOrganizationId: orgIds[0] ?? null,
    activePermissions: new Set(permissions),
  };
}

const casePrisma = { case: { findUnique: async () => ({ organizationId: "hosp-org" }) } } as unknown as PrismaService;
const referralPrisma = {
  referral: { findUnique: async () => ({ id: "ref-1", caseId: "case-1", case: { organizationId: "hosp-org" }, provider: { organizationId: "prov-a" } }) },
} as unknown as PrismaService;

describe("MessageAccessService.caseTeamAccess", () => {
  it("allows case-org members and Nonnis read_all, but not providers", async () => {
    const svc = new MessageAccessService(casePrisma);
    await expect(svc.caseTeamAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["hosp-org"]), "case-1")).resolves.toBe("hosp-org");
    await expect(svc.caseTeamAccess(makeUser([PERMISSIONS.MESSAGES_READ, PERMISSIONS.MESSAGES_READ_ALL], ["nonnis"]), "case-1")).resolves.toBe("hosp-org");
    await expect(svc.caseTeamAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["prov-a"]), "case-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("MessageAccessService.internalAccess", () => {
  it("requires internal_notes.manage", async () => {
    const svc = new MessageAccessService(casePrisma);
    await expect(svc.internalAccess(makeUser([PERMISSIONS.INTERNAL_NOTES_MANAGE], ["nonnis"]), "case-1")).resolves.toBe("hosp-org");
    await expect(svc.internalAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["hosp-org"]), "case-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("MessageAccessService.referralAccess", () => {
  it("allows the referral's provider and the case side, but not another provider", async () => {
    const svc = new MessageAccessService(referralPrisma);
    await expect(svc.referralAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["prov-a"]), "ref-1")).resolves.toMatchObject({ providerOrganizationId: "prov-a" });
    await expect(svc.referralAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["hosp-org"]), "ref-1")).resolves.toMatchObject({ caseOrganizationId: "hosp-org" });
    await expect(svc.referralAccess(makeUser([PERMISSIONS.MESSAGES_READ], ["prov-b"]), "ref-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
