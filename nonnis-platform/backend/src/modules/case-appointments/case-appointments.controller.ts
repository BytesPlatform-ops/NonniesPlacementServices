import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { PrismaService } from "../../database/prisma.service";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ensureCaseAccess } from "../cases/case-access";
import { CaseAppointmentsService, type CaseAppointmentView } from "./case-appointments.service";
import { CreateCaseAppointmentDto, UpdateCaseAppointmentDto } from "./case-appointments.dto";

/** Staff-side tours and appointments, bounded by the shared case access rule. */
@Controller("cases/:caseId/appointments")
export class CaseAppointmentsController {
  constructor(
    private readonly appointments: CaseAppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASE_APPOINTMENTS_READ)
  async list(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
  ): Promise<CaseAppointmentView[]> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    return this.appointments.list(caseId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASE_APPOINTMENTS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: CreateCaseAppointmentDto,
  ): Promise<CaseAppointmentView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.appointments.create(
      {
        caseId,
        organizationId: record.organizationId,
        type: dto.type,
        providerId: dto.providerId ?? null,
        referralId: dto.referralId ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        durationMinutes: dto.durationMinutes ?? null,
        locationText: dto.locationText ?? null,
        instructions: dto.instructions ?? null,
      },
      user.id,
    );
  }

  @Patch(":appointmentId")
  @RequirePermissions(PERMISSIONS.CASE_APPOINTMENTS_MANAGE)
  async update(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("appointmentId", new ParseUUIDPipe()) appointmentId: string,
    @Body() dto: UpdateCaseAppointmentDto,
  ): Promise<CaseAppointmentView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.appointments.update(
      {
        caseId,
        organizationId: record.organizationId,
        appointmentId,
        type: dto.type,
        providerId: dto.providerId,
        scheduledAt: dto.scheduledAt !== undefined ? (dto.scheduledAt ? new Date(dto.scheduledAt) : null) : undefined,
        durationMinutes: dto.durationMinutes,
        locationText: dto.locationText,
        instructions: dto.instructions,
        outcomeNote: dto.outcomeNote,
        status: dto.status,
        cancelReason: dto.cancelReason,
      },
      user.id,
    );
  }
}
