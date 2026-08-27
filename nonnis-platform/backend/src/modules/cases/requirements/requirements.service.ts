import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { RequestUser } from "../../auth/request-user";
import { WorkflowEventsService } from "../../workflow-events/workflow-events.service";
import { ensureCaseAccess } from "../case-access";
import { toRequirementView, type CaseRequirementView } from "../cases.serializer";
import type { CreateRequirementDto, UpdateRequirementDto } from "./requirements.dto";

const requirementInclude = { completedBy: { select: { id: true, firstName: true, lastName: true, displayName: true } } };

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
  ) {}

  async list(user: RequestUser, caseId: string): Promise<CaseRequirementView[]> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    const rows = await this.prisma.caseRequirement.findMany({
      where: { caseId },
      include: requirementInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRequirementView);
  }

  async create(user: RequestUser, caseId: string, dto: CreateRequirementDto): Promise<CaseRequirementView> {
    const kase = await ensureCaseAccess(this.prisma, user, caseId, true);

    if (dto.serviceRequestId) {
      const sr = await this.prisma.serviceRequest.findFirst({ where: { id: dto.serviceRequestId, caseId } });
      if (!sr) throw new BadRequestException("Service request does not belong to this case.");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.caseRequirement.create({
        data: {
          caseId,
          serviceRequestId: dto.serviceRequestId,
          category: dto.category,
          label: dto.label,
          detail: dto.detail,
          mandatory: dto.mandatory ?? true,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
        include: requirementInclude,
      });
      await this.workflowEvents.record(
        { organizationId: kase.organizationId, caseId, type: "REQUIREMENT_ADDED", source: "MANUAL", actorUserId: user.id, metadata: { requirementId: requirement.id, label: requirement.label } },
        tx,
      );
      return requirement;
    });
    return toRequirementView(created);
  }

  async update(user: RequestUser, caseId: string, requirementId: string, dto: UpdateRequirementDto): Promise<CaseRequirementView> {
    const kase = await ensureCaseAccess(this.prisma, user, caseId, true);
    const existing = await this.prisma.caseRequirement.findFirst({ where: { id: requirementId, caseId } });
    if (!existing) throw new NotFoundException("Requirement not found");

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const completing = statusChanged && dto.status === "COMPLETE";

    const updated = await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.caseRequirement.update({
        where: { id: requirementId },
        data: {
          status: dto.status,
          label: dto.label,
          detail: dto.detail,
          mandatory: dto.mandatory,
          notes: dto.notes,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          completedAt: completing ? new Date() : dto.status !== undefined && dto.status !== "COMPLETE" ? null : undefined,
          completedByUserId: completing ? user.id : dto.status !== undefined && dto.status !== "COMPLETE" ? null : undefined,
        },
        include: requirementInclude,
      });
      await this.workflowEvents.record(
        {
          organizationId: kase.organizationId,
          caseId,
          type: statusChanged ? "REQUIREMENT_STATUS_CHANGED" : "REQUIREMENT_UPDATED",
          source: "MANUAL",
          actorUserId: user.id,
          metadata: { requirementId, label: requirement.label, ...(statusChanged ? { from: existing.status, to: dto.status } : {}) },
        },
        tx,
      );
      return requirement;
    });
    return toRequirementView(updated);
  }
}
