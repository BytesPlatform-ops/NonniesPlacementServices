import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { TimelineService } from "./timeline.service";

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

function prisma(over: Record<string, unknown> = {}): PrismaService {
  return {
    case: { findUnique: async () => ({ organizationId: "hosp-org" }) },
    user: { findMany: async () => [{ id: "s1", displayName: "Sender", firstName: null, lastName: null, email: "s@x.com" }] },
    workflowEvent: { findMany: async () => [], count: async () => 0 },
    message: { findMany: async () => [], count: async () => 0 },
    ...over,
  } as unknown as PrismaService;
}

describe("TimelineService.build", () => {
  it("denies a user with no access to the case (404)", async () => {
    const svc = new TimelineService(prisma());
    await expect(svc.build(makeUser([PERMISSIONS.CASES_READ], ["other-org"]), "case-1", "all", 1, 30)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("merges events and messages sorted newest-first", async () => {
    const event = { id: "e1", type: "REFERRAL_SENT", createdAt: new Date("2026-01-01T00:00:00Z"), previousStatus: null, newStatus: null, actorUser: null };
    const message = { id: "m1", scope: "CASE_TEAM", senderUserId: "s1", body: "hello", createdAt: new Date("2026-02-01T00:00:00Z") };
    const svc = new TimelineService(
      prisma({ $transaction: async () => [[event], 1, [message], 1] }),
    );
    const r = await svc.build(makeUser([PERMISSIONS.CASES_READ], ["hosp-org"]), "case-1", "all", 1, 30);
    expect(r.total).toBe(2);
    expect(r.items[0]!.source).toBe("message");
    expect(r.items[0]!.detail).toBe("hello");
    expect(r.items[1]!.type).toBe("REFERRAL_SENT");
  });
});
