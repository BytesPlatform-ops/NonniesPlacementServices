import { Injectable } from "@nestjs/common";
import { Prisma, type CapacityStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { ProvidersReportDto } from "../dto/report-filters.dto";
import {
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

export interface ProviderReportRow {
  id: string;
  displayName: string;
  organization: string | null;
  status: string;
  statusLabel: string;
  location: string | null;
  servicesCount: number;
  coverageCount: number;
  languagesCount: number;
  paymentTypesCount: number;
  capacity: string;
  lastCapacityUpdate: string | null;
  updatedAt: string;
}

export interface ProviderReportSummary {
  total: number;
  active: number;
  paused: number;
  inactive: number;
  available: number;
  limited: number;
  unavailable: number;
  unknownCapacity: number;
}

export interface ProviderReportGroups {
  byStatus: GroupCount[];
  byCapacity: GroupCount[];
}

const SORT_FIELDS = ["displayName", "status", "state", "city", "updatedAt"];

/** A provider's headline capacity = the status of its general (category-less) capacity row. */
function capacityWhere(status: "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "UNKNOWN"): Prisma.ProviderWhereInput {
  if (status === "UNKNOWN") {
    return { capacity: { none: { serviceCategoryId: null, status: { in: ["AVAILABLE", "LIMITED", "UNAVAILABLE"] } } } };
  }
  return { capacity: { some: { serviceCategoryId: null, status } } };
}

@Injectable()
export class ProvidersReportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters: ProvidersReportDto): Prisma.ProviderWhereInput {
    const and: Prisma.ProviderWhereInput[] = [];
    if (filters.organizationId) and.push({ organizationId: filters.organizationId });
    if (filters.status) and.push({ status: filters.status });
    if (filters.serviceCategoryId) and.push({ services: { some: { serviceCategoryId: filters.serviceCategoryId, active: true } } });
    if (filters.state) and.push({ state: { contains: filters.state, mode: "insensitive" } });
    if (filters.city) and.push({ city: { contains: filters.city, mode: "insensitive" } });
    if (filters.languageId) and.push({ languages: { some: { languageId: filters.languageId, active: true } } });
    if (filters.paymentTypeId) and.push({ paymentTypes: { some: { paymentTypeId: filters.paymentTypeId, active: true } } });
    if (filters.capacityStatus) and.push(capacityWhere(filters.capacityStatus));
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { displayName: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: ProvidersReportDto): Record<string, unknown> {
    return {
      organizationId: filters.organizationId ?? null,
      status: filters.status ?? null,
      serviceCategoryId: filters.serviceCategoryId ?? null,
      state: filters.state ?? null,
      city: filters.city ?? null,
      capacityStatus: filters.capacityStatus ?? null,
      languageId: filters.languageId ?? null,
      paymentTypeId: filters.paymentTypeId ?? null,
      search: filters.search ?? null,
    };
  }

  private async summarize(
    where: Prisma.ProviderWhereInput,
  ): Promise<{ summary: ProviderReportSummary; groups: ProviderReportGroups }> {
    const [total, active, paused, inactive, available, limited, unavailable, unknownCapacity] =
      await this.prisma.$transaction([
        this.prisma.provider.count({ where }),
        this.prisma.provider.count({ where: { AND: [where, { status: "ACTIVE" }] } }),
        this.prisma.provider.count({ where: { AND: [where, { status: "PAUSED" }] } }),
        this.prisma.provider.count({ where: { AND: [where, { status: "INACTIVE" }] } }),
        this.prisma.provider.count({ where: { AND: [where, capacityWhere("AVAILABLE")] } }),
        this.prisma.provider.count({ where: { AND: [where, capacityWhere("LIMITED")] } }),
        this.prisma.provider.count({ where: { AND: [where, capacityWhere("UNAVAILABLE")] } }),
        this.prisma.provider.count({ where: { AND: [where, capacityWhere("UNKNOWN")] } }),
      ]);
    return {
      summary: { total, active, paused, inactive, available, limited, unavailable, unknownCapacity },
      groups: {
        byStatus: [
          { key: "ACTIVE", label: "Active", count: active },
          { key: "PAUSED", label: "Paused", count: paused },
          { key: "INACTIVE", label: "Inactive", count: inactive },
        ].filter((g) => g.count > 0),
        byCapacity: [
          { key: "AVAILABLE", label: "Available", count: available },
          { key: "LIMITED", label: "Limited", count: limited },
          { key: "UNAVAILABLE", label: "Unavailable", count: unavailable },
          { key: "UNKNOWN", label: "Unknown", count: unknownCapacity },
        ].filter((g) => g.count > 0),
      },
    };
  }

  private async fetchRows(
    where: Prisma.ProviderWhereInput,
    filters: ProvidersReportDto,
    skip: number,
    take: number,
  ): Promise<ProviderReportRow[]> {
    const rows = await this.prisma.provider.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "displayName")]: sortOrder(filters.order ?? "asc") },
      skip,
      take,
      include: {
        organization: { select: { name: true } },
        _count: { select: { services: true, coverageAreas: true, languages: true, paymentTypes: true } },
        capacity: { where: { serviceCategoryId: null }, select: { status: true, updatedAt: true }, take: 1 },
      },
    });
    return rows.map((p) => {
      const general = p.capacity[0];
      const capacity: CapacityStatus = general?.status ?? "UNKNOWN";
      const location = [p.city, p.state].filter(Boolean).join(", ") || null;
      return {
        id: p.id,
        displayName: p.displayName,
        organization: p.organization.name,
        status: p.status,
        statusLabel: humanizeEnum(p.status),
        location,
        servicesCount: p._count.services,
        coverageCount: p._count.coverageAreas,
        languagesCount: p._count.languages,
        paymentTypesCount: p._count.paymentTypes,
        capacity,
        lastCapacityUpdate: iso(general?.updatedAt ?? null),
        updatedAt: p.updatedAt.toISOString(),
      };
    });
  }

  async report(
    filters: ProvidersReportDto,
  ): Promise<ReportResponse<ProviderReportRow, ProviderReportSummary, ProviderReportGroups>> {
    const now = new Date();
    const where = this.buildWhere(filters);
    const { skip, take } = skipTake(filters);
    const [{ summary, groups }, total, items] = await Promise.all([
      this.summarize(where),
      this.prisma.provider.count({ where }),
      this.fetchRows(where, filters, skip, take),
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

  async export(filters: ProvidersReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const where = this.buildWhere(filters);
    const total = await this.prisma.provider.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS);
    const headers = [
      "Provider",
      "Organization",
      "Status",
      "Location",
      "Services",
      "Coverage Areas",
      "Languages",
      "Payment Types",
      "Capacity",
      "Last Capacity Update",
      "Updated",
    ];
    const csvRows = rows.map((r) => [
      r.displayName,
      r.organization,
      r.statusLabel,
      r.location,
      r.servicesCount,
      r.coverageCount,
      r.languagesCount,
      r.paymentTypesCount,
      humanizeEnum(r.capacity),
      r.lastCapacityUpdate,
      r.updatedAt,
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
