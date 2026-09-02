import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { SmsCampaignService } from "./sms-campaign.service";
import { CreateSmsCampaignDto, ListSmsCampaignsDto, ListSmsRecipientsDto, SmsAudiencePreviewDto, UpdateSmsCampaignDto } from "../dto/sms.dto";

@Controller("communications/sms/campaigns")
export class SmsCampaignsController {
  constructor(private readonly campaigns: SmsCampaignService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListSmsCampaignsDto) {
    return this.campaigns.list(query);
  }

  @Post("audience-preview")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  audiencePreview(@Body() dto: SmsAudiencePreviewDto) {
    return this.campaigns.audiencePreview(dto.audience, dto.templateId, dto.body);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.campaigns.findOne(id);
  }

  @Get(":id/recipients")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  recipients(@Param("id", new ParseUUIDPipe()) id: string, @Query() query: ListSmsRecipientsDto) {
    return this.campaigns.recipients(id, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSmsCampaignDto) {
    return this.campaigns.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateSmsCampaignDto) {
    return this.campaigns.update(user, id, dto);
  }

  @Post(":id/queue")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  queue(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.campaigns.queue(user, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  cancel(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.campaigns.cancel(user, id);
  }
}
