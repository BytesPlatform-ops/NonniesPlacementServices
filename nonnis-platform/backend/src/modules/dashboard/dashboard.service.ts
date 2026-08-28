import { Injectable } from "@nestjs/common";
import { Prisma, type CaseStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { requireActiveOrganization } from "../auth/org-context";
import type { RequestUser } from "../auth/request-user";
import { caseSummaryInclude, toCaseSummary, type CaseSummary } from "../cases/cases.serializer";
import { ReadinessService } from "../readiness/readiness.service";

const NON_TERMINAL: CaseStatus[] = ["DRAFT", "READY_FOR_REVIEW", "MATCHING", "REFERRAL_SENT", "PROVIDER_REVIEWING", "ADDITIONAL_INFORMATION_REQUIRED", "ACCEPTED", "DECLINED", "SERVICES_BEING_COORDINATED", "READY_FOR_DISCHARGE", "SERVICE_STARTED", "FOLLOW_UP_REQUIRED"];
const LIST_LIMIT = 8;

function dayStartUtc(now: Date, addDays = 0): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + addDays));
}

export interface DischargeDashboard {
  metrics: {
    assignedToMe: number;
    openCases: number;
    overdue: number;
    dueSoon: number;
    needingAttention: number;
    missingInfo: number;
    blockedRequirements: number;
  };
  readiness: {
    readyForDischarge: number;
    criticalBlockers: number;
    nearTermNotReady: number;
    placementMissing: number;
    readinessRegression: number;
  };
  dischargesByBucket: Array<{ bucket: string; label: string; count: number }>;
  assignedToMe: CaseSummary[];
  requiringAttention: CaseSummary[];
  overdue: CaseSummary[];
  recentlyUpdated: CaseSummary[];
  recentActivity: Array<{ id: string; type: string; caseId: string; caseNumber: string; actor: string | null; createdAt: string }>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: ReadinessService,
  ) {}

  async dischargeProfessional(user: RequestUser): Promise<DischargeDashboard> {
    const organizationId = requireActiveOrganization(user);
    const now = new Date();
    const base: Prisma.CaseWhereInput = { organizationId };
    const nonTerminal: Prisma.CaseWhereInput = { organizationId, status: { in: NON_TERMINAL } };

    const overdueWhere: Prisma.CaseWhereInput = { ...nonTerminal, expectedDischargeDate: { lt: dayStartUtc(now) } };
    const attentionWhere: Prisma.CaseWhereInput = { ...base, OR: this.attentionOr(now) };
    const incompleteWhere: Prisma.CaseWhereInput = { ...base, OR: this.incompleteOr() };
    const blockedReqWhere: Prisma.CaseWhereInput = { ...base, requirements: { some: { status: "BLOCKED" } } };
    const dueSoonWhere: Prisma.CaseWhereInput = { ...nonTerminal, expectedDischargeDate: { gte: dayStartUtc(now), lt: dayStartUtc(now, 4) } };
    const assignedWhere: Prisma.CaseWhereInput = { ...base, assignedDischargeProfessionalId: user.id };

    const [assignedCount, openCount, overdueCount, dueSoonCount, attentionCount, missingCount, blockedReqCount] =
      await this.prisma.$transaction([
        this.prisma.case.count({ where: assignedWhere }),
        this.prisma.case.count({ where: nonTerminal }),
        this.prisma.case.count({ where: overdueWhere }),
        this.prisma.case.count({ where: dueSoonWhere }),
        this.prisma.case.count({ where: attentionWhere }),
        this.prisma.case.count({ where: incompleteWhere }),
        this.prisma.case.count({ where: blockedReqWhere }),
      ]);

    const dischargesByBucket = await this.bucketCounts(organizationId, now);
    const readiness = await this.readiness.dashboardSummary(organizationId);

    const [assignedToMe, requiringAttention, overdue, recentlyUpdated, activity] = await Promise.all([
      this.list(assignedWhere),
      this.list(attentionWhere),
      this.list(overdueWhere, { expectedDischargeDate: "asc" }),
      this.list(base),
      this.prisma.workflowEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { case: { select: { caseNumber: true } }, actorUser: { select: { firstName: true, lastName: true, displayName: true } } },
      }),
    ]);

    return {
      metrics: {
        assignedToMe: assignedCount,
        openCases: openCount,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
        needingAttention: attentionCount,
        missingInfo: missingCount,
        blockedRequirements: blockedReqCount,
      },
      readiness,
      dischargesByBucket,
      assignedToMe,
      requiringAttention,
      overdue,
      recentlyUpdated,
      recentActivity: activity.map((e) => ({
        id: e.id,
        type: e.type,
        caseId: e.caseId,
        caseNumber: e.case.caseNumber,
        actor: e.actorUser
          ? e.actorUser.displayName ?? (`${e.actorUser.firstName ?? ""} ${e.actorUser.lastName ?? ""}`.trim() || null)
          : null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async list(where: Prisma.CaseWhereInput, orderBy: Prisma.CaseOrderByWithRelationInput = { updatedAt: "desc" }): Promise<CaseSummary[]> {
    const rows = await this.prisma.case.findMany({ where, include: caseSummaryInclude, orderBy, take: LIST_LIMIT });
    const now = new Date();
    return rows.map((r) => toCaseSummary(r, now));
  }

  private async bucketCounts(organizationId: string, now: Date): Promise<Array<{ bucket: string; label: string; count: number }>> {
    const nt: Prisma.CaseWhereInput = { organizationId, status: { in: NON_TERMINAL } };
    const ranges: Array<{ bucket: string; label: string; where: Prisma.CaseWhereInput }> = [
      { bucket: "OVERDUE", label: "Overdue", where: { ...nt, expectedDischargeDate: { lt: dayStartUtc(now) } } },
      { bucket: "TODAY", label: "Today", where: { ...nt, expectedDischargeDate: { gte: dayStartUtc(now), lt: dayStartUtc(now, 1) } } },
      { bucket: "NEXT_24H", label: "Next 24 hours", where: { ...nt, expectedDischargeDate: { gte: dayStartUtc(now, 1), lt: dayStartUtc(now, 2) } } },
      { bucket: "NEXT_3_DAYS", label: "Next 3 days", where: { ...nt, expectedDischargeDate: { gte: dayStartUtc(now, 2), lt: dayStartUtc(now, 4) } } },
      { bucket: "NEXT_7_DAYS", label: "Next 7 days", where: { ...nt, expectedDischargeDate: { gte: dayStartUtc(now, 4), lt: dayStartUtc(now, 8) } } },
      { bucket: "LATER", label: "Later", where: { ...nt, expectedDischargeDate: { gte: dayStartUtc(now, 8) } } },
      { bucket: "NO_DATE", label: "No date", where: { ...nt, expectedDischargeDate: null } },
    ];
    const counts = await this.prisma.$transaction(ranges.map((r) => this.prisma.case.count({ where: r.where })));
    return ranges.map((r, i) => ({ bucket: r.bucket, label: r.label, count: counts[i]! }));
  }

  private attentionOr(now: Date): Prisma.CaseWhereInput[] {
    const notTerminal: Prisma.CaseWhereInput = { status: { in: NON_TERMINAL } };
    return [
      { blocked: true },
      { AND: [notTerminal, { expectedDischargeDate: { lt: dayStartUtc(now) } }] },
      { AND: [notTerminal, { assignedDischargeProfessionalId: null }] },
      { AND: [notTerminal, { preferredServiceLocation: null }] },
      { requirements: { some: { status: "BLOCKED" } } },
      { AND: [notTerminal, { requirements: { some: { mandatory: true, status: { notIn: ["COMPLETE", "NOT_REQUIRED"] } } } }] },
    ];
  }

  private incompleteOr(): Prisma.CaseWhereInput[] {
    return [
      { expectedDischargeDate: null },
      { currentCareSetting: null },
      { preferredServiceLocation: null },
      { assignedDischargeProfessionalId: null },
      { serviceRequests: { none: {} } },
      { requirements: { some: { mandatory: true, status: { notIn: ["COMPLETE", "NOT_REQUIRED"] } } } },
      { blocked: true },
    ];
  }
}
