import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CasesService } from "./cases.service";
import type { PrismaService } from "../../database/prisma.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { AuditService } from "../audit/audit.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases.dto";
import type { CaseDetailRow } from "./cases.serializer";

function detailRow(id: string): CaseDetailRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    caseNumber: "NPC-20260101-ABCD1234",
    externalCaseId: null,
    status: "DRAFT",
    organizationId: "org",
    patientId: "pat",
    originatingFacilityId: "fac",
    dischargeProfessionalRef: null,
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
    organization: { id: "org", name: "General Hospital", type: "HOSPITAL" },
    patient: {
      id: "pat",
      organizationId: "org",
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
      organizationId: "org",
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
    serviceRequests: [],
    requirements: [],
    workflowEvents: [],
    _count: { requirements: 0, serviceRequests: 0 },
  };
}

describe("CasesService", () => {
  const workflow = { record: jest.fn() } as unknown as WorkflowEventsService;
  const audit = { record: jest.fn() } as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create validation", () => {
    it("rejects when neither patientId nor patient is provided", async () => {
      const prisma = {} as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const dto = { organizationId: "org", originatingFacilityId: "fac" } as unknown as CreateCaseDto;
      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when both patientId and patient are provided", async () => {
      const prisma = {} as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const dto = {
        organizationId: "org",
        originatingFacilityId: "fac",
        patientId: "pat",
        patient: { firstName: "Jane", lastName: "Doe" },
      } as unknown as CreateCaseDto;
      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("create happy path", () => {
    it("creates the case and records workflow + audit events atomically", async () => {
      const tx = {
        organization: { findUnique: jest.fn().mockResolvedValue({ id: "org" }) },
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

      const dto = {
        organizationId: "org",
        originatingFacilityId: "fac",
        patient: { firstName: "Jane", lastName: "Doe" },
      } as unknown as CreateCaseDto;

      const result = await service.create(dto);

      expect(result.id).toBe("case1");
      expect(tx.patient.create).toHaveBeenCalledTimes(1);
      expect(tx.case.create).toHaveBeenCalledTimes(1);
      expect(workflow.record).toHaveBeenCalledWith(expect.objectContaining({ type: "CASE_CREATED" }), tx);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "case.created" }), tx);
    });

    it("rejects when the facility does not belong to the organization", async () => {
      const tx = {
        organization: { findUnique: jest.fn().mockResolvedValue({ id: "org" }) },
        facility: { findUnique: jest.fn().mockResolvedValue({ id: "fac", organizationId: "other-org" }) },
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);

      const dto = {
        organizationId: "org",
        originatingFacilityId: "fac",
        patient: { firstName: "Jane", lastName: "Doe" },
      } as unknown as CreateCaseDto;

      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("list", () => {
    it("returns a normalized paginated result", async () => {
      const prisma = {
        case: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        $transaction: jest.fn().mockResolvedValue([[], 0]),
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);

      const result = await service.list({ page: 1, pageSize: 20 } as ListCasesQueryDto);
      expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when the case does not exist", async () => {
      const prisma = {
        case: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a case detail when found", async () => {
      const prisma = {
        case: { findUnique: jest.fn().mockResolvedValue(detailRow("c1")) },
      } as unknown as PrismaService;
      const service = new CasesService(prisma, workflow, audit);
      const result = await service.findOne("c1");
      expect(result.id).toBe("c1");
      expect(result.patient.displayName).toBe("Jane Doe");
    });
  });
});
