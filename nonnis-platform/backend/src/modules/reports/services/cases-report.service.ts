import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { ACTIVE_STATUSES } from "../../cases/case-query";
import { criticalBlockerWhere } from "../../readiness/readiness-query";
import { readinessCaseInclude, toReadinessView } from "../../readiness/readiness.serializer";
import { ReportLookupService } from "../report-lookups.service";
import { readinessLevelWhere } from "../report-readiness";
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
import { CasesReportDto } from "../dto/report-filters.dto";
import { MAX_EXPORT_ROWS, toCsv } from "../csv";

export interface CaseReportRow {
  id: string;
  caseNumber: string;
  patientName: string | null;
  organization: string | null;
  facility: string | null;
  assignedProfessional: string | null;
  status: string;
  statusLabel: string;
  readinessLevel: string;
  readinessPercentage: number;
  criticalBlockers: number;
  keyBlockers: string[];
  createdAt: string;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
}

export interface CaseReportSummary {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  ready: number;
  blocked: number;
}

export interface CaseReportGroups {
  byStatus: GroupCount[];
  byOrganization: GroupCount[];
  byFacility: GroupCount[];
}

const SORT_FIELDS = ["createdAt", "updatedAt", "expectedDischargeDate", "caseNumber", "status"];

@Injectable()
export class CasesReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookups: ReportLookupService,
  ) {}

  private buildWhere(filters: CasesReportDto): Prisma.CaseWhereInput {
    const and: Prisma.CaseWhereInput[] = [];
    if (filters.organizationId) and.push({ organizationId: filters.organizationId });
    if (filters.facilityId) and.push({ originatingFacilityId: filters.facilityId });
    if (filters.status) and.push({ status: filters.status });
    if (filters.assignedUserId) and.push({ assignedDischargeProfessionalId: filters.assignedUserId });
    const range = buildDateRange(filters.dateFrom, filters.dateTo);
    if (range) and.push({ createdAt: range });
    if (filters.readinessLevel) and.push(readinessLevelWhere(filters.readinessLevel));
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { caseNumber: { contains: search, mode: "insensitive" } },
          { externalCaseId: { contains: search, mode: "insensitive" } },
          { patient: { firstName: { contains: search, mode: "insensitive" } } },
          { patient: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: CasesReportDto): Record<string, unknown> {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      organizationId: filters.organizationId ?? null,
      facilityId: filters.facilityId ?? null,
      status: filters.status ?? null,
      readinessLevel: filters.readinessLevel ?? null,
      assignedUserId: filters.assignedUserId ?? null,
      search: filters.search ?? null,
    };
  }

  private async summary(where: Prisma.CaseWhereInput): Promise<CaseReportSummary> {
    const [total, active, completed, cancelled, ready, blocked] = await this.prisma.$transaction([
      this.prisma.case.count({ where }),
      this.prisma.case.count({ where: { AND: [where, { status: { in: ACTIVE_STATUSES } }] } }),
      this.prisma.case.count({ where: { AND: [where, { status: "COMPLETED" }] } }),
      this.prisma.case.count({ where: { AND: [where, { status: "CANCELLED" }] } }),
      this.prisma.case.count({ where: { AND: [where, { status: "READY_FOR_DISCHARGE" }] } }),
      this.prisma.case.count({ where: { AND: [where, criticalBlockerWhere()] } }),
    ]);
    return { total, active, completed, cancelled, ready, blocked };
  }

  private async groups(where: Prisma.CaseWhereInput): Promise<CaseReportGroups> {
    const byStatusP = this.prisma.case.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } });
    const byOrgP = this.prisma.case.groupBy({ by: ["organizationId"], where, _count: { _all: true }, orderBy: { organizationId: "asc" } });
    const byFacilityP = this.prisma.case.groupBy({ by: ["originatingFacilityId"], where, _count: { _all: true }, orderBy: { originatingFacilityId: "asc" } });
    const [byStatusRaw, byOrgRaw, byFacilityRaw] = await Promise.all([byStatusP, byOrgP, byFacilityP]);
    const orgNames = await this.lookups.organizationNames(byOrgRaw.map((g) => g.organizationId));
    const facilityNames = await this.lookups.facilityNames(byFacilityRaw.map((g) => g.originatingFacilityId));
    return {
      byStatus: byStatusRaw
        .map((g) => ({ key: g.status, label: humanizeEnum(g.status), count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      byOrganization: byOrgRaw
        .map((g) => ({ key: g.organizationId, label: orgNames.get(g.organizationId) ?? "Unknown", count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      byFacility: byFacilityRaw
        .map((g) => ({ key: g.originatingFacilityId, label: facilityNames.get(g.originatingFacilityId) ?? "Unknown", count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async fetchRows(
    where: Prisma.CaseWhereInput,
    filters: CasesReportDto,
    skip: number,
    take: number,
    now: Date,
  ): Promise<CaseReportRow[]> {
    const rows = await this.prisma.case.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "createdAt")]: sortOrder(filters.order) },
      skip,
      take,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        organization: { select: { name: true } },
        originatingFacility: { select: { name: true } },
        assignedDischargeProfessional: { select: { displayName: true, firstName: true, lastName: true } },
        ...readinessCaseInclude,
      },
    });

    return rows.map((row) => {
      const readiness = toReadinessView(row, now);
      const critical = readiness.blockers.filter((b) => b.severity === "CRITICAL");
      const pro = row.assignedDischargeProfessional;
      return {
        id: row.id,
        caseNumber: row.caseNumber,
        patientName: [row.patient.firstName, row.patient.lastName].filter(Boolean).join(" ") || null,
        organization: row.organization.name,
        facility: row.originatingFacility.name,
        assignedProfessional: pro
          ? pro.displayName ?? ([pro.firstName, pro.lastName].filter(Boolean).join(" ") || null)
          : null,
        status: row.status,
        statusLabel: humanizeEnum(row.status),
        readinessLevel: readiness.level,
        readinessPercentage: readiness.percentage,
        criticalBlockers: critical.length,
        keyBlockers: critical.slice(0, 3).map((b) => b.label),
        createdAt: row.createdAt.toISOString(),
        expectedDischargeDate: iso(row.expectedDischargeDate),
        actualDischargeDate: iso(row.actualDischargeDate),
      };
    });
  }

  async report(
    filters: CasesReportDto,
  ): Promise<ReportResponse<CaseReportRow, CaseReportSummary, CaseReportGroups>> {
    const now = new Date();
    const where = this.buildWhere(filters);
    const { skip, take } = skipTake(filters);
    const [summary, groups, total, items] = await Promise.all([
      this.summary(where),
      this.groups(where),
      this.prisma.case.count({ where }),
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

  async export(filters: CasesReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const now = new Date();
    const where = this.buildWhere(filters);
    const total = await this.prisma.case.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS, now);
    const headers = [
      "Case Number",
      "Patient",
      "Organization",
      "Facility",
      "Assigned Professional",
      "Status",
      "Readiness Level",
      "Readiness %",
      "Critical Blockers",
      "Key Blockers",
      "Created",
      "Expected Discharge",
      "Actual Discharge",
    ];
    const csvRows = rows.map((r) => [
      r.caseNumber,
      r.patientName,
      r.organization,
      r.facility,
      r.assignedProfessional,
      r.statusLabel,
      humanizeEnum(r.readinessLevel),
      r.readinessPercentage,
      r.criticalBlockers,
      r.keyBlockers.join("; "),
      r.createdAt,
      r.expectedDischargeDate,
      r.actualDischargeDate,
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
