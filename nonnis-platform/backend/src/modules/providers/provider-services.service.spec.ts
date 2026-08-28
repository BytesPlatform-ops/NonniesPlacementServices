import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { ProviderAccessService } from "./provider-access";
import { ProviderServicesService } from "./provider-services.service";

const NONNIS = {
  id: "user-1",
  memberships: [],
  activePermissions: new Set([PERMISSIONS.PROVIDERS_MANAGE, PERMISSIONS.PROVIDERS_READ]),
} as unknown as RequestUser;

const audit = { record: async () => undefined } as unknown as AuditService;
const CATEGORY_ID = "22222222-2222-2222-2222-222222222222";

function build(over: Record<string, unknown>) {
  const prisma = {
    provider: { findUnique: async () => ({ id: "prov-1", organizationId: "org", status: "ACTIVE" }) },
    ...over,
  } as unknown as PrismaService;
  return new ProviderServicesService(prisma, audit, new ProviderAccessService(prisma));
}

describe("ProviderServicesService.create", () => {
  it("rejects an unknown service category", async () => {
    const svc = build({ serviceCategory: { findUnique: async () => null } });
    await expect(svc.create(NONNIS, "prov-1", { serviceCategoryId: CATEGORY_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("prevents a duplicate provider/service pairing", async () => {
    const svc = build({
      serviceCategory: { findUnique: async () => ({ id: CATEGORY_ID, active: true }) },
      providerService: { findUnique: async () => ({ id: "existing" }) },
    });
    await expect(svc.create(NONNIS, "prov-1", { serviceCategoryId: CATEGORY_ID })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("adds a new service", async () => {
    const svc = build({
      serviceCategory: { findUnique: async () => ({ id: CATEGORY_ID, active: true }) },
      providerService: {
        findUnique: async () => null,
        create: async () => ({
          id: "ps-1",
          serviceCategoryId: CATEGORY_ID,
          active: true,
          description: null,
          levelOfCare: null,
          serviceCategory: { id: CATEGORY_ID, code: "HOME_HEALTH", name: "Home Health" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      },
    });
    const view = await svc.create(NONNIS, "prov-1", { serviceCategoryId: CATEGORY_ID });
    expect(view.categoryCode).toBe("HOME_HEALTH");
    expect(view.active).toBe(true);
  });
});
