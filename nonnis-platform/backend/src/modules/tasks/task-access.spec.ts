import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { TaskAccessService } from "./task-access";

function makeUser(permissions: string[], orgIds: string[]): RequestUser {
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
      organizationType: "HOSPITAL",
      organizationStatus: "ACTIVE",
      roleId: "r",
      roleCode: "DISCHARGE_PROFESSIONAL",
      roleName: "R",
      isPrimary: true,
      permissions,
    })),
    activeOrganizationId: orgIds[0] ?? null,
    activePermissions: new Set(permissions),
  };
}

describe("TaskAccessService.ensureCaseAccess", () => {
  const prisma = { case: { findUnique: async () => ({ organizationId: "hosp-org" }) } } as unknown as PrismaService;

  it("allows a member of the case organization", async () => {
    const svc = new TaskAccessService(prisma);
    await expect(svc.ensureCaseAccess(makeUser([PERMISSIONS.TASKS_READ], ["hosp-org"]), "case-1")).resolves.toBe("hosp-org");
  });

  it("denies a foreign-org discharge professional (404)", async () => {
    const svc = new TaskAccessService(prisma);
    await expect(svc.ensureCaseAccess(makeUser([PERMISSIONS.TASKS_READ], ["other-org"]), "case-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows Nonnis read_all across orgs", async () => {
    const svc = new TaskAccessService(prisma);
    await expect(svc.ensureCaseAccess(makeUser([PERMISSIONS.TASKS_READ, PERMISSIONS.TASKS_READ_ALL], ["nonnis"]), "case-1")).resolves.toBe("hosp-org");
  });
});

describe("TaskAccessService.isEligibleAssignee", () => {
  it("accepts an active case-org member and rejects an outsider", async () => {
    const prisma = {
      organizationMembership: {
        findFirst: async ({ where }: { where: { userId: string } }) => (where.userId === "insider" ? { id: "m" } : null),
      },
    } as unknown as PrismaService;
    const svc = new TaskAccessService(prisma);
    expect(await svc.isEligibleAssignee("insider", "hosp-org")).toBe(true);
    expect(await svc.isEligibleAssignee("outsider", "hosp-org")).toBe(false);
  });
});
