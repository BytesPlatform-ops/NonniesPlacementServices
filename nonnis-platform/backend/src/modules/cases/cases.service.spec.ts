import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { CasesService } from "./cases.service";
import type { PrismaService } from "../../database/prisma.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { AuditService } from "../audit/audit.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases.dto";
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
    activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_CREATE, PERMISSIONS.CASES_UPDATE, PERMISSIONS.CASES_ASSIGN]),
    ...overrides,
  };
}

const now = new Date("2026-01-01T00:00:00.000Z");

function srRow(over: Record<string, unknown> = {}) {
  return {
    id: "sr1",
    status: "REQUESTED",
    category: "HOME_HEALTH",
    levelOfCare: "SKILLED",
    requestedStartDate: new Date("2026-02-01T00:00:00.000Z"),
    frequency: null,
    durationText: null,
    serviceCity: null,
    serviceState: null,
    servicePostalCode: null,
    serviceRadiusMiles: null,
    fundingSource: null,
    insurancePlan: null,
    authorizationReference: null,
    requiredQualifications: null,
    mandatoryLanguage: null,
    equipmentNeeds: null,
    transportationRequired: false,
    notes: null,
    ...over,
  };
}

function detailRow(over: Record<string, unknown> = {}) {
  return {
    id: "case1",
    caseNumber: "NPC-X",
    externalCaseId: null,
    status: "DRAFT",
    organizationId: "org",
    patientId: "pat",
    originatingFacilityId: "fac",
    dischargeProfessionalRef: null,
    assignedDischargeProfessionalId: "user-1",
    expectedDischargeDate: new Date("2026-02-01T00:00:00.000Z"),
    actualDischargeDate: null,
    currentCareSetting: "HOME",
    preferredServiceLocation: "Tacoma, WA",
    primaryLanguage: null,
    interpreterRequired: false,
    communicationPreference: null,
    accessibilityNeeds: [],
    patientContactPhone: "555-0100",
    representativeName: null,
    representativeRelationship: null,
    representativeContact: null,
    blocked: false,
    blockReason: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    organization: { id: "org", name: "Org", type: "HOSPITAL" },
    patient: { id: "pat", organizationId: "org", firstName: "Jane", lastName: "Doe", dateOfBirth: null, externalRef: null, metadata: null, createdAt: now, updatedAt: now },
    originatingFacility: { id: "fac", organizationId: "org", status: "ACTIVE", name: "Main", externalRef: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, country: "US", phone: null, metadata: null, createdAt: now, updatedAt: now },
    assignedDischargeProfessional: { id: "user-1", firstName: "Jane", lastName: "Doe", displayName: null },
    serviceRequests: [srRow()],
    requirements: [],
    workflowEvents: [],
    _count: { requirements: 0, serviceRequests: 1 },
    ...over,
  };
}

function makePrisma(over: Record<string, unknown> = {}) {
  const p: Record<string, unknown> = {
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "case1", caseNumber: "NPC-X", status: "DRAFT" }),
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue(detailRow()),
    },
    facility: { findUnique: jest.fn().mockResolvedValue({ id: "fac", organizationId: "org" }) },
    patient: { create: jest.fn().mockResolvedValue({ id: "pat" }) },
    organizationMembership: { findFirst: jest.fn().mockResolvedValue({ id: "m" }) },
    ...over,
  };
  p.$transaction = jest.fn().mockImplementation((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(p),
  );
  return p as unknown as PrismaService;
}

function service(prisma: PrismaService) {
  const workflow = { record: jest.fn() } as unknown as WorkflowEventsService;
  const audit = { record: jest.fn() } as unknown as AuditService;
  return { svc: new CasesService(prisma, workflow, audit), workflow, audit };
}

describe("CasesService — create & scope", () => {
  it("requires an active organization to create", async () => {
    const { svc } = service(makePrisma());
    const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;
    await expect(svc.create(makeUser({ activeOrganizationId: null }), dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates in the active org, assigns creator, records workflow + audit", async () => {
    const { svc, workflow, audit } = service(makePrisma());
    const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;
    const result = await svc.create(makeUser(), dto);
    expect(result.id).toBe("case1");
    expect(workflow.record).toHaveBeenCalledWith(expect.objectContaining({ type: "CASE_CREATED", actorUserId: "user-1" }), expect.anything());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "case.created" }), expect.anything());
  });

  it("rejects a facility in another organization", async () => {
    const prisma = makePrisma({ facility: { findUnique: jest.fn().mockResolvedValue({ id: "fac", organizationId: "other" }) } });
    const { svc } = service(prisma);
    const dto = { originatingFacilityId: "fac", patient: { firstName: "A", lastName: "B" } } as unknown as CreateCaseDto;
    await expect(svc.create(makeUser(), dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("scopes the list to the active organization", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ case: { findMany, count: jest.fn().mockResolvedValue(0) } });
    const { svc } = service(prisma);
    await svc.list(makeUser(), { page: 1, pageSize: 20 } as ListCasesQueryDto);
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ organizationId: "org" });
  });

  it("hides a cross-org case as 404, but allows cases.read_all", async () => {
    const prismaCross = makePrisma({ case: { ...(makePrisma() as unknown as { case: object }).case, findUnique: jest.fn().mockResolvedValue(detailRow({ organizationId: "other" })) } });
    const { svc } = service(prismaCross);
    await expect(svc.findOne(makeUser(), "case1")).rejects.toBeInstanceOf(NotFoundException);

    const { svc: svc2 } = service(makePrisma({ case: { findUnique: jest.fn().mockResolvedValue(detailRow({ organizationId: "other" })) } }));
    const result = await svc2.findOne(makeUser({ activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_READ_ALL]) }), "case1");
    expect(result.id).toBe("case1");
  });
});

describe("CasesService — update, transition, assignment", () => {
  it("rejects editing a terminal case", async () => {
    const prisma = makePrisma({ case: { findUnique: jest.fn().mockResolvedValue(detailRow({ status: "CANCELLED" })) } });
    const { svc } = service(prisma);
    await expect(svc.update(makeUser(), "case1", { primaryLanguage: "es" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects an illegal manual status jump", async () => {
    const prisma = makePrisma({ case: { findUnique: jest.fn().mockResolvedValue(detailRow()), findUniqueOrThrow: jest.fn(), update: jest.fn() } });
    const { svc } = service(prisma);
    await expect(svc.transition(makeUser(), "case1", { toStatus: "MATCHING" })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("blocks DRAFT → READY_FOR_REVIEW when the case is incomplete", async () => {
    const incomplete = detailRow({ preferredServiceLocation: null, assignedDischargeProfessionalId: null, serviceRequests: [] });
    const prisma = makePrisma({ case: { findUnique: jest.fn().mockResolvedValue(incomplete), findUniqueOrThrow: jest.fn(), update: jest.fn() } });
    const { svc } = service(prisma);
    await expect(svc.transition(makeUser(), "case1", { toStatus: "READY_FOR_REVIEW" })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("allows DRAFT → READY_FOR_REVIEW when complete and records the transition", async () => {
    const complete = detailRow();
    const reviewRow = detailRow({ status: "READY_FOR_REVIEW" });
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ case: { findUnique: jest.fn().mockResolvedValue(complete), findUniqueOrThrow: jest.fn().mockResolvedValue(reviewRow), update } });
    const { svc, workflow } = service(prisma);
    const result = await svc.transition(makeUser(), "case1", { toStatus: "READY_FOR_REVIEW" });
    expect(result.status).toBe("READY_FOR_REVIEW");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "READY_FOR_REVIEW" } }));
    expect(workflow.record).toHaveBeenCalledWith(expect.objectContaining({ type: "STATUS_CHANGED", previousStatus: "DRAFT", newStatus: "READY_FOR_REVIEW" }), expect.anything());
  });

  it("assigns an eligible user and records CASE_ASSIGNED", async () => {
    const unassigned = detailRow({ assignedDischargeProfessionalId: null, assignedDischargeProfessional: null });
    const prisma = makePrisma({
      case: { findUnique: jest.fn().mockResolvedValue(unassigned), findUniqueOrThrow: jest.fn().mockResolvedValue(detailRow()), update: jest.fn() },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue({ id: "m" }) },
    });
    const { svc, workflow } = service(prisma);
    await svc.assign(makeUser(), "case1", { assignedUserId: "user-2" });
    expect(workflow.record).toHaveBeenCalledWith(expect.objectContaining({ type: "CASE_ASSIGNED" }), expect.anything());
  });

  it("rejects assigning an ineligible user", async () => {
    const prisma = makePrisma({
      case: { findUnique: jest.fn().mockResolvedValue(detailRow()), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const { svc } = service(prisma);
    await expect(svc.assign(makeUser(), "case1", { assignedUserId: "user-2" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
