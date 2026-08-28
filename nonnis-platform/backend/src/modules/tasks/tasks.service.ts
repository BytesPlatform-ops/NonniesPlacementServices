import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, type Task, type WorkflowEventType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { RequestUser } from "../auth/request-user";
import { TaskAccessService } from "./task-access";
import { toTaskView, type CaseTaskView } from "./tasks.serializer";
import { canTransitionTask, isTaskEditable } from "./task-transition";
import type { CancelTaskDto, CreateTaskDto, ListTasksDto, UpdateTaskDto } from "./dto/tasks.dto";

export interface EligibleAssignee {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
    private readonly audit: AuditService,
    private readonly access: TaskAccessService,
  ) {}

  private async resolveNames(ids: Array<string | null | undefined>): Promise<Map<string, string | null>> {
    const list = Array.from(new Set(ids.filter((v): v is string => Boolean(v))));
    const map = new Map<string, string | null>();
    if (list.length === 0) return map;
    const users = await this.prisma.user.findMany({
      where: { id: { in: list } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    for (const u of users) map.set(u.id, u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
    return map;
  }

  private async view(task: Task): Promise<CaseTaskView> {
    const names = await this.resolveNames([task.assigneeUserId, task.createdByUserId, task.completedByUserId]);
    return toTaskView(task, names);
  }

  private async event(tx: Prisma.TransactionClient, organizationId: string, caseId: string, type: WorkflowEventType, actorUserId: string, metadata?: Prisma.InputJsonValue) {
    await this.workflowEvents.record({ organizationId, caseId, type, source: "MANUAL", actorUserId, metadata }, tx);
  }

  async create(user: RequestUser, caseId: string, dto: CreateTaskDto): Promise<CaseTaskView> {
    const organizationId = await this.access.ensureCaseAccess(user, caseId);
    if (dto.assigneeUserId && !(await this.access.isEligibleAssignee(dto.assigneeUserId, organizationId))) {
      throw new BadRequestException("The selected assignee is not eligible for this case.");
    }
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          organizationId,
          caseId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? "NORMAL",
          assigneeUserId: dto.assigneeUserId,
          createdByUserId: user.id,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        },
      });
      await this.event(tx, organizationId, caseId, "TASK_CREATED", user.id, { taskId: created.id, title: created.title });
      if (dto.assigneeUserId) await this.event(tx, organizationId, caseId, "TASK_ASSIGNED", user.id, { taskId: created.id, assigneeUserId: dto.assigneeUserId });
      return created;
    });
    return this.view(task);
  }

  async listForCase(user: RequestUser, caseId: string, query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    await this.access.ensureCaseAccess(user, caseId);
    return this.paginate([{ caseId }], query);
  }

  async myTasks(user: RequestUser, query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    return this.paginate([{ assigneeUserId: user.id }], query);
  }

  async operationsList(query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    const and: Prisma.TaskWhereInput[] = [];
    if (query.organizationId) and.push({ organizationId: query.organizationId });
    if (query.assigneeUserId) and.push({ assigneeUserId: query.assigneeUserId });
    if (query.search) and.push({ title: { contains: query.search, mode: "insensitive" } });
    return this.paginate(and, query);
  }

  private async paginate(base: Prisma.TaskWhereInput[], query: ListTasksDto): Promise<PaginatedResult<CaseTaskView>> {
    const now = new Date();
    const and = [...base];
    if (query.status) and.push({ status: query.status });
    if (query.priority) and.push({ priority: query.priority });
    if (query.assignedToMe === false) {
      /* no-op */
    }
    if (query.openOnly) and.push({ status: { in: ["OPEN", "IN_PROGRESS"] } });
    if (query.overdueOnly) and.push({ dueAt: { lt: now }, status: { in: ["OPEN", "IN_PROGRESS"] } });

    const where: Prisma.TaskWhereInput = and.length > 0 ? { AND: and } : {};
    const sortField = query.sort && ["dueAt", "createdAt", "priority", "updatedAt"].includes(query.sort) ? query.sort : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, orderBy: { [sortField]: order }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.task.count({ where }),
    ]);
    const names = await this.resolveNames(rows.flatMap((t) => [t.assigneeUserId, t.createdByUserId, t.completedByUserId]));
    return {
      items: rows.map((t) => toTaskView(t, names, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async findOne(user: RequestUser, id: string): Promise<CaseTaskView> {
    const task = await this.access.loadTask(user, id);
    return this.view(task);
  }

  async update(user: RequestUser, id: string, dto: UpdateTaskDto): Promise<CaseTaskView> {
    const task = await this.access.loadTask(user, id, true);
    if (!isTaskEditable(task.status)) throw new UnprocessableEntityException("A completed or cancelled task cannot be edited.");
    const reassigning = dto.assigneeUserId !== undefined && (dto.assigneeUserId ?? null) !== task.assigneeUserId;
    if (dto.assigneeUserId) {
      if (!(await this.access.isEligibleAssignee(dto.assigneeUserId, task.organizationId))) {
        throw new BadRequestException("The selected assignee is not eligible for this case.");
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          assigneeUserId: dto.assigneeUserId,
        },
      });
      await this.event(tx, task.organizationId, task.caseId, "TASK_UPDATED", user.id, { taskId: id, fields: Object.keys(dto) });
      if (reassigning) {
        await this.event(tx, task.organizationId, task.caseId, task.assigneeUserId ? "TASK_REASSIGNED" : "TASK_ASSIGNED", user.id, { taskId: id, assigneeUserId: dto.assigneeUserId ?? null });
        await this.audit.record({ action: "task.reassigned", entityType: "Task", entityId: id, organizationId: task.organizationId, actorUserId: user.id, metadata: { from: task.assigneeUserId, to: dto.assigneeUserId ?? null } }, tx);
      }
      return next;
    });
    return this.view(updated);
  }

  async transition(user: RequestUser, id: string, to: Task["status"], type: WorkflowEventType): Promise<CaseTaskView> {
    const task = await this.access.loadTask(user, id, true);
    if (!canTransitionTask(task.status, to)) throw new UnprocessableEntityException(`A ${task.status} task cannot move to ${to}.`);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id },
        data: { status: to, ...(to === "COMPLETED" ? { completedAt: new Date(), completedByUserId: user.id } : {}) },
      });
      await this.event(tx, task.organizationId, task.caseId, type, user.id, { taskId: id });
      return next;
    });
    return this.view(updated);
  }

  async cancel(user: RequestUser, id: string, dto: CancelTaskDto): Promise<CaseTaskView> {
    const task = await this.access.loadTask(user, id, true);
    if (!canTransitionTask(task.status, "CANCELLED")) throw new ConflictException("This task can no longer be cancelled.");
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.task.update({ where: { id }, data: { status: "CANCELLED" } });
      await this.event(tx, task.organizationId, task.caseId, "TASK_CANCELLED", user.id, { taskId: id, reason: dto.reason ?? null });
      await this.audit.record({ action: "task.cancelled", entityType: "Task", entityId: id, organizationId: task.organizationId, actorUserId: user.id, metadata: dto.reason ? { reason: dto.reason } : undefined }, tx);
      return next;
    });
    return this.view(updated);
  }

  async eligibleAssignees(user: RequestUser, caseId: string): Promise<EligibleAssignee[]> {
    const organizationId = await this.access.ensureCaseAccess(user, caseId);
    const members = await this.prisma.organizationMembership.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } }, role: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.user.id,
      name: m.user.displayName || `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email,
      email: m.user.email,
      roleName: m.role.name,
    }));
  }
}
