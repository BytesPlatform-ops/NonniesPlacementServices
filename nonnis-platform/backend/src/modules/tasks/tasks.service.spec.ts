import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { RequestUser } from "../auth/request-user";
import { TasksService } from "./tasks.service";
import type { TaskAccessService } from "./task-access";

const user = { id: "user-1" } as unknown as RequestUser;
const workflowEvents = { record: async () => undefined } as unknown as WorkflowEventsService;
const audit = { record: async () => undefined } as unknown as AuditService;
const ASSIGNEE = "22222222-2222-2222-2222-222222222222";

function task(over: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    organizationId: "org-1",
    caseId: "case-1",
    title: "Confirm transport",
    description: null,
    priority: "NORMAL",
    status: "OPEN",
    assigneeUserId: null,
    createdByUserId: "user-1",
    dueAt: null,
    completedAt: null,
    completedByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

describe("TasksService.create", () => {
  it("rejects an ineligible assignee", async () => {
    const access = { ensureCaseAccess: async () => "org-1", isEligibleAssignee: async () => false } as unknown as TaskAccessService;
    const prisma = {} as unknown as PrismaService;
    const svc = new TasksService(prisma, workflowEvents, audit, access);
    await expect(svc.create(user, "case-1", { title: "x", assigneeUserId: ASSIGNEE })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("TasksService.transition", () => {
  it("rejects an illegal transition", async () => {
    const access = { loadTask: async () => task({ status: "COMPLETED" }) } as unknown as TaskAccessService;
    const prisma = {} as unknown as PrismaService;
    const svc = new TasksService(prisma, workflowEvents, audit, access);
    await expect(svc.transition(user, "task-1", "IN_PROGRESS", "TASK_STARTED")).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("sets completedAt/By when completing", async () => {
    let updateArg: { data: Record<string, unknown> } | null = null;
    const access = { loadTask: async () => task({ status: "IN_PROGRESS" }) } as unknown as TaskAccessService;
    const prisma = {
      $transaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          task: {
            update: async (arg: { data: Record<string, unknown> }) => {
              updateArg = arg;
              return task({ status: "COMPLETED", completedAt: new Date(), completedByUserId: "user-1" });
            },
          },
        }),
      user: { findMany: async () => [] },
    } as unknown as PrismaService;
    const svc = new TasksService(prisma, workflowEvents, audit, access);
    const r = await svc.transition(user, "task-1", "COMPLETED", "TASK_COMPLETED");
    expect(r.status).toBe("COMPLETED");
    expect(updateArg!.data.completedByUserId).toBe("user-1");
    expect(updateArg!.data.completedAt).toBeInstanceOf(Date);
  });
});
