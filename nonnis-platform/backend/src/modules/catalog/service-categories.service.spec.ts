import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { ServiceCategoriesService } from "./service-categories.service";

const user = { id: "user-1", activePermissions: new Set<string>() } as unknown as RequestUser;
const audit = { record: async () => undefined } as unknown as AuditService;

function row(over: Record<string, unknown> = {}) {
  return {
    id: "cat-1",
    code: "HOME_HEALTH",
    name: "Home Health",
    description: null,
    active: true,
    sortOrder: 0,
    _count: { providerServices: 0 },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

describe("ServiceCategoriesService", () => {
  it("rejects a duplicate code", async () => {
    const prisma = {
      serviceCategory: { findUnique: async () => ({ id: "existing" }) },
    } as unknown as PrismaService;
    const svc = new ServiceCategoriesService(prisma, audit);
    await expect(svc.create(user, { code: "HOME_HEALTH", name: "Home Health" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("creates a new category", async () => {
    const prisma = {
      serviceCategory: { findUnique: async () => null, create: async () => row() },
    } as unknown as PrismaService;
    const svc = new ServiceCategoriesService(prisma, audit);
    const view = await svc.create(user, { code: "HOME_HEALTH", name: "Home Health" });
    expect(view.code).toBe("HOME_HEALTH");
    expect(view.active).toBe(true);
    expect(view.providerServicesCount).toBe(0);
  });

  it("soft-deactivates via setStatus and 404s an unknown id", async () => {
    const prisma = {
      serviceCategory: {
        findUnique: async ({ where }: { where: { id: string } }) => (where.id === "cat-1" ? { id: "cat-1" } : null),
        update: async () => row({ active: false }),
      },
    } as unknown as PrismaService;
    const svc = new ServiceCategoriesService(prisma, audit);
    const view = await svc.setStatus(user, "cat-1", { active: false });
    expect(view.active).toBe(false);
    await expect(svc.setStatus(user, "missing", { active: false })).rejects.toBeInstanceOf(NotFoundException);
  });
});
