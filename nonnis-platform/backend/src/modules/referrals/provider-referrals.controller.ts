import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ReferralsService } from "./referrals.service";
import type { ProviderReferralDetail, ProviderReferralSummary } from "./referrals.serializer";
import {
  AssignReferralDto,
  ConfirmStartDto,
  ListReferralsQueryDto,
  ReportUnsuccessfulStartDto,
  RespondReferralDto,
  SchedulePlacementDto,
} from "./dto/referrals.dto";

@Controller("provider-portal/referrals")
export class ProviderReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REFERRALS_READ)
  inbox(@CurrentUser() user: RequestUser, @Query() query: ListReferralsQueryDto): Promise<PaginatedResult<ProviderReferralSummary>> {
    return this.referrals.providerInbox(user, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.REFERRALS_READ)
  detail(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ProviderReferralDetail> {
    return this.referrals.providerDetail(user, id);
  }

  @Post(":id/respond")
  @RequirePermissions(PERMISSIONS.REFERRALS_RESPOND_OWN)
  respond(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: RespondReferralDto): Promise<ProviderReferralDetail> {
    return this.referrals.respond(user, id, dto);
  }

  @Patch(":id/assignment")
  @RequirePermissions(PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION)
  assign(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AssignReferralDto): Promise<ProviderReferralDetail> {
    return this.referrals.assign(user, id, dto);
  }

  @Patch(":id/schedule")
  @RequirePermissions(PERMISSIONS.REFERRALS_RESPOND_OWN)
  schedule(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SchedulePlacementDto): Promise<ProviderReferralDetail> {
    return this.referrals.schedule(user, id, dto, true) as Promise<ProviderReferralDetail>;
  }

  @Post(":id/confirm-start")
  @RequirePermissions(PERMISSIONS.REFERRALS_RESPOND_OWN)
  confirmStart(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ConfirmStartDto): Promise<ProviderReferralDetail> {
    return this.referrals.confirmStart(user, id, dto);
  }

  @Post(":id/report-unsuccessful-start")
  @RequirePermissions(PERMISSIONS.REFERRALS_RESPOND_OWN)
  reportUnsuccessful(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ReportUnsuccessfulStartDto): Promise<ProviderReferralDetail> {
    return this.referrals.reportUnsuccessfulStart(user, id, dto);
  }
}
