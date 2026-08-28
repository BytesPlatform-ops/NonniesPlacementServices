import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ReferralsService } from "./referrals.service";
import type { StaffReferralDetail, StaffReferralSummary } from "./referrals.serializer";
import {
  CreateReferralDto,
  ListReferralsQueryDto,
  ProvideInformationDto,
  SchedulePlacementDto,
  SendReferralDto,
  WithdrawReferralDto,
} from "./dto/referrals.dto";

@Controller()
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("cases/:caseId/referrals")
  @RequirePermissions(PERMISSIONS.REFERRALS_READ)
  listForCase(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string): Promise<StaffReferralSummary[]> {
    return this.referrals.listForCase(user, caseId);
  }

  @Post("cases/:caseId/service-requests/:serviceRequestId/referrals")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  create(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() dto: CreateReferralDto,
  ): Promise<StaffReferralDetail> {
    return this.referrals.create(user, caseId, serviceRequestId, dto);
  }

  @Get("referrals/:id")
  @RequirePermissions(PERMISSIONS.REFERRALS_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<StaffReferralDetail> {
    return this.referrals.findOneStaff(user, id);
  }

  @Post("referrals/:id/send")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  send(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SendReferralDto): Promise<StaffReferralDetail> {
    return this.referrals.send(user, id, dto);
  }

  @Post("referrals/:id/withdraw")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  withdraw(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: WithdrawReferralDto): Promise<StaffReferralDetail> {
    return this.referrals.withdraw(user, id, dto);
  }

  @Post("referrals/:id/information")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  provideInformation(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ProvideInformationDto): Promise<StaffReferralDetail> {
    return this.referrals.provideInformation(user, id, dto);
  }

  @Post("referrals/:id/resend-notification")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  resend(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<StaffReferralDetail> {
    return this.referrals.resendNotification(user, id);
  }

  @Patch("referrals/:id/placement")
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  schedule(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SchedulePlacementDto): Promise<StaffReferralDetail> {
    return this.referrals.schedule(user, id, dto, false) as Promise<StaffReferralDetail>;
  }

  @Get("operations/referrals")
  @RequirePermissions(PERMISSIONS.REFERRALS_READ_ALL)
  operations(@Query() query: ListReferralsQueryDto): Promise<PaginatedResult<StaffReferralSummary>> {
    return this.referrals.operationsList(query);
  }
}
