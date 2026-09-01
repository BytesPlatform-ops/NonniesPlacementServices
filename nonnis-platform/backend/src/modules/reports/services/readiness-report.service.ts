import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import {
  criticalBlockerWhere,
  dischargedNotStartedWhere,
  nearTermNotReadyWhere,
  placementMissingWhere,
  serviceUnscheduledWhere,
} from "../../readiness/readiness-query";
import { readinessCaseInclude, toReadinessView } from "../../readiness/readiness.serializer";
import { ReadinessReportDto } from "../dto/report-filters.dto";
import { blockerTypeWhere, readinessLevelWhere } from "../report-readiness";
import {
  buildDateRange,
  humanizeEnum,
  iso,
  ReportResponse,
  skipTake,
  sortField,
  sortOrder,
  totalPages,
} from "../report-shared";
import { MAX_EXPORT_ROWS, toCsv } from "../csv";

export interface ReadinessReportRow {
  id: string;
  caseNumber: string;
  patientName: string | null;
  organization: string | null;
  facility: string | null;
  expectedDischargeDate: string | null;
  status: string;
  statusLabel: string;
  readinessPercentage: number;
  readinessLevel: string;
  criticalBlockers: number;
  keyBlockers: string[];
}

export interface ReadinessReportSummary {
  ready: number;
  needsAttention: number;
  blocked: number;
  nearTermNotReady: number;
  placementMissing: number;
  acceptedUnscheduled: number;
  dischargedServiceNotStarted: number;
  unsuccessfulServiceStarts: number;
}

const SORT_FIELDS = ["expectedDischargeDate", "createdAt", "caseNumber", "status"];

const UNSUCCESSFUL_START_WHERE: Prisma.CaseWhereInput = {
  serviceRequests: {
    some: { status: { not: "CANCELLED" }, referrals: { some: { status: "ACCEPTED", placement: { status: "UNSUCCESSFUL" } } } },
  },
};

@Injectable()
export class ReadinessReportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters: ReadinessReportDto, now: Date): Prisma.CaseWhereInput {
    const and: Prisma.CaseWhereInput[] = [];
    if (filters.organizationId) and.push({ organizationId: filters.organizationId });
    if (filters.facilityId) and.push({ originatingFacilityId: filters.facilityId });
    if (filters.status) and.push({ status: filters.status });
    if (filters.readinessLevel) and.push(readinessLevelWhere(filters.readinessLevel));
    if (filters.blockerType) and.push(blockerTypeWhere(filters.blockerType, now));
    const createdRange = buildDateRange(filters.dateFrom, filters.dateTo);
    if (createdRange) and.push({ createdAt: createdRange });
    const expectedRange = buildDateRange(filters.expectedFrom, filters.expectedTo);
    if (expectedRange) and.push({ expectedDischargeDate: expectedRange });
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { caseNumber: { contains: search, mode: "insensitive" } },
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: ReadinessReportDto): Record<string, unknown> {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      organizationId: filters.organizationId ?? null,
      facilityId: filters.facilityId ?? null,
      status: filters.status ?? null,
      readinessLevel: filters.readinessLevel ?? null,
      blockerType: filters.blockerType ?? null,
      expectedFrom: filters.expectedFrom ?? null,
      expectedTo: filters.expectedTo ?? null,
      search: filters.search ?? null,
    };
  }

  private and(where: Prisma.CaseWhereInput, extra: Prisma.CaseWhereInput): Prisma.CaseWhereInput {
    return { AND: [where, extra] };
  }

  private async summary(where: Prisma.CaseWhereInput, now: Date): Promise<ReadinessReportSummary> {
    const [
      ready,
      needsAttention,
      blocked,
      nearTermNotReady,
      placementMissing,
      acceptedUnscheduled,
      dischargedServiceNotStarted,
      unsuccessfulServiceStarts,
    ] = await this.prisma.$transaction([
      this.prisma.case.count({ where: this.and(where, readinessLevelWhere("READY")) }),
      this.prisma.case.count({ where: this.and(where, readinessLevelWhere("NEEDS_ATTENTION")) }),
      this.prisma.case.count({ where: this.and(where, criticalBlockerWhere()) }),
      this.prisma.case.count({ where: this.and(where, nearTermNotReadyWhere(now)) }),
      this.prisma.case.count({ where: this.and(where, placementMissingWhere()) }),
      this.prisma.case.count({ where: this.and(where, serviceUnscheduledWhere()) }),
      this.prisma.case.count({ where: this.and(where, dischargedNotStartedWhere()) }),
      this.prisma.case.count({ where: this.and(where, UNSUCCESSFUL_START_WHERE) }),
    ]);
    return {
      ready,
      needsAttention,
      blocked,
      nearTermNotReady,
      placementMissing,
      acceptedUnscheduled,
      dischargedServiceNotStarted,
      unsuccessfulServiceStarts,
    };
  }

  private async fetchRows(
    where: Prisma.CaseWhereInput,
    filters: ReadinessReportDto,
    skip: number,
    take: number,
    now: Date,
  ): Promise<ReadinessReportRow[]> {
    const rows = await this.prisma.case.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "expectedDischargeDate")]: sortOrder(filters.order ?? "asc") },
      skip,
      take,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        organization: { select: { name: true } },
        originatingFacility: { select: { name: true } },
        ...readinessCaseInclude,
      },
    });
    return rows.map((row) => {
      const readiness = toReadinessView(row, now);
      const critical = readiness.blockers.filter((b) => b.severity === "CRITICAL");
      return {
        id: row.id,
        caseNumber: row.caseNumber,
        patientName: [row.patient.firstName, row.patient.lastName].filter(Boolean).join(" ") || null,
        organization: row.organization.name,
        facility: row.originatingFacility.name,
        expectedDischargeDate: iso(row.expectedDischargeDate),
        status: row.status,
        statusLabel: humanizeEnum(row.status),
        readinessPercentage: readiness.percentage,
        readinessLevel: readiness.level,
        criticalBlockers: critical.length,
        keyBlockers: critical.slice(0, 4).map((b) => b.label),
      };
    });
  }

  async report(
    filters: ReadinessReportDto,
  ): Promise<ReportResponse<ReadinessReportRow, ReadinessReportSummary, Record<string, never>>> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const { skip, take } = skipTake(filters);
    const [summary, total, items] = await Promise.all([
      this.summary(where, now),
      this.prisma.case.count({ where }),
      this.fetchRows(where, filters, skip, take, now),
    ]);
    return {
      appliedFilters: this.appliedFilters(filters),
      generatedAt: now.toISOString(),
      summary,
      groups: {},
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: totalPages(total, filters.pageSize),
    };
  }

  async export(filters: ReadinessReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const total = await this.prisma.case.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS, now);
    const headers = [
      "Case Number",
      "Patient",
      "Organization",
      "Facility",
      "Expected Discharge",
      "Case Status",
      "Readiness %",
      "Readiness Level",
      "Critical Blockers",
      "Key Blockers",
    ];
    const csvRows = rows.map((r) => [
      r.caseNumber,
      r.patientName,
      r.organization,
      r.facility,
      r.expectedDischargeDate,
      r.statusLabel,
      r.readinessPercentage,
      humanizeEnum(r.readinessLevel),
      r.criticalBlockers,
      r.keyBlockers.join("; "),
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
