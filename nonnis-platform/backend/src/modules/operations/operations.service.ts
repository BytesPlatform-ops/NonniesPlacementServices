import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import {
  ACTIVE_STATUSES,
  NON_TERMINAL_STATUSES,
  attentionWhere,
  incompleteWhere,
  overdueWhere,
  startOfTodayUtc,
} from "../cases/case-query";
import { ProvidersService } from "../providers/providers.service";
import type { ProviderSummaryView } from "../providers/providers.serializer";
import type { ListProvidersQueryDto } from "../providers/dto/provider.dto";
import { ReadinessService, type OperationsReadinessSummary } from "../readiness/readiness.service";
import {
  criticalBlockerWhere,
  dischargedNotStartedWhere,
  nearTermNotReadyWhere,
  placementMissingWhere,
  serviceUnscheduledWhere,
} from "../readiness/readiness-query";
import {
  operationsCaseInclude,
  recentActivityInclude,
  toOperationsCaseSummary,
  toRecentActivityView,
  type AssigneeView,
  type OperationsCaseSummary,
  type RecentActivityView,
} from "./operations.serializer";
import type { ListOperationsCasesDto } from "./dto/operations.dto";

const SORTABLE = new Set(["expectedDischargeDate", "updatedAt", "createdAt", "status", "caseNumber"]);

export interface OperationsSummary {
  cases: {
    active: number;
    requiringAttention: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    unassigned: number;
    blocked: number;
    incomplete: number;
  };
  providers: {
    active: number;
    noCapacityReported: number;
    unavailable: number;
  };
  readiness: OperationsReadinessSummary;
  recentActivity: RecentActivityView[];
}

/**
 * Platform-wide operational read layer for Nonnis staff. Cross-organization by
 * design (guarded by cases.read_all at the controller). All mutations are made
 * through the existing case endpoints, which already honour cases.read_all — this
 * service adds no new mutation logic and never weakens tenant isolation elsewhere.
 */
@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProvidersService,
    private readonly readiness: ReadinessService,
  ) {}

  async summary(): Promise<OperationsSummary> {
    const now = new Date();
    const today = startOfTodayUtc(now);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const inSevenDays = new Date(today.getTime() + 7 * 86_400_000);
    const nonTerminal: Prisma.CaseWhereInput = { status: { in: NON_TERMINAL_STATUSES } };

    const [
      active,
      requiringAttention,
      overdue,
      dueToday,
      dueThisWeek,
      unassigned,
      blocked,
      incomplete,
      providersActive,
      providersNoCapacity,
      providersUnavailable,
      recent,
    ] = await this.prisma.$transaction([
      this.prisma.case.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      this.prisma.case.count({ where: { OR: attentionWhere(now) } }),
      this.prisma.case.count({ where: overdueWhere(now) }),
      this.prisma.case.count({ where: { AND: [nonTerminal, { expectedDischargeDate: { gte: today, lt: tomorrow } }] } }),
      this.prisma.case.count({ where: { AND: [nonTerminal, { expectedDischargeDate: { gte: today, lt: inSevenDays } }] } }),
      this.prisma.case.count({ where: { AND: [nonTerminal, { assignedDischargeProfessionalId: null }] } }),
      this.prisma.case.count({ where: { blocked: true, status: { in: ACTIVE_STATUSES } } }),
      this.prisma.case.count({ where: { AND: [nonTerminal, { OR: incompleteWhere() }] } }),
      this.prisma.provider.count({ where: { status: "ACTIVE" } }),
      this.prisma.provider.count({ where: { status: "ACTIVE", capacity: { none: {} } } }),
      this.prisma.provider.count({ where: { status: "ACTIVE", capacity: { some: { status: "UNAVAILABLE" } } } }),
      this.prisma.workflowEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: recentActivityInclude }),
    ]);

    const readiness = await this.readiness.operationsSummary();

    return {
      cases: { active, requiringAttention, overdue, dueToday, dueThisWeek, unassigned, blocked, incomplete },
      providers: { active: providersActive, noCapacityReported: providersNoCapacity, unavailable: providersUnavailable },
      readiness,
      recentActivity: recent.map(toRecentActivityView),
    };
  }

  async cases(query: ListOperationsCasesDto): Promise<PaginatedResult<OperationsCaseSummary>> {
    const now = new Date();
    const and: Prisma.CaseWhereInput[] = [];

    if (query.organizationId) and.push({ organizationId: query.organizationId });
    if (query.facilityId) and.push({ originatingFacilityId: query.facilityId });
    if (query.status) and.push({ status: query.status });
    if (query.assignedUserId) and.push({ assignedDischargeProfessionalId: query.assignedUserId });
    if (query.unassignedOnly) and.push({ status: { in: NON_TERMINAL_STATUSES }, assignedDischargeProfessionalId: null });
    if (query.search) {
      const s = query.search;
      and.push({
        OR: [
          { caseNumber: { contains: s, mode: "insensitive" } },
          { externalCaseId: { contains: s, mode: "insensitive" } },
          { patient: { firstName: { contains: s, mode: "insensitive" } } },
          { patient: { lastName: { contains: s, mode: "insensitive" } } },
          { organization: { name: { contains: s, mode: "insensitive" } } },
        ],
      });
    }
    if (query.expectedFrom) and.push({ expectedDischargeDate: { gte: new Date(query.expectedFrom) } });
    if (query.expectedTo) and.push({ expectedDischargeDate: { lte: new Date(query.expectedTo) } });
    if (query.overdue) and.push(overdueWhere(now));
    if (query.attentionOnly) and.push({ OR: attentionWhere(now) });
    if (query.blockedOnly) and.push({ blocked: true });
    if (query.incompleteOnly) and.push({ OR: incompleteWhere() });

    // Readiness filters (deterministic WHERE fragments; no per-row computation).
    if (query.readyOnly) and.push({ status: "READY_FOR_DISCHARGE" });
    if (query.notReadyOnly) and.push({ status: { in: NON_TERMINAL_STATUSES.filter((s) => s !== "READY_FOR_DISCHARGE") } });
    if (query.criticalBlockerOnly) and.push(criticalBlockerWhere());
    if (query.placementMissingOnly) and.push(placementMissingWhere());
    if (query.serviceUnscheduledOnly) and.push(serviceUnscheduledWhere());
    if (query.postDischargeNotStartedOnly) and.push(dischargedNotStartedWhere());
    if (query.nearTermNotReadyOnly) and.push(nearTermNotReadyWhere(now));

    const where: Prisma.CaseWhereInput = and.length > 0 ? { AND: and } : {};
    const sortField = query.sort && SORTABLE.has(query.sort) ? query.sort : "updatedAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: operationsCaseInclude,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items: rows.map((r) => toOperationsCaseSummary(r, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  /** Eligible discharge professionals for a case's organization (for reassignment). */
  async assignees(caseId: string): Promise<AssigneeView[]> {
    const found = await this.prisma.case.findUnique({ where: { id: caseId }, select: { organizationId: true } });
    if (!found) throw new NotFoundException(`Case ${caseId} not found`);
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: found.organizationId,
        status: "ACTIVE",
        role: { permissions: { some: { permission: { code: PERMISSIONS.CASES_READ } } } },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.user.id,
      name: m.user.displayName || `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email,
      email: m.user.email,
      roleName: m.role.name,
    }));
  }

  /** Provider operational overview — delegates to the existing (Nonnis-wide) provider list. */
  providersList(user: RequestUser, query: ListProvidersQueryDto): Promise<PaginatedResult<ProviderSummaryView>> {
    return this.providers.list(user, query);
  }
}
