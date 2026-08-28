import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, type CaseStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { RequestUser } from "../auth/request-user";
import { ensureCaseAccess } from "../cases/case-access";
import { computeReadiness, completionEligibility, READY_FROM_STATUSES } from "./readiness-domain";
import { readinessCaseInclude, toReadinessInput, toReadinessView, type ReadinessCaseRow, type ReadinessView } from "./readiness.serializer";
import {
  criticalBlockerWhere,
  dischargedNotStartedWhere,
  nearTermNotReadyWhere,
  placementMissingWhere,
  readinessRegressionWhere,
} from "./readiness-query";

export interface OperationsReadinessSummary {
  readyForDischarge: number;
  nearTermNotReady: number;
  criticalBlockers: number;
  placementMissing: number;
  acceptedUnscheduled: number;
  dischargedServiceNotStarted: number;
  unsuccessfulServiceStarts: number;
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
    private readonly audit: AuditService,
  ) {}

  // ---- read ----

  async getReadiness(user: RequestUser, caseId: string): Promise<ReadinessView> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    const row = await this.loadRow(caseId);
    return toReadinessView(row);
  }

  private async loadRow(caseId: string): Promise<ReadinessCaseRow> {
    const row = await this.prisma.case.findUnique({ where: { id: caseId }, include: readinessCaseInclude });
    if (!row) throw new NotFoundException(`Case ${caseId} not found`);
    return row;
  }

  // ---- explicit lifecycle actions (all manual; readiness never self-transitions) ----

  async markReadyForDischarge(user: RequestUser, caseId: string): Promise<ReadinessView> {
    const access = await ensureCaseAccess(this.prisma, user, caseId, true);
    const row = await this.loadRow(caseId);
    const readiness = computeReadiness(toReadinessInput(row));

    if (!readiness.ready) {
      throw new UnprocessableEntityException({
        message: "The case is not ready for discharge.",
        details: { code: "READINESS_NOT_MET", blockers: readiness.blockers.filter((b) => b.severity === "CRITICAL") },
      });
    }
    if (!READY_FROM_STATUSES.includes(row.status)) {
      throw new ConflictException(`A ${row.status} case cannot be marked ready for discharge.`);
    }

    await this.transition(caseId, access.organizationId, row.status, "READY_FOR_DISCHARGE", user.id, {
      action: "case.marked_ready_for_discharge",
      audit: true,
    });
    return toReadinessView(await this.loadRow(caseId));
  }

  async markDischarged(user: RequestUser, caseId: string, actualDischargeDate: string, note?: string): Promise<ReadinessView> {
    const access = await ensureCaseAccess(this.prisma, user, caseId, true);
    const row = await this.loadRow(caseId);

    if (row.status !== "READY_FOR_DISCHARGE") {
      throw new ConflictException("Only a case that is ready for discharge can be marked discharged.");
    }
    const actual = new Date(actualDischargeDate);
    if (Number.isNaN(actual.getTime())) throw new BadRequestException("A valid actual discharge date is required.");
    if (actual.getTime() < row.createdAt.getTime()) {
      throw new BadRequestException("Actual discharge date cannot precede case creation.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id: caseId }, data: { status: "DISCHARGED", actualDischargeDate: actual } });
      await this.workflowEvents.record(
        { organizationId: access.organizationId, caseId, type: "STATUS_CHANGED", previousStatus: row.status, newStatus: "DISCHARGED", source: "MANUAL", actorUserId: user.id, metadata: { actualDischargeDate, ...(note ? { note } : {}) } },
        tx,
      );
      await this.audit.record(
        { action: "case.discharged", entityType: "Case", entityId: caseId, organizationId: access.organizationId, actorUserId: user.id, metadata: { actualDischargeDate } },
        tx,
      );
    });
    return toReadinessView(await this.loadRow(caseId));
  }

  async markServiceStarted(user: RequestUser, caseId: string, note?: string): Promise<ReadinessView> {
    const access = await ensureCaseAccess(this.prisma, user, caseId, true);
    const row = await this.loadRow(caseId);

    if (row.status !== "DISCHARGED") {
      throw new ConflictException("Only a discharged case can advance to service started.");
    }
    const readiness = computeReadiness(toReadinessInput(row));
    if (!readiness.serviceStart.allStarted) {
      throw new UnprocessableEntityException({
        message: "Not all required services have started.",
        details: {
          code: "SERVICE_START_INCOMPLETE",
          serviceStart: readiness.serviceStart,
          blockers: readiness.blockers.filter((b) => b.code === "SERVICE_START_UNSUCCESSFUL"),
        },
      });
    }

    await this.transition(caseId, access.organizationId, row.status, "SERVICE_STARTED", user.id, {
      action: "case.service_started",
      audit: true,
      note,
    });
    return toReadinessView(await this.loadRow(caseId));
  }

  async markCompleted(user: RequestUser, caseId: string, note?: string): Promise<ReadinessView> {
    const access = await ensureCaseAccess(this.prisma, user, caseId, true);
    const row = await this.loadRow(caseId);
    const eligibility = completionEligibility(toReadinessInput(row));

    if (!eligibility.eligible) {
      throw new UnprocessableEntityException({
        message: "The case cannot be completed yet.",
        details: { code: "COMPLETION_NOT_MET", reasons: eligibility.reasons },
      });
    }

    await this.transition(caseId, access.organizationId, row.status, "COMPLETED", user.id, {
      action: "case.completed",
      audit: true,
      note,
    });
    return toReadinessView(await this.loadRow(caseId));
  }

  private async transition(
    caseId: string,
    organizationId: string,
    from: CaseStatus,
    to: CaseStatus,
    actorUserId: string,
    opts: { action: string; audit?: boolean; note?: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id: caseId }, data: { status: to } });
      await this.workflowEvents.record(
        { organizationId, caseId, type: "STATUS_CHANGED", previousStatus: from, newStatus: to, source: "MANUAL", actorUserId, metadata: opts.note ? { note: opts.note } : undefined },
        tx,
      );
      if (opts.audit) {
        await this.audit.record(
          { action: opts.action, entityType: "Case", entityId: caseId, organizationId, actorUserId, metadata: { from, to } },
          tx,
        );
      }
    });
  }

  // ---- operations counts (cross-org; efficient count-only queries) ----

  async operationsSummary(): Promise<OperationsReadinessSummary> {
    const now = new Date();
    const [readyForDischarge, nearTermNotReady, criticalBlockers, placementMissing, acceptedUnscheduled, dischargedServiceNotStarted, unsuccessfulServiceStarts] =
      await this.prisma.$transaction([
        this.prisma.case.count({ where: { status: "READY_FOR_DISCHARGE" } }),
        this.prisma.case.count({ where: nearTermNotReadyWhere(now) }),
        this.prisma.case.count({ where: criticalBlockerWhere() }),
        this.prisma.case.count({ where: placementMissingWhere() }),
        this.prisma.placement.count({ where: { status: { in: ["ACCEPTED", "COORDINATING"] }, referral: { status: "ACCEPTED" } } }),
        this.prisma.case.count({ where: dischargedNotStartedWhere() }),
        this.prisma.placement.count({ where: { status: "UNSUCCESSFUL" } }),
      ]);
    return { readyForDischarge, nearTermNotReady, criticalBlockers, placementMissing, acceptedUnscheduled, dischargedServiceNotStarted, unsuccessfulServiceStarts };
  }

  // ---- discharge dashboard counts (org-scoped) ----

  async dashboardSummary(organizationId: string): Promise<{ readyForDischarge: number; criticalBlockers: number; nearTermNotReady: number; placementMissing: number; readinessRegression: number }> {
    const now = new Date();
    const org: Prisma.CaseWhereInput = { organizationId };
    const [readyForDischarge, criticalBlockers, nearTermNotReady, placementMissing, readinessRegression] = await this.prisma.$transaction([
      this.prisma.case.count({ where: { ...org, status: "READY_FOR_DISCHARGE" } }),
      this.prisma.case.count({ where: { AND: [org, criticalBlockerWhere()] } }),
      this.prisma.case.count({ where: { AND: [org, nearTermNotReadyWhere(now)] } }),
      this.prisma.case.count({ where: { AND: [org, placementMissingWhere()] } }),
      this.prisma.case.count({ where: { AND: [org, readinessRegressionWhere()] } }),
    ]);
    return { readyForDischarge, criticalBlockers, nearTermNotReady, placementMissing, readinessRegression };
  }
}
