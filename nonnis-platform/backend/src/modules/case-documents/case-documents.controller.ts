import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { PrismaService } from "../../database/prisma.service";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ensureCaseAccess } from "../cases/case-access";
import { CaseDocumentsService, type CaseDocumentView } from "./case-documents.service";
import { CreateCaseDocumentDto, ReviewCaseDocumentDto, UploadCaseDocumentDto } from "./case-documents.dto";

/**
 * Staff-side case documents.
 *
 * Bounded by the same `ensureCaseAccess` every other case sub-resource uses, so
 * a cross-organization case is a 404 here exactly as it is for requirements and
 * service requests.
 */
@Controller("cases/:caseId/documents")
export class CaseDocumentsController {
  constructor(
    private readonly documents: CaseDocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASE_DOCUMENTS_READ)
  async list(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
  ): Promise<CaseDocumentView[]> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    return this.documents.list(caseId, false);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASE_DOCUMENTS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: CreateCaseDocumentDto,
  ): Promise<CaseDocumentView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.documents.create(
      {
        caseId,
        organizationId: record.organizationId,
        title: dto.title,
        description: dto.description ?? null,
        requestedFromSeeker: dto.requestedFromSeeker,
        visibility: dto.visibility,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      user.id,
    );
  }

  @Post(":documentId/upload")
  @RequirePermissions(PERMISSIONS.CASE_DOCUMENTS_MANAGE)
  async upload(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Body() dto: UploadCaseDocumentDto,
  ): Promise<CaseDocumentView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.documents.upload(
      { caseId, organizationId: record.organizationId, documentId, file: dto, seekerOnly: false },
      user.id,
    );
  }

  @Patch(":documentId/review")
  @RequirePermissions(PERMISSIONS.CASE_DOCUMENTS_MANAGE)
  async review(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Body() dto: ReviewCaseDocumentDto,
  ): Promise<CaseDocumentView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.documents.review(
      { caseId, organizationId: record.organizationId, documentId, status: dto.status, reviewNote: dto.reviewNote },
      user.id,
    );
  }

  @Get(":documentId/download")
  @RequirePermissions(PERMISSIONS.CASE_DOCUMENTS_READ)
  async download(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
  ): Promise<{ url: string; fileName: string; contentType: string }> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    return this.documents.downloadUrl(caseId, documentId, false);
  }
}
