import { Injectable } from "@nestjs/common";
import { Prisma, type ReferralStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { referralOverdueWhere } from "../../referrals/referral-overdue";
import { ReferralsReportDto } from "../dto/report-filters.dto";
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

export interface ReferralReportRow {
  id: string;
  reference: string;
  caseId: string;
  caseNumber: string;
  organization: string | null;
  facility: string | null;
  service: string | null;
  provider: string | null;
  status: string;
  statusLabel: string;
  overdue: boolean;
  sentAt: string | null;
  responseDueAt: string | null;
  viewedAt: string | null;
  lastResponseAt: string | null;
  placementStatus: string | null;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
}

export interface ReferralReportSummary {
  total: number;
  overdue: number;
  byStatus: Record<string, number>;
}

export interface ReferralReportGroups {
  byStatus: GroupCount[];
}

const SORT_FIELDS = ["sentAt", "createdAt", "responseDueAt", "status"];
const ALL_STATUSES: ReferralStatus[] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "INFORMATION_REQUESTED",
  "CONDITIONALLY_ACCEPTED",
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
  "CANCELLED",
];

@Injectable()
export class ReferralsReportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filters: ReferralsReportDto, now: Date): Prisma.ReferralWhereInput {
    const and: Prisma.ReferralWhereInput[] = [];
    if (!filters.includeDrafts) and.push({ status: { not: "DRAFT" } });
    if (filters.organizationId) and.push({ case: { organizationId: filters.organizationId } });
    if (filters.facilityId) and.push({ case: { originatingFacilityId: filters.facilityId } });
    if (filters.providerId) and.push({ providerId: filters.providerId });
    if (filters.serviceCategoryId) and.push({ serviceRequest: { serviceCategoryId: filters.serviceCategoryId } });
    if (filters.referralStatus) and.push({ status: filters.referralStatus });
    if (filters.overdue) and.push(referralOverdueWhere(now));

    const range = buildDateRange(filters.dateFrom, filters.dateTo);
    if (range) {
      if (filters.includeDrafts) {
        and.push({ OR: [{ sentAt: range }, { AND: [{ sentAt: null }, { createdAt: range }] }] });
      } else {
        and.push({ sentAt: range });
      }
    }
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { case: { caseNumber: { contains: search, mode: "insensitive" } } },
          { provider: { displayName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: ReferralsReportDto): Record<string, unknown> {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      organizationId: filters.organizationId ?? null,
      facilityId: filters.facilityId ?? null,
      providerId: filters.providerId ?? null,
      serviceCategoryId: filters.serviceCategoryId ?? null,
      referralStatus: filters.referralStatus ?? null,
      overdue: filters.overdue ?? false,
      includeDrafts: filters.includeDrafts ?? false,
      search: filters.search ?? null,
    };
  }

  private async summarize(
    where: Prisma.ReferralWhereInput,
    now: Date,
  ): Promise<{ summary: ReferralReportSummary; groups: ReferralReportGroups }> {
    const byStatusP = this.prisma.referral.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } });
    const overdueP = this.prisma.referral.count({ where: { AND: [where, referralOverdueWhere(now)] } });
    const [byStatusRaw, overdue] = await Promise.all([byStatusP, overdueP]);
    const byStatusMap: Record<string, number> = {};
    let total = 0;
    for (const g of byStatusRaw) {
      byStatusMap[g.status] = g._count._all;
      total += g._count._all;
    }
    const groups: ReferralReportGroups = {
      byStatus: ALL_STATUSES.filter((s) => byStatusMap[s]).map((s) => ({
        key: s,
        label: humanizeEnum(s),
        count: byStatusMap[s],
      })),
    };
    return { summary: { total, overdue, byStatus: byStatusMap }, groups };
  }

  private async fetchRows(
    where: Prisma.ReferralWhereInput,
    filters: ReferralsReportDto,
    skip: number,
    take: number,
    now: Date,
  ): Promise<ReferralReportRow[]> {
    const rows = await this.prisma.referral.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "sentAt")]: sortOrder(filters.order) },
      skip,
      take,
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            organization: { select: { name: true } },
            originatingFacility: { select: { name: true } },
          },
        },
        provider: { select: { displayName: true } },
        serviceRequest: { select: { category: true, serviceCategory: { select: { name: true } } } },
        placement: { select: { status: true, scheduledStartAt: true, actualStartAt: true } },
      },
    });
    const overdueStatuses = new Set(["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"]);
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      caseId: r.case.id,
      caseNumber: r.case.caseNumber,
      organization: r.case.organization.name,
      facility: r.case.originatingFacility.name,
      service: r.serviceRequest.serviceCategory?.name ?? humanizeEnum(r.serviceRequest.category),
      provider: r.provider.displayName,
      status: r.status,
      statusLabel: humanizeEnum(r.status),
      overdue: !!r.responseDueAt && r.responseDueAt < now && overdueStatuses.has(r.status),
      sentAt: iso(r.sentAt),
      responseDueAt: iso(r.responseDueAt),
      viewedAt: iso(r.viewedAt),
      lastResponseAt: iso(r.lastResponseAt),
      placementStatus: r.placement ? r.placement.status : null,
      scheduledStartAt: iso(r.placement?.scheduledStartAt ?? null),
      actualStartAt: iso(r.placement?.actualStartAt ?? null),
    }));
  }

  async report(
    filters: ReferralsReportDto,
  ): Promise<ReportResponse<ReferralReportRow, ReferralReportSummary, ReferralReportGroups>> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const { skip, take } = skipTake(filters);
    const [{ summary, groups }, total, items] = await Promise.all([
      this.summarize(where, now),
      this.prisma.referral.count({ where }),
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

  async export(filters: ReferralsReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const now = new Date();
    const where = this.buildWhere(filters, now);
    const total = await this.prisma.referral.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS, now);
    const headers = [
      "Referral",
      "Case",
      "Organization",
      "Facility",
      "Service",
      "Provider",
      "Status",
      "Overdue",
      "Sent",
      "Due",
      "Viewed",
      "Last Response",
      "Placement",
      "Scheduled Start",
      "Actual Start",
    ];
    const csvRows = rows.map((r) => [
      r.reference,
      r.caseNumber,
      r.organization,
      r.facility,
      r.service,
      r.provider,
      r.statusLabel,
      r.overdue,
      r.sentAt,
      r.responseDueAt,
      r.viewedAt,
      r.lastResponseAt,
      r.placementStatus ? humanizeEnum(r.placementStatus) : null,
      r.scheduledStartAt,
      r.actualStartAt,
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
