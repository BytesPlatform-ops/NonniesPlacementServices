import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { CaseAppointmentsService, type CaseAppointmentView } from "../case-appointments/case-appointments.service";
import { RequestAppointmentDto, RespondToAppointmentDto } from "../case-appointments/case-appointments.dto";
import { CaseDocumentsService, type CaseDocumentView } from "../case-documents/case-documents.service";
import { MessagesService } from "../messages/messages.service";
import { ListMessagesDto } from "../messages/dto/messages.dto";
import type { MessageView } from "../messages/messages.serializer";
import { SeekerCaseAccessService } from "./seeker-case-access";
import { SeekerService, type SeekerCarePlanView, type SeekerCaseSummary, type SeekerDashboardView } from "./seeker.service";
import type { SeekerProviderView } from "./seeker.serializer";
import {
  SeekerCaseQueryDto,
  SendSeekerMessageDto,
  UpdateSeekerAccountDto,
  UploadSeekerDocumentDto,
} from "./care-seeker.dto";

/**
 * The family portal API.
 *
 * Every route is gated on a `seeker_*` permission that only the CARE_SEEKER
 * role holds, so no staff or provider session can reach this controller at all.
 * Within it, `SeekerCaseAccessService` decides which case — a family member
 * asking for a case they hold no grant on gets a 404, never another family's
 * data and never a 403 that would confirm the case exists.
 */
@Controller("seeker")
export class SeekerController {
  constructor(
    private readonly seeker: SeekerService,
    private readonly access: SeekerCaseAccessService,
    private readonly documents: CaseDocumentsService,
    private readonly appointments: CaseAppointmentsService,
    private readonly messages: MessagesService,
    private readonly prisma: PrismaService,
  ) {}

  /** Resolves the case for this request and the organization it belongs to. */
  private async scope(user: RequestUser, caseId?: string): Promise<{ caseId: string; organizationId: string }> {
    const grant = this.access.resolveCase(user, caseId);
    const record = await this.prisma.case.findUniqueOrThrow({
      where: { id: grant.caseId },
      select: { organizationId: true },
    });
    return { caseId: grant.caseId, organizationId: record.organizationId };
  }

  // ---- Case context ----

  @Get("cases")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  listCases(@CurrentUser() user: RequestUser): SeekerCaseSummary[] {
    return this.seeker.listCases(user);
  }

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  dashboard(@CurrentUser() user: RequestUser, @Query() query: SeekerCaseQueryDto): Promise<SeekerDashboardView> {
    return this.seeker.dashboard(user, query.caseId);
  }

  @Get("care-plan")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  carePlan(@CurrentUser() user: RequestUser, @Query() query: SeekerCaseQueryDto): Promise<SeekerCarePlanView> {
    return this.seeker.carePlan(user, query.caseId);
  }

  @Get("matches")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  matches(
    @CurrentUser() user: RequestUser,
    @Query() query: SeekerCaseQueryDto,
  ): Promise<{ case: SeekerCaseSummary; providers: SeekerProviderView[] }> {
    return this.seeker.matches(user, query.caseId);
  }

  @Get("matches/:referralId")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  match(
    @CurrentUser() user: RequestUser,
    @Param("referralId", new ParseUUIDPipe()) referralId: string,
  ): Promise<SeekerProviderView> {
    return this.seeker.match(user, referralId);
  }

  @Get("progress")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  progress(@CurrentUser() user: RequestUser, @Query() query: SeekerCaseQueryDto) {
    return this.seeker.progress(user, query.caseId);
  }

  // ---- Documents ----

  @Get("documents")
  @RequirePermissions(PERMISSIONS.SEEKER_DOCUMENTS_READ)
  async listDocuments(
    @CurrentUser() user: RequestUser,
    @Query() query: SeekerCaseQueryDto,
  ): Promise<CaseDocumentView[]> {
    const { caseId } = await this.scope(user, query.caseId);
    // `seekerOnly` is the second gate: a CASE_TEAM document on an authorized
    // case is still invisible to the family.
    return this.documents.list(caseId, true);
  }

  @Post("documents/:documentId/upload")
  @RequirePermissions(PERMISSIONS.SEEKER_DOCUMENTS_UPLOAD)
  async uploadDocument(
    @CurrentUser() user: RequestUser,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Body() dto: UploadSeekerDocumentDto,
  ): Promise<CaseDocumentView> {
    const { caseId, organizationId } = await this.scope(user, dto.caseId);
    return this.documents.upload(
      {
        caseId,
        organizationId,
        documentId,
        file: { fileName: dto.fileName, contentType: dto.contentType, contentBase64: dto.contentBase64 },
        seekerOnly: true,
      },
      user.id,
    );
  }

  @Get("documents/:documentId/download")
  @RequirePermissions(PERMISSIONS.SEEKER_DOCUMENTS_READ)
  async downloadDocument(
    @CurrentUser() user: RequestUser,
    @Param("documentId", new ParseUUIDPipe()) documentId: string,
    @Query() query: SeekerCaseQueryDto,
  ): Promise<{ url: string; fileName: string; contentType: string }> {
    const { caseId } = await this.scope(user, query.caseId);
    return this.documents.downloadUrl(caseId, documentId, true);
  }

  // ---- Tours & appointments ----

  @Get("appointments")
  @RequirePermissions(PERMISSIONS.SEEKER_APPOINTMENTS_READ)
  async listAppointments(
    @CurrentUser() user: RequestUser,
    @Query() query: SeekerCaseQueryDto,
  ): Promise<CaseAppointmentView[]> {
    const { caseId } = await this.scope(user, query.caseId);
    return this.appointments.list(caseId);
  }

  @Post("appointments")
  @RequirePermissions(PERMISSIONS.SEEKER_APPOINTMENTS_REQUEST)
  @HttpCode(HttpStatus.CREATED)
  async requestAppointment(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestAppointmentDto,
  ): Promise<CaseAppointmentView> {
    const { caseId, organizationId } = await this.scope(user, dto.caseId);
    // A referral id from the browser is re-checked against this family's own
    // grants before it is stored against the request.
    if (dto.referralId) await this.access.requireReferral(user, dto.referralId);
    return this.appointments.requestFromSeeker(
      { caseId, organizationId, providerId: dto.providerId ?? null, referralId: dto.referralId ?? null, note: dto.note },
      user.id,
    );
  }

  @Patch("appointments/:appointmentId")
  @RequirePermissions(PERMISSIONS.SEEKER_APPOINTMENTS_REQUEST)
  async respondToAppointment(
    @CurrentUser() user: RequestUser,
    @Param("appointmentId", new ParseUUIDPipe()) appointmentId: string,
    @Body() dto: RespondToAppointmentDto,
  ): Promise<CaseAppointmentView> {
    const { caseId, organizationId } = await this.scope(user, dto.caseId);
    return this.appointments.respondAsSeeker(
      { caseId, organizationId, appointmentId, action: dto.action, note: dto.note },
      user.id,
    );
  }

  // ---- Messages ----

  @Get("messages")
  @RequirePermissions(PERMISSIONS.SEEKER_MESSAGES_READ)
  async listMessages(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMessagesDto & SeekerCaseQueryDto,
  ): Promise<PaginatedResult<MessageView>> {
    const { caseId } = await this.scope(user, query.caseId);
    return this.messages.listFamilyForSeeker(caseId, query);
  }

  @Post("messages")
  @RequirePermissions(PERMISSIONS.SEEKER_MESSAGES_SEND)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(@CurrentUser() user: RequestUser, @Body() dto: SendSeekerMessageDto): Promise<MessageView> {
    const { caseId } = await this.scope(user, dto.caseId);
    return this.messages.sendFamilyForSeeker(caseId, user.id, { body: dto.body });
  }

  // ---- Account ----

  @Get("account")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  account(@CurrentUser() user: RequestUser) {
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      cases: this.seeker.listCases(user),
    };
  }

  @Patch("account")
  @RequirePermissions(PERMISSIONS.SEEKER_CASE_READ)
  async updateAccount(@CurrentUser() user: RequestUser, @Body() dto: UpdateSeekerAccountDto) {
    // Scoped to the caller's own row and to display fields only. Email, role
    // and case links are deliberately not editable here — changing any of them
    // would be changing authorization.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      },
      select: { email: true, firstName: true, lastName: true, displayName: true },
    });
    return { ...updated, cases: this.seeker.listCases(user) };
  }
}
