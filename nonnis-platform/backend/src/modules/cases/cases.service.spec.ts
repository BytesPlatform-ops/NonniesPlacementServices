import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CasesService } from "./cases.service";
import type { PrismaService } from "../../database/prisma.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { AuditService } from "../audit/audit.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases.dto";
import type { CaseDetailRow } from "./cases.serializer";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    supabaseUserId: "sb-1",
    email: "u@example.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    activeOrganizationId: "org",
    activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_CREATE]),
    ...overrides,
  };
}

function detailRow(id: string, organizationId = "org"): CaseDetailRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    caseNumber: "NPC-20260101-ABCD1234",
    externalCaseId: null,
    status: "DRAFT",
    organizationId,
    patientId: "pat",
    originatingFacilityId: "fac",
    dischargeProfessionalRef: null,
    assignedDischargeProfessionalId: "user-1",
    expectedDischargeDate: null,
    actualDischargeDate: null,
    currentCareSetting: null,
    preferredServiceLocation: null,
    primaryLanguage: null,
    interpreterRequired: false,
    communicationPreference: null,
    accessibilityNeeds: [],
    metadata: null,
    createdAt: now,
    updatedAt: now,
    organization: { id: organizationId, name: "General Hospital", type: "HOSPITAL" },
    patient: {
      id: "pat",
      organizationId,
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: null,
      externalRef: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    },
    originatingFacility: {
      id: "fac",
      organizationId,
      status: "ACTIVE",
      name: "Main Campus",
      externalRef: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: "US",
      phone: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    },
    assignedDischargeProfessional: { id: "user-1", firstName: "Jane", lastName: "Doe", displayName: null },
    serviceRequests: [],
    requirements: [],
    workflowEvents: [],
    _count: { requirements: 0, serviceRequests: 0 },
  };
}

describe("CasesService", () => {
  const workflow = { record: jest.fn() } as unknown as WorkflowEventsService;
  const audit = { record: jest.fn() } as unknown as AuditService;

  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("rejects when there is no active organization context", async () => {
      const prisma = {} as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const user = makeUser({ activeOrganizationId: null });
      const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;
      await expect(service.create(user, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when neither patientId nor patient is provided", async () => {
      const prisma = {} as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const dto = { originatingFacilityId: "fac" } as unknown as CreateCaseDto;
      await expect(service.create(makeUser(), dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates the case in the active org and records workflow + audit with the actor", async () => {
      const tx = {
        facility: { findUnique: jest.fn().mockResolvedValue({ id: "fac", organizationId: "org" }) },
        patient: { create: jest.fn().mockResolvedValue({ id: "pat" }) },
        case: {
          create: jest.fn().mockResolvedValue({ id: "case1", caseNumber: "NPC-X", status: "DRAFT" }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(detailRow("case1")),
        },
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;

      const result = await service.create(makeUser(), dto);

      expect(result.id).toBe("case1");
      expect(tx.case.create).toHaveBeenCalledTimes(1);
      const created = tx.case.create.mock.calls[0][0];
      expect(created.data.organizationId).toBe("org");
      expect(created.data.assignedDischargeProfessionalId).toBe("user-1");
      expect(workflow.record).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "user-1", source: "MANUAL" }), tx);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "case.created", actorUserId: "user-1" }), tx);
    });

    it("rejects creating against a facility in another organization", async () => {
      const tx = { facility: { findUnique: jest.fn().mockResolvedValue({ id: "fac", organizationId: "other-org" }) } };
      const prisma = {
        $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;
      await expect(service.create(makeUser(), dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("list", () => {
    it("scopes the query to the active organization", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const prisma = {
        case: { findMany, count },
        $transaction: jest.fn().mockResolvedValue([[], 0]),
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);

      const result = await service.list(makeUser(), { page: 1, pageSize: 20 } as ListCasesQueryDto);
      expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
      expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: "org" });
    });

    it("requires an active organization", async () => {
      const prisma = {} as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      await expect(
        service.list(makeUser({ activeOrganizationId: null }), { page: 1, pageSize: 20 } as ListCasesQueryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("returns a case in the active organization", async () => {
      const prisma = {
        case: { findUnique: jest.fn().mockResolvedValue(detailRow("c1", "org")) },
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const result = await service.findOne(makeUser(), "c1");
      expect(result.id).toBe("c1");
    });

    it("hides a case from another organization as 404", async () => {
      const prisma = {
        case: { findUnique: jest.fn().mockResolvedValue(detailRow("c1", "other-org")) },
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      await expect(service.findOne(makeUser(), "c1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("allows cross-organization read with cases.read_all", async () => {
      const prisma = {
        case: { findUnique: jest.fn().mockResolvedValue(detailRow("c1", "other-org")) },
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const user = makeUser({ activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_READ_ALL]) });
      const result = await service.findOne(user, "c1");
      expect(result.id).toBe("c1");
    });

    it("returns 404 when the case does not exist", async () => {
      const prisma = { case: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      await expect(service.findOne(makeUser(), "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
