import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { FormSubmissionsReportDto } from "../dto/report-filters.dto";
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

export interface FormSubmissionReportRow {
  id: string;
  reference: string;
  formKey: string;
  formName: string;
  submitterName: string | null;
  submittedAt: string;
  status: string;
  statusLabel: string;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface FormSubmissionReportSummary {
  total: number;
  new: number;
  inReview: number;
  resolved: number;
  archived: number;
}

export interface FormSubmissionReportGroups {
  byForm: GroupCount[];
}

const SORT_FIELDS = ["submittedAt", "status", "formKey"];

@Injectable()
export class FormSubmissionsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookups: ReportLookupService,
  ) {}

  private buildWhere(filters: FormSubmissionsReportDto): Prisma.WebsiteFormSubmissionWhereInput {
    const and: Prisma.WebsiteFormSubmissionWhereInput[] = [];
    if (filters.formKey) and.push({ formKey: filters.formKey });
    if (filters.status) and.push({ status: filters.status });
    if (filters.reviewed !== undefined) and.push({ reviewedAt: filters.reviewed ? { not: null } : null });
    const range = buildDateRange(filters.dateFrom, filters.dateTo);
    if (range) and.push({ submittedAt: range });
    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { submitterName: { contains: search, mode: "insensitive" } },
          { submitterEmail: { contains: search, mode: "insensitive" } },
          { formName: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private appliedFilters(filters: FormSubmissionsReportDto): Record<string, unknown> {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      formKey: filters.formKey ?? null,
      status: filters.status ?? null,
      reviewed: filters.reviewed ?? null,
      search: filters.search ?? null,
    };
  }

  private async summarize(
    where: Prisma.WebsiteFormSubmissionWhereInput,
  ): Promise<{ summary: FormSubmissionReportSummary; groups: FormSubmissionReportGroups }> {
    const byStatusP = this.prisma.websiteFormSubmission.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } });
    const byFormP = this.prisma.websiteFormSubmission.groupBy({ by: ["formKey"], where, _count: { _all: true }, orderBy: { formKey: "asc" } });
    const formNamesP = this.prisma.websiteFormSubmission.findMany({ where, distinct: ["formKey"], select: { formKey: true, formName: true } });
    const [byStatusRaw, byFormRaw, formNames] = await Promise.all([byStatusP, byFormP, formNamesP]);
    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const g of byStatusRaw) {
      statusMap[g.status] = g._count._all;
      total += g._count._all;
    }
    const nameByKey = new Map(formNames.map((f) => [f.formKey, f.formName]));
    return {
      summary: {
        total,
        new: statusMap.NEW ?? 0,
        inReview: statusMap.IN_REVIEW ?? 0,
        resolved: statusMap.RESOLVED ?? 0,
        archived: statusMap.ARCHIVED ?? 0,
      },
      groups: {
        byForm: byFormRaw
          .map((g) => ({ key: g.formKey, label: nameByKey.get(g.formKey) ?? g.formKey, count: g._count._all }))
          .sort((a, b) => b.count - a.count),
      },
    };
  }

  private async fetchRows(
    where: Prisma.WebsiteFormSubmissionWhereInput,
    filters: FormSubmissionsReportDto,
    skip: number,
    take: number,
  ): Promise<FormSubmissionReportRow[]> {
    // Explicit select — submittedData / internalNotes are NEVER exposed in reports.
    const rows = await this.prisma.websiteFormSubmission.findMany({
      where,
      orderBy: { [sortField(filters.sort, SORT_FIELDS, "submittedAt")]: sortOrder(filters.order) },
      skip,
      take,
      select: {
        id: true,
        reference: true,
        formKey: true,
        formName: true,
        submitterName: true,
        submittedAt: true,
        status: true,
        reviewedByUserId: true,
        reviewedAt: true,
      },
    });
    const reviewerNames = await this.lookups.userNames(rows.map((r) => r.reviewedByUserId));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      formKey: r.formKey,
      formName: r.formName,
      submitterName: r.submitterName,
      submittedAt: r.submittedAt.toISOString(),
      status: r.status,
      statusLabel: humanizeEnum(r.status),
      reviewed: r.reviewedAt !== null,
      reviewedBy: r.reviewedByUserId ? reviewerNames.get(r.reviewedByUserId) ?? null : null,
      reviewedAt: iso(r.reviewedAt),
    }));
  }

  async report(
    filters: FormSubmissionsReportDto,
  ): Promise<ReportResponse<FormSubmissionReportRow, FormSubmissionReportSummary, FormSubmissionReportGroups>> {
    const now = new Date();
    const where = this.buildWhere(filters);
    const { skip, take } = skipTake(filters);
    const [{ summary, groups }, total, items] = await Promise.all([
      this.summarize(where),
      this.prisma.websiteFormSubmission.count({ where }),
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

  async export(filters: FormSubmissionsReportDto): Promise<{ csv: string; rowCount: number } | { tooMany: number }> {
    const where = this.buildWhere(filters);
    const total = await this.prisma.websiteFormSubmission.count({ where });
    if (total > MAX_EXPORT_ROWS) return { tooMany: total };
    const rows = await this.fetchRows(where, filters, 0, MAX_EXPORT_ROWS);
    const headers = ["Submission", "Form", "Submitter", "Submitted", "Status", "Reviewed", "Reviewed By", "Reviewed At"];
    const csvRows = rows.map((r) => [
      r.reference,
      r.formName,
      r.submitterName,
      r.submittedAt,
      r.statusLabel,
      r.reviewed,
      r.reviewedBy,
      r.reviewedAt,
    ]);
    return { csv: toCsv(headers, csvRows), rowCount: rows.length };
  }
}
