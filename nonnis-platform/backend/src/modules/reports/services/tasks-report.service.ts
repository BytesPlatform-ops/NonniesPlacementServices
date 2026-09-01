import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { TasksReportDto } from "../dto/report-filters.dto";
import { ReportLookupService } from "../report-lookups.service";
import {
  buildDateRange,
  GroupCount,
  humanizeEnum,
  iso,
  ReportResponse,
  skipTake,
  sortField,
  sortOrder,
  totalPages,
} from "../report-shared";
import { MAX_EXPORT_ROWS, toCsv } from "../csv";

export interface TaskReportRow {
  id: string;
  title: string;
  caseId: string;
  caseNumber: string;
  organization: string | null;
  assignee: string | null;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  overdue: boolean;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
}

export interface TaskReportSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  highUrgentActive: number;
}

export interface TaskReportGroups {
  byStatus: GroupCount[];
  byPriority: GroupCount[];
}

const SORT_FIELDS = ["createdAt", "dueAt", "priority", "status", "completedAt"];
const ACTIVE: Prisma.TaskWhereInput = { status: { in: ["OPEN", "IN_PROGRESS"] } };

function overdueWhere(now: Date): Prisma.TaskWhereInput {
  return { dueAt: { lt: now }, status: { in: ["OPEN", "IN_PROGRESS"] } };
}

@Injectable()
export class TasksReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookups: ReportLookupService,
  ) {}

  private buildWhere(filters: TasksReportDto, now: Date): Prisma.TaskWhereInput {
    const and: Prisma.TaskWhereInput[] = [];
    if (filters.organizationId) and.push({ organizationId: filters.organizationId });
    if (filters.facilityId) and.push({ case: { originatingFacilityId: filters.facilityId } });
    if (filters.caseId) and.push({ caseId: filters.caseId });
    if (filters.assigneeUserId) and.push({ assigneeUserId: filters.assigneeUserId });
    if (filters.priority) and.push({ priority: filters.priority });
    if (filters.status) and.push({ status: filters.status });
    if (filters.overdue) and.push(overdueWhere(now));
    const range = buildDateRange(filters.dateFrom, filters.dateTo);
    if (range) and.push({ createdAt: range });
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { case: { caseNumber: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: TasksReportDto): Record<string, unknown> {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      organizationId: filters.organizationId ?? null,
      facilityId: filters.facilityId ?? null,
      caseId: filters.caseId ?? null,
      assigneeUserId: filters.assigneeUserId ?? null,
      priority: filters.priority ?? null,
      status: filters.status ?? null,
      overdue: filters.overdue ?? false,
      search: filters.search ?? null,
    };
  }

  private async summarize(
    where: Prisma.TaskWhereInput,
    now: Date,
  ): Promise<{ summary: TaskReportSummary; groups: TaskReportGroups }> {
    const byStatusP = this.prisma.task.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } });
    const byPriorityP = this.prisma.task.groupBy({ by: ["priority"], where, _count: { _all: true }, orderBy: { priority: "asc" } });
    const overdueP = this.prisma.task.count({ where: { AND: [where, overdueWhere(now)] } });
    const highUrgentP = this.prisma.task.count({ where: { AND: [where, ACTIVE, { priority: { in: ["HIGH", "URGENT"] } }] } });
    const [byStatusRaw, byPriorityRaw, overdue, highUrgentActive] = await Promise.all([byStatusP, byPriorityP, overdueP, highUrgentP]);
    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const g of byStatusRaw) {
      statusMap[g.status] = g._count._all;
      total += g._count._all;
    }
    return {
      summary: {
        total,
        open: statusMap.OPEN ?? 0,
        inProgress: statusMap.IN_PROGRESS ?? 0,
        completed: statusMap.COMPLETED ?? 0,
        cancelled: statusMap.CANCELLED ?? 0,
        overdue,
        highUrgentActive,
      },
      groups: {
        byStatus: byStatusRaw
          .map((g) => ({ key: g.status, label: humanizeEnum(g.status), count: g._count._all }))
          .sort((a, b) => b.count - a.count),
        byPriority: byPriorityRaw
          .map((g) => ({ key: g.priority, label: humanizeEnum(g.priority), count: g._count._all }))
          .sort((a, b) => b.count - a.count),
      },
    };
  }

  private async fetchRows(
    where: Prisma.TaskWhereInput,
    filters: TasksReportDto,
    skip: number,
    take: number,
    now: Date,
  ): Promise<TaskReportRow[]> {
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "createdAt")]: sortOrder(filters.order) },
      skip,
      take,
      include: {
        case: { select: { caseNumber: true, organization: { select: { name: true } } } },
      },
    });
    const names = await this.lookups.userNames(rows.map((t) => t.assigneeUserId));
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      caseId: t.caseId,
      caseNumber: t.case.caseNumber,
      organization: t.case.organization.name,
      assignee: t.assigneeUserId ? names.get(t.assigneeUserId) ?? null : null,
      priority: t.priority,
      priorityLabel: humanizeEnum(t.priority),
      status: t.status,
      statusLabel: humanizeEnum(t.status),
      overdue: !!t.dueAt && t.dueAt < now && (t.status === "OPEN" || t.status === "IN_PROGRESS"),
      createdAt: t.createdAt.toISOString(),
      dueAt: iso(t.dueAt),
      completedAt: iso(t.completedAt),
    }));
  }

  async report(
    filters: TasksReportDto,
  ): Promise<ReportResponse<TaskReportRow, TaskReportSummary, TaskReportGroups>> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const { skip, take } = skipTake(filters);
    const [{ summary, groups }, total, items] = await Promise.all([
      this.summarize(where, now),
      this.prisma.task.count({ where }),
      this.fetchRows(where, filters, skip, take, now),
    ]);
    return {
      appliedFilters: this.appliedFilters(filters),
      generatedAt: now.toISOString(),
      summary,
      groups,
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: totalPages(total, filters.pageSize),
    };
  }

  async export(filters: TasksReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const total = await this.prisma.task.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS, now);
    const headers = [
      "Task",
      "Case",
      "Organization",
      "Assignee",
      "Priority",
      "Status",
      "Overdue",
      "Created",
      "Due",
      "Completed",
    ];
    const csvRows = rows.map((r) => [
      r.title,
      r.caseNumber,
      r.organization,
      r.assignee,
      r.priorityLabel,
      r.statusLabel,
      r.overdue,
      r.createdAt,
      r.dueAt,
      r.completedAt,
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
