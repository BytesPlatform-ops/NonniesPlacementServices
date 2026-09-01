import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { MediaService } from "../content/media.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { ProvidersService } from "./providers.service";
import type { CreateProviderDto } from "./dto/provider.dto";

function makeUser(permissions: string[], orgIds: string[] = []): RequestUser {
  return {
    id: "user-1",
    supabaseUserId: "sb-1",
    email: "u@example.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: orgIds.map((organizationId, i) => ({
      membershipId: `m${i}`,
      organizationId,
      organizationName: "Org",
      organizationType: "PROVIDER",
      organizationStatus: "ACTIVE",
      roleId: "r",
      roleCode: "PROVIDER_ADMIN",
      roleName: "Provider Administrator",
      isPrimary: true,
      permissions,
    })),
    activeOrganizationId: orgIds[0] ?? null,
    activePermissions: new Set(permissions),
  };
}

const NONNIS = makeUser([PERMISSIONS.PROVIDERS_MANAGE, PERMISSIONS.PROVIDERS_READ]);
const audit = { record: async () => undefined } as unknown as AuditService;

const media = { createUploadTicket: async () => ({}), deleteObject: async () => undefined } as unknown as MediaService;

function build(prisma: unknown) {
  const p = prisma as PrismaService;
  return new ProvidersService(p, audit, new ProviderAccessService(p), media);
}

describe("ProvidersService.create validation", () => {
  const baseDto: CreateProviderDto = { displayName: "Sunrise Home Health" };

  it("rejects when neither organizationId nor organizationName is given", async () => {
    const prisma = { $transaction: async (fn: (tx: unknown) => unknown) => fn({}) };
    await expect(build(prisma).create(NONNIS, { ...baseDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a nonexistent organization", async () => {
    const tx = { organization: { findUnique: async () => null } };
    const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
    await expect(
      build(prisma).create(NONNIS, { ...baseDto, organizationId: "11111111-1111-1111-1111-111111111111" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a non-provider organization", async () => {
    const tx = { organization: { findUnique: async () => ({ id: "o1", type: "HOSPITAL", provider: null }) } };
    const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
    await expect(
      build(prisma).create(NONNIS, { ...baseDto, organizationId: "11111111-1111-1111-1111-111111111111" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an organization that already has a provider profile", async () => {
    const tx = { organization: { findUnique: async () => ({ id: "o1", type: "PROVIDER", provider: { id: "p1" } }) } };
    const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
    await expect(
      build(prisma).create(NONNIS, { ...baseDto, organizationId: "11111111-1111-1111-1111-111111111111" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("ProvidersService isolation", () => {
  it("blocks a provider admin from updating another provider (404)", async () => {
    const providerAdmin = makeUser([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.PROVIDERS_MANAGE_OWN], ["prov-org"]);
    const prisma = {
      provider: { findUnique: async () => ({ id: "prov-2", organizationId: "other-org", status: "ACTIVE" }) },
    };
    await expect(build(prisma).update(providerAdmin, "prov-2", { displayName: "x" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
