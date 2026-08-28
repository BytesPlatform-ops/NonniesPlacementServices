import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { ReferralAccessService } from "./referral-access";

function makeUser(permissions: string[], orgIds: string[], activeOrganizationId: string | null): RequestUser {
  return {
    id: "user-1",
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
    activeOrganizationId,
    activePermissions: new Set(permissions),
  };
}

const REFERRAL = {
  id: "ref-1",
  caseId: "case-1",
  serviceRequestId: "sr-1",
  providerId: "prov-1",
  status: "SENT" as const,
  case: { organizationId: "hosp-org" },
  provider: { organizationId: "prov-org" },
};

function prisma(): PrismaService {
  return {
    referral: { findUnique: async () => REFERRAL },
    case: { findUnique: async () => ({ organizationId: "hosp-org" }) },
  } as unknown as PrismaService;
}

describe("ReferralAccessService.loadForStaff", () => {
  it("allows a discharge user in the case organization", async () => {
    const svc = new ReferralAccessService(prisma());
    const user = makeUser([PERMISSIONS.REFERRALS_READ, PERMISSIONS.REFERRALS_MANAGE], ["hosp-org"], "hosp-org");
    await expect(svc.loadForStaff(user, "ref-1")).resolves.toMatchObject({ id: "ref-1" });
  });

  it("hides a referral from a different organization (404)", async () => {
    const svc = new ReferralAccessService(prisma());
    const user = makeUser([PERMISSIONS.REFERRALS_READ], ["other-org"], "other-org");
    await expect(svc.loadForStaff(user, "ref-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows Nonnis read_all across organizations", async () => {
    const svc = new ReferralAccessService(prisma());
    const user = makeUser([PERMISSIONS.REFERRALS_READ, PERMISSIONS.REFERRALS_READ_ALL], ["nonnis"], "nonnis");
    await expect(svc.loadForStaff(user, "ref-1")).resolves.toMatchObject({ id: "ref-1" });
  });
});

describe("ReferralAccessService.loadForProvider", () => {
  it("allows a provider user of the referral's provider org", async () => {
    const svc = new ReferralAccessService(prisma());
    const user = makeUser([PERMISSIONS.REFERRALS_READ], ["prov-org"], "prov-org");
    await expect(svc.loadForProvider(user, "ref-1")).resolves.toMatchObject({ providerOrganizationId: "prov-org" });
  });

  it("hides another provider's referral (404)", async () => {
    const svc = new ReferralAccessService(prisma());
    const user = makeUser([PERMISSIONS.REFERRALS_READ], ["other-prov"], "other-prov");
    await expect(svc.loadForProvider(user, "ref-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
