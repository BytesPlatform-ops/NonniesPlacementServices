import type { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../auth/request-user";
import type { ProvidersService } from "../providers/providers.service";
import type { ProviderDetailView } from "../providers/providers.serializer";
import { ProviderPortalService } from "./provider-portal.service";

function makeUser(activeOrganizationId: string | null): RequestUser {
  return {
    id: "user-1",
    supabaseUserId: "sb-1",
    email: "u@example.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: activeOrganizationId
      ? [
          {
            membershipId: "m1",
            organizationId: activeOrganizationId,
            organizationName: "Prov",
            organizationType: "PROVIDER",
            organizationStatus: "ACTIVE",
            roleId: "r",
            roleCode: "PROVIDER_ADMIN",
            roleName: "Provider Administrator",
            isPrimary: true,
            permissions: [],
          },
        ]
      : [],
    activeOrganizationId,
    activePermissions: new Set(),
  };
}

function detail(over: Partial<ProviderDetailView> = {}): ProviderDetailView {
  return {
    id: "prov-1",
    organizationId: "org-1",
    organization: { id: "org-1", name: "Prov", type: "PROVIDER", status: "ACTIVE" },
    status: "ACTIVE",
    displayName: "Sunrise",
    description: null,
    phone: "555",
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: "Tacoma",
    state: "WA",
    postalCode: null,
    country: "US",
    timezone: null,
    eligibilityNotes: null,
    internalNotes: null,
    licenseNumber: null,
    licenseType: null,
    services: [{ active: true } as ProviderDetailView["services"][number]],
    coverageAreas: [],
    paymentTypes: [],
    languages: [],
    hours: [],
    capacity: [],
    editable: true,
    canManageCapacity: true,
    publicListing: {
      isResidentialProvider: false,
      published: false,
      publishedAt: null,
      slug: null,
      description: null,
      featuredImageUrl: null,
      featuredImageStoragePath: null,
      sortOrder: null,
      ready: false,
      missing: [],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("ProviderPortalService.me", () => {
  it("returns empty state when there is no active organization", async () => {
    const prisma = { provider: { findUnique: async () => null } } as unknown as PrismaService;
    const providers = { findOne: async () => detail() } as unknown as ProvidersService;
    const svc = new ProviderPortalService(prisma, providers);
    const r = await svc.me(makeUser(null));
    expect(r.hasProvider).toBe(false);
    expect(r.provider).toBeNull();
  });

  it("returns empty state when the active organization has no provider", async () => {
    const prisma = { provider: { findUnique: async () => null } } as unknown as PrismaService;
    const providers = { findOne: async () => detail() } as unknown as ProvidersService;
    const svc = new ProviderPortalService(prisma, providers);
    const r = await svc.me(makeUser("org-1"));
    expect(r.hasProvider).toBe(false);
    expect(r.organizationId).toBe("org-1");
  });

  it("resolves the provider for the active organization and computes completeness", async () => {
    const prisma = { provider: { findUnique: async () => ({ id: "prov-1" }) } } as unknown as PrismaService;
    const providers = { findOne: async () => detail() } as unknown as ProvidersService;
    const svc = new ProviderPortalService(prisma, providers);
    const r = await svc.me(makeUser("org-1"));
    expect(r.hasProvider).toBe(true);
    expect(r.provider?.id).toBe("prov-1");
    expect(r.summary?.servicesCount).toBe(1);
    expect(r.completeness?.missing).toContain("NO_COVERAGE");
    expect(r.completeness?.missing).not.toContain("NO_SERVICES");
  });
});
