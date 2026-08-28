import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Task } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";

/**
 * Task access control. Case tasks are bounded by the case organization (unless
 * tasks.read_all). Assignees must be active members of the case organization or
 * Nonnis staff. `assigneeUserId` from the browser is validated, never trusted.
 */
@Injectable()
export class TaskAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private memberOf(user: RequestUser, organizationId: string): boolean {
    return user.memberships.some((m) => m.organizationId === organizationId);
  }

  async ensureCaseAccess(user: RequestUser, caseId: string): Promise<string> {
    const c = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.TASKS_READ_ALL);
    if (!readAll && !this.memberOf(user, c.organizationId)) throw new NotFoundException(`Case ${caseId} not found`);
    return c.organizationId;
  }

  async loadTask(user: RequestUser, taskId: string, forWrite = false): Promise<Task> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    const readAll = user.activePermissions.has(PERMISSIONS.TASKS_READ_ALL);
    if (!readAll && !this.memberOf(user, task.organizationId)) throw new NotFoundException(`Task ${taskId} not found`);
    if (forWrite && !user.activePermissions.has(PERMISSIONS.TASKS_MANAGE)) {
      throw new ForbiddenException("You do not have permission to manage this task.");
    }
    return task;
  }

  /** Eligible = active member of the case org, or active Nonnis staff. */
  async isEligibleAssignee(assigneeUserId: string, caseOrganizationId: string): Promise<boolean> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: assigneeUserId,
        status: "ACTIVE",
        OR: [{ organizationId: caseOrganizationId }, { organization: { type: "NONNIS" } }],
      },
      select: { id: true },
    });
    return membership !== null;
  }
}
