import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { ProvidersService } from "../providers/providers.service";
import { PERMISSIONS } from "../../common/rbac";
import { PERMISSIONS_KEY } from "../auth/decorators";
import { OperationsService } from "./operations.service";
import { OperationsController } from "./operations.controller";
import type { ReadinessService } from "../readiness/readiness.service";
import type { ListOperationsCasesDto } from "./dto/operations.dto";

const providersStub = {
  list: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
} as unknown as ProvidersService;

const readinessStub = {
  operationsSummary: async () => ({
    readyForDischarge: 0,
    nearTermNotReady: 0,
    criticalBlockers: 0,
    placementMissing: 0,
    acceptedUnscheduled: 0,
    dischargedServiceNotStarted: 0,
    unsuccessfulServiceStarts: 0,
  }),
} as unknown as ReadinessService;

function baseQuery(over: Partial<ListOperationsCasesDto> = {}): ListOperationsCasesDto {
  return { page: 1, pageSize: 20, ...over } as ListOperationsCasesDto;
}

describe("OperationsService.summary", () => {
  it("aggregates platform-wide counts", async () => {
    const prisma = {
      case: { count: async () => 3 },
      provider: { count: async () => 2 },
      workflowEvent: { findMany: async () => [] },
      $transaction: (arr: Promise<unknown>[]) => Promise.all(arr),
    } as unknown as PrismaService;
    const svc = new OperationsService(prisma, providersStub, readinessStub);
    const r = await svc.summary();
    expect(r.cases.active).toBe(3);
    expect(r.cases.unassigned).toBe(3);
    expect(r.providers.active).toBe(2);
    expect(r.recentActivity).toEqual([]);
  });
});

describe("OperationsService.cases", () => {
  function svcWithCapture() {
    const findMany = jest.fn((_args: { where: Record<string, unknown> }) => Promise.resolve([] as unknown[]));
    const count = jest.fn((_args: { where: Record<string, unknown> }) => Promise.resolve(0));
    const prisma = {
      case: { findMany, count },
      $transaction: (arr: Promise<unknown>[]) => Promise.all(arr),
    } as unknown as PrismaService;
    return { svc: new OperationsService(prisma, providersStub, readinessStub), findMany };
  }

  it("is unfiltered (cross-organization) by default", async () => {
    const { svc, findMany } = svcWithCapture();
    await svc.cases(baseQuery());
    expect(findMany.mock.calls[0]![0].where).toEqual({});
  });

  it("applies an organization filter", async () => {
    const { svc, findMany } = svcWithCapture();
    await svc.cases(baseQuery({ organizationId: "org-1" }));
    expect(findMany.mock.calls[0]![0].where).toEqual({ AND: [{ organizationId: "org-1" }] });
  });

  it("applies unassigned-only as a compound clause", async () => {
    const { svc, findMany } = svcWithCapture();
    await svc.cases(baseQuery({ unassignedOnly: true }));
    const where = findMany.mock.calls[0]![0].where as { AND: Array<Record<string, unknown>> };
    expect(where.AND[0]!.assignedDischargeProfessionalId).toBeNull();
  });
});

describe("OperationsService.assignees", () => {
  it("404s an unknown case", async () => {
    const prisma = { case: { findUnique: async () => null } } as unknown as PrismaService;
    const svc = new OperationsService(prisma, providersStub, readinessStub);
    await expect(svc.assignees("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps eligible members for the case's organization", async () => {
    const prisma = {
      case: { findUnique: async () => ({ organizationId: "org-1" }) },
      organizationMembership: {
        findMany: async () => [
          { user: { id: "u1", email: "u1@x.com", firstName: "A", lastName: "B", displayName: null }, role: { name: "Discharge Professional" } },
        ],
      },
    } as unknown as PrismaService;
    const svc = new OperationsService(prisma, providersStub, readinessStub);
    const r = await svc.assignees("case-1");
    expect(r).toEqual([{ userId: "u1", name: "A B", email: "u1@x.com", roleName: "Discharge Professional" }]);
  });
});

describe("OperationsController access", () => {
  it("gates every route behind cases.read_all", () => {
    const proto = OperationsController.prototype;
    for (const method of ["summary", "cases", "assignees", "providers"] as const) {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, proto[method]);
      expect(perms).toContain(PERMISSIONS.CASES_READ_ALL);
    }
  });
});
