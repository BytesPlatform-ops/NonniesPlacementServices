import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { CaseStatus } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { AuditService } from "../audit/audit.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { ReadinessService } from "./readiness.service";

const CREATED = new Date("2026-01-01T00:00:00.000Z");

function readyCaseRow(over: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    organizationId: "org-1",
    status: "ACCEPTED" as CaseStatus,
    blocked: false,
    assignedDischargeProfessionalId: "user-1",
    expectedDischargeDate: new Date("2026-02-05T00:00:00.000Z"),
    actualDischargeDate: null,
    currentCareSetting: "HOSPITAL",
    preferredServiceLocation: "Home",
    patientContactPhone: "555",
    representativeContact: null,
    createdAt: CREATED,
    requirements: [],
    serviceRequests: [
      {
        id: "sr-1",
        category: "HOME_HEALTH",
        status: "REQUESTED",
        levelOfCare: "SKILLED",
        requestedStartDate: new Date("2026-02-01T00:00:00.000Z"),
        transportationRequired: false,
        equipmentNeeds: null,
        fundingSource: "Medicare",
        insurancePlan: null,
        referrals: [{ placement: { status: "SCHEDULED", scheduledStartAt: new Date("2026-02-01T00:00:00.000Z"), actualStartAt: null } }],
      },
    ],
    ...over,
  };
}

function makeUser(over: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    activeOrganizationId: "org-1",
    activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_UPDATE]),
    memberships: [],
    ...over,
  } as unknown as RequestUser;
}

function build(row: Record<string, unknown> | null) {
  const txCaseUpdate = jest.fn(async () => ({}));
  const prisma = {
    case: {
      findUnique: jest.fn(async () => row),
      update: jest.fn(async () => ({})),
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ case: { update: txCaseUpdate } }),
  } as unknown as PrismaService;
  const workflowEvents = { record: jest.fn(async () => ({})) } as unknown as WorkflowEventsService;
  const audit = { record: jest.fn(async () => ({})) } as unknown as AuditService;
  const svc = new ReadinessService(prisma, workflowEvents, audit);
  return { svc, prisma, workflowEvents, audit, txCaseUpdate };
}

describe("ReadinessService.getReadiness (access)", () => {
  it("returns readiness for an authorized case-org user", async () => {
    const { svc } = build(readyCaseRow());
    const r = await svc.getReadiness(makeUser(), "case-1");
    expect(r.ready).toBe(true);
    expect(r.caseId).toBe("case-1");
  });

  it("denies a foreign-organization user without read_all (404)", async () => {
    const { svc } = build(readyCaseRow({ organizationId: "org-2" }));
    await expect(svc.getReadiness(makeUser(), "case-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows a Nonnis read_all user cross-org", async () => {
    const { svc } = build(readyCaseRow({ organizationId: "org-2" }));
    const user = makeUser({ activePermissions: new Set([PERMISSIONS.CASES_READ, PERMISSIONS.CASES_READ_ALL]) as Set<string> });
    const r = await svc.getReadiness(user, "case-1");
    expect(r.ready).toBe(true);
  });

  it("does not change status merely by reading readiness", async () => {
    const { svc, txCaseUpdate } = build(readyCaseRow());
    await svc.getReadiness(makeUser(), "case-1");
    expect(txCaseUpdate).not.toHaveBeenCalled();
  });
});

describe("ReadinessService.markReadyForDischarge", () => {
  it("transitions a ready case to READY_FOR_DISCHARGE with the actor recorded", async () => {
    const { svc, txCaseUpdate, workflowEvents } = build(readyCaseRow());
    await svc.markReadyForDischarge(makeUser(), "case-1");
    expect(txCaseUpdate).toHaveBeenCalledWith({ where: { id: "case-1" }, data: { status: "READY_FOR_DISCHARGE" } });
    expect(workflowEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: "STATUS_CHANGED", newStatus: "READY_FOR_DISCHARGE", actorUserId: "user-1", source: "MANUAL" }),
      expect.anything(),
    );
  });

  it("rejects a not-ready case with structured blockers and no status change", async () => {
    const { svc, txCaseUpdate } = build(readyCaseRow({ blocked: true }));
    await expect(svc.markReadyForDischarge(makeUser(), "case-1")).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(txCaseUpdate).not.toHaveBeenCalled();
  });
});

describe("ReadinessService.markDischarged", () => {
  it("requires READY_FOR_DISCHARGE", async () => {
    const { svc } = build(readyCaseRow({ status: "ACCEPTED" }));
    await expect(svc.markDischarged(makeUser(), "case-1", "2026-02-06T00:00:00.000Z")).rejects.toBeInstanceOf(ConflictException);
  });

  it("stamps the actual discharge date and moves to DISCHARGED", async () => {
    const { svc, txCaseUpdate } = build(readyCaseRow({ status: "READY_FOR_DISCHARGE" }));
    await svc.markDischarged(makeUser(), "case-1", "2026-02-06T00:00:00.000Z");
    expect(txCaseUpdate).toHaveBeenCalledWith({
      where: { id: "case-1" },
      data: { status: "DISCHARGED", actualDischargeDate: new Date("2026-02-06T00:00:00.000Z") },
    });
  });

  it("rejects a discharge date preceding case creation", async () => {
    const { svc } = build(readyCaseRow({ status: "READY_FOR_DISCHARGE" }));
    await expect(svc.markDischarged(makeUser(), "case-1", "2025-12-01T00:00:00.000Z")).rejects.toBeTruthy();
  });
});

describe("ReadinessService.markServiceStarted", () => {
  it("rejects when not all required placements have started", async () => {
    const { svc } = build(readyCaseRow({ status: "DISCHARGED" }));
    await expect(svc.markServiceStarted(makeUser(), "case-1")).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("advances a discharged case whose placements have all started", async () => {
    const row = readyCaseRow({
      status: "DISCHARGED",
      serviceRequests: [
        {
          id: "sr-1",
          category: "HOME_HEALTH",
          status: "REQUESTED",
          levelOfCare: "SKILLED",
          requestedStartDate: new Date(),
          transportationRequired: false,
          equipmentNeeds: null,
          fundingSource: "Medicare",
          insurancePlan: null,
          referrals: [{ placement: { status: "STARTED", scheduledStartAt: new Date(), actualStartAt: new Date() } }],
        },
      ],
    });
    const { svc, txCaseUpdate } = build(row);
    await svc.markServiceStarted(makeUser(), "case-1");
    expect(txCaseUpdate).toHaveBeenCalledWith({ where: { id: "case-1" }, data: { status: "SERVICE_STARTED" } });
  });
});

describe("ReadinessService.markCompleted", () => {
  it("rejects premature completion", async () => {
    const { svc } = build(readyCaseRow({ status: "ACCEPTED" }));
    await expect(svc.markCompleted(makeUser(), "case-1")).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
