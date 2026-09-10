import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { PrismaService } from "../../database/prisma.service";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ensureCaseAccess } from "../cases/case-access";
import { CareSeekerAdminService, type CareSeekerAccessView } from "./care-seeker-admin.service";
import { GrantCareSeekerAccessDto, UpdateCareSeekerAccessDto } from "./care-seeker.dto";

/**
 * Staff-side management of family access to a case.
 *
 * Sits under `cases/:caseId` like every other case sub-resource, so the case
 * itself is bounded by the same `ensureCaseAccess` rule and a cross-organization
 * case is a 404 here too. The extra `care_seekers.manage` permission keeps
 * granting access narrower than merely working on the case.
 */
@Controller("cases/:caseId/care-seekers")
export class CareSeekerAdminController {
  constructor(
    private readonly careSeekers: CareSeekerAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CARE_SEEKERS_MANAGE)
  async list(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
  ): Promise<CareSeekerAccessView[]> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    return this.careSeekers.list(caseId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CARE_SEEKERS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async grant(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: GrantCareSeekerAccessDto,
  ): Promise<CareSeekerAccessView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.careSeekers.grant(
      {
        caseId,
        organizationId: record.organizationId,
        email: dto.email,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        relationship: dto.relationship ?? null,
      },
      user.id,
    );
  }

  @Post(":accessId/resend-invitation")
  @RequirePermissions(PERMISSIONS.CARE_SEEKERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("accessId", new ParseUUIDPipe()) accessId: string,
  ): Promise<{ accessId: string; email: string; emailKind: string }> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.careSeekers.resendInvitation({ caseId, organizationId: record.organizationId, accessId }, user.id);
  }

  @Delete(":accessId")
  @RequirePermissions(PERMISSIONS.CARE_SEEKERS_MANAGE)
  async removeInvitation(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("accessId", new ParseUUIDPipe()) accessId: string,
  ): Promise<{ id: string; accountRemoved: boolean }> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.careSeekers.removeInvitation({ caseId, organizationId: record.organizationId, accessId }, user.id);
  }

  @Patch(":accessId")
  @RequirePermissions(PERMISSIONS.CARE_SEEKERS_MANAGE)
  async setStatus(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("accessId", new ParseUUIDPipe()) accessId: string,
    @Body() dto: UpdateCareSeekerAccessDto,
  ): Promise<CareSeekerAccessView> {
    const record = await ensureCaseAccess(this.prisma, user, caseId, true);
    return this.careSeekers.setStatus(
      {
        caseId,
        organizationId: record.organizationId,
        accessId,
        status: dto.status === "REVOKED" ? "REVOKED" : "ACTIVE",
        reason: dto.reason ?? null,
      },
      user.id,
    );
  }
}
