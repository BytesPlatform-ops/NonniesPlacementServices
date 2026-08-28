import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import {
  ProviderAccessService,
  canManageAllProviders,
  canManageOwnProviders,
  canManageProvider,
} from "./provider-access";

function makeUser(permissions: string[], orgIds: string[] = [], overrides: Partial<RequestUser> = {}): RequestUser {
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
    ...overrides,
  };
}

const NONNIS = makeUser([PERMISSIONS.PROVIDERS_MANAGE, PERMISSIONS.PROVIDERS_READ]);
const DISCHARGE = makeUser([PERMISSIONS.PROVIDERS_READ]);
const PROVIDER_ADMIN = makeUser([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.PROVIDERS_MANAGE_OWN], ["prov-org"]);

const OWN = { id: "prov-1", organizationId: "prov-org", status: "ACTIVE" as const };
const OTHER = { id: "prov-2", organizationId: "other-org", status: "ACTIVE" as const };

function prismaReturning(provider: { id: string; organizationId: string; status: "ACTIVE" } | null): PrismaService {
  return {
    provider: { findUnique: async () => provider },
  } as unknown as PrismaService;
}

describe("provider access helpers", () => {
  it("identifies Nonnis manage-all users", () => {
    expect(canManageAllProviders(NONNIS)).toBe(true);
    expect(canManageAllProviders(PROVIDER_ADMIN)).toBe(false);
  });

  it("identifies provider-scoped managers", () => {
    expect(canManageOwnProviders(PROVIDER_ADMIN)).toBe(true);
    expect(canManageOwnProviders(DISCHARGE)).toBe(false);
  });

  it("lets Nonnis manage any provider but scopes provider admins to their org", () => {
    expect(canManageProvider(NONNIS, OTHER)).toBe(true);
    expect(canManageProvider(PROVIDER_ADMIN, OWN)).toBe(true);
    expect(canManageProvider(PROVIDER_ADMIN, OTHER)).toBe(false);
    expect(canManageProvider(DISCHARGE, OWN)).toBe(false);
  });
});

describe("ProviderAccessService.listScope", () => {
  it("is unbounded for Nonnis and directory-only readers", () => {
    const svc = new ProviderAccessService(prismaReturning(null));
    expect(svc.listScope(NONNIS)).toEqual({});
    expect(svc.listScope(DISCHARGE)).toEqual({});
  });

  it("bounds provider-scoped users to their own organizations", () => {
    const svc = new ProviderAccessService(prismaReturning(null));
    expect(svc.listScope(PROVIDER_ADMIN)).toEqual({ organizationId: { in: ["prov-org"] } });
  });
});

describe("ProviderAccessService.loadForRead", () => {
  it("allows Nonnis and directory readers to read any provider", async () => {
    const svc = new ProviderAccessService(prismaReturning(OTHER));
    await expect(svc.loadForRead(NONNIS, "prov-2")).resolves.toEqual(OTHER);
    await expect(svc.loadForRead(DISCHARGE, "prov-2")).resolves.toEqual(OTHER);
  });

  it("allows a provider admin to read its own provider", async () => {
    const svc = new ProviderAccessService(prismaReturning(OWN));
    await expect(svc.loadForRead(PROVIDER_ADMIN, "prov-1")).resolves.toEqual(OWN);
  });

  it("hides another provider from a provider admin (404)", async () => {
    const svc = new ProviderAccessService(prismaReturning(OTHER));
    await expect(svc.loadForRead(PROVIDER_ADMIN, "prov-2")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProviderAccessService.loadForWrite", () => {
  it("blocks a provider admin from writing another provider (404)", async () => {
    const svc = new ProviderAccessService(prismaReturning(OTHER));
    await expect(svc.loadForWrite(PROVIDER_ADMIN, "prov-2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks a directory-only reader from writing (404)", async () => {
    const svc = new ProviderAccessService(prismaReturning(OWN));
    await expect(svc.loadForWrite(DISCHARGE, "prov-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows a provider admin to write its own provider", async () => {
    const svc = new ProviderAccessService(prismaReturning(OWN));
    await expect(svc.loadForWrite(PROVIDER_ADMIN, "prov-1")).resolves.toEqual(OWN);
  });
});

describe("ProviderAccessService.loadForCapacityWrite", () => {
  const STAFF = makeUser([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN], ["prov-org"]);

  it("allows own capacity updates and blocks other providers", async () => {
    const own = new ProviderAccessService(prismaReturning(OWN));
    await expect(own.loadForCapacityWrite(STAFF, "prov-1")).resolves.toEqual(OWN);
    const other = new ProviderAccessService(prismaReturning(OTHER));
    await expect(other.loadForCapacityWrite(STAFF, "prov-2")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProviderAccessService staff read scoping", () => {
  const STAFF = makeUser([PERMISSIONS.PROVIDERS_READ, PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN], ["prov-org"]);

  it("scopes provider staff to their own organization for reads", async () => {
    const svc = new ProviderAccessService(prismaReturning(OWN));
    await expect(svc.loadForRead(STAFF, "prov-1")).resolves.toEqual(OWN);
    expect(svc.listScope(STAFF)).toEqual({ organizationId: { in: ["prov-org"] } });
    const other = new ProviderAccessService(prismaReturning(OTHER));
    await expect(other.loadForRead(STAFF, "prov-2")).rejects.toBeInstanceOf(NotFoundException);
  });
});
