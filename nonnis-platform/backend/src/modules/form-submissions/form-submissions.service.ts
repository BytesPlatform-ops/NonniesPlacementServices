import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import {
  toFormSubmissionDetail,
  toFormSubmissionSummary,
  type FormSubmissionDetail,
  type FormSubmissionSummary,
} from "./form-submissions.serializer";
import type {
  IngestFormSubmissionDto,
  ListFormSubmissionsDto,
  UpdateFormSubmissionDto,
} from "./dto/form-submissions.dto";

const MAX_PAYLOAD_BYTES = 512 * 1024;
const SORTABLE = new Set(["submittedAt", "createdAt", "status", "formKey"]);

export interface IngestResult {
  id: string;
  reference: string;
  duplicate: boolean;
}

/**
 * Persists public website form submissions (server-to-server ingest) and serves
 * the internal admin review surface. Never stores secrets or uploaded file bytes
 * — only the normalized submission data plus safe processing metadata.
 */
@Injectable()
export class FormSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ingest(dto: IngestFormSubmissionDto): Promise<IngestResult> {
    if (JSON.stringify(dto.submittedData).length > MAX_PAYLOAD_BYTES) {
      throw new BadRequestException("Submission payload exceeds the allowed size.");
    }

    // Idempotent on `reference`: a retry with the same reference is a no-op.
    const existing = await this.prisma.websiteFormSubmission.findUnique({
      where: { reference: dto.reference },
      select: { id: true, reference: true },
    });
    if (existing) return { id: existing.id, reference: existing.reference, duplicate: true };

    try {
      const created = await this.prisma.websiteFormSubmission.create({
        data: {
          reference: dto.reference,
          formKey: dto.formKey,
          formName: dto.formName,
          sourcePage: dto.sourcePage,
          submitterName: dto.submitterName,
          submitterEmail: dto.submitterEmail,
          submitterPhone: dto.submitterPhone,
          submittedData: dto.submittedData as Prisma.InputJsonValue,
          emailStatus: dto.emailStatus,
          reportGenerated: dto.reportGenerated ?? false,
          documentGenerated: dto.documentGenerated ?? false,
          attachmentsCount: dto.attachmentsCount ?? 0,
          submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : new Date(),
        },
        select: { id: true, reference: true },
      });
      return { id: created.id, reference: created.reference, duplicate: false };
    } catch (error) {
      // Unique-violation race: another concurrent ingest of the same reference won.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await this.prisma.websiteFormSubmission.findUnique({
          where: { reference: dto.reference },
          select: { id: true, reference: true },
        });
        if (row) return { id: row.id, reference: row.reference, duplicate: true };
      }
      throw error;
    }
  }

  async list(query: ListFormSubmissionsDto): Promise<PaginatedResult<FormSubmissionSummary>> {
    const { page, pageSize, search, formKey, status, sourcePage, reviewed, dateFrom, dateTo } = query;
    const and: Prisma.WebsiteFormSubmissionWhereInput[] = [];
    if (formKey) and.push({ formKey });
    if (status) and.push({ status });
    // Archiving only means something if it removes the item from the working
    // list. An explicit status filter (including status=ARCHIVED) always wins,
    // so archived submissions remain reachable — they are never deleted.
    if (!status && !query.includeArchived) and.push({ status: { not: "ARCHIVED" } });
    if (sourcePage) and.push({ sourcePage: { contains: sourcePage, mode: "insensitive" } });
    if (reviewed !== undefined) and.push(reviewed ? { reviewedAt: { not: null } } : { reviewedAt: null });
    if (dateFrom) and.push({ submittedAt: { gte: new Date(dateFrom) } });
    if (dateTo) and.push({ submittedAt: { lte: new Date(dateTo) } });
    if (search) {
      and.push({
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { submitterName: { contains: search, mode: "insensitive" } },
          { submitterEmail: { contains: search, mode: "insensitive" } },
          { submitterPhone: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.WebsiteFormSubmissionWhereInput = and.length > 0 ? { AND: and } : {};
    const sortField = query.sort && SORTABLE.has(query.sort) ? query.sort : "submittedAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.websiteFormSubmission.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.websiteFormSubmission.count({ where }),
    ]);

    return {
      items: rows.map(toFormSubmissionSummary),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<FormSubmissionDetail> {
    const row = await this.prisma.websiteFormSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Submission ${id} not found`);
    const reviewerName = await this.resolveReviewerName(row.reviewedByUserId);
    return toFormSubmissionDetail(row, reviewerName);
  }

  async update(user: RequestUser, id: string, dto: UpdateFormSubmissionDto): Promise<FormSubmissionDetail> {
    const existing = await this.prisma.websiteFormSubmission.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException(`Submission ${id} not found`);

    if (dto.relatedCaseId) {
      const found = await this.prisma.case.findUnique({ where: { id: dto.relatedCaseId }, select: { id: true } });
      if (!found) throw new BadRequestException("The related case does not exist.");
    }
    if (dto.relatedProviderId) {
      const found = await this.prisma.provider.findUnique({ where: { id: dto.relatedProviderId }, select: { id: true } });
      if (!found) throw new BadRequestException("The related provider does not exist.");
    }

    const touchesReview = dto.status !== undefined || dto.internalNotes !== undefined;
    const updated = await this.prisma.websiteFormSubmission.update({
      where: { id },
      data: {
        status: dto.status,
        internalNotes: dto.internalNotes,
        relatedCaseId: dto.relatedCaseId,
        relatedProviderId: dto.relatedProviderId,
        ...(touchesReview ? { reviewedByUserId: user.id, reviewedAt: new Date() } : {}),
      },
    });

    await this.audit.record({
      action: "form_submission.updated",
      entityType: "WebsiteFormSubmission",
      entityId: id,
      actorUserId: user.id,
      metadata: {
        fields: Object.keys(dto),
        ...(dto.status && dto.status !== existing.status ? { statusFrom: existing.status, statusTo: dto.status } : {}),
      },
    });

    const reviewerName = await this.resolveReviewerName(updated.reviewedByUserId);
    return toFormSubmissionDetail(updated, reviewerName);
  }

  private async resolveReviewerName(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true, email: true },
    });
    if (!u) return null;
    return u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
  }
}
