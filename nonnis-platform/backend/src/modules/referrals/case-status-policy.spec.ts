import type { Prisma } from "@prisma/client";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import { allServiceRequestsPlaced, applyCaseStatus } from "./case-status-policy";

const workflowEvents = { record: async () => undefined } as unknown as WorkflowEventsService;

describe("applyCaseStatus", () => {
  it("advances only from an allowed prior state", async () => {
    let updated: { status?: string } | null = null;
    const tx = {
      case: {
        findUnique: async () => ({ status: "READY_FOR_REVIEW", organizationId: "org" }),
        update: async (arg: { data: { status: string } }) => {
          updated = arg.data;
          return {};
        },
      },
    } as unknown as Prisma.TransactionClient;
    const applied = await applyCaseStatus(tx, workflowEvents, "case-1", "MATCHING", ["READY_FOR_REVIEW"], "user-1");
    expect(applied).toBe(true);
    expect(updated!.status).toBe("MATCHING");
  });

  it("is a no-op from a disallowed state", async () => {
    const tx = {
      case: { findUnique: async () => ({ status: "ACCEPTED", organizationId: "org" }), update: async () => ({}) },
    } as unknown as Prisma.TransactionClient;
    const applied = await applyCaseStatus(tx, workflowEvents, "case-1", "REFERRAL_SENT", ["READY_FOR_REVIEW", "MATCHING"], "user-1");
    expect(applied).toBe(false);
  });
});

describe("allServiceRequestsPlaced", () => {
  it("returns false when any non-cancelled service request lacks an accepted placement", async () => {
    const tx = {
      serviceRequest: { findMany: async () => [{ id: "sr-1" }, { id: "sr-2" }] },
      referral: {
        findFirst: async (arg: { where: { serviceRequestId: string } }) =>
          arg.where.serviceRequestId === "sr-1" ? { id: "r-1" } : null,
      },
    } as unknown as Prisma.TransactionClient;
    expect(await allServiceRequestsPlaced(tx, "case-1")).toBe(false);
  });

  it("returns true only when every service request is placed", async () => {
    const tx = {
      serviceRequest: { findMany: async () => [{ id: "sr-1" }, { id: "sr-2" }] },
      referral: { findFirst: async () => ({ id: "r" }) },
    } as unknown as Prisma.TransactionClient;
    expect(await allServiceRequestsPlaced(tx, "case-1")).toBe(true);
  });

  it("returns false when there are no service requests", async () => {
    const tx = {
      serviceRequest: { findMany: async () => [] },
      referral: { findFirst: async () => null },
    } as unknown as Prisma.TransactionClient;
    expect(await allServiceRequestsPlaced(tx, "case-1")).toBe(false);
  });
});
