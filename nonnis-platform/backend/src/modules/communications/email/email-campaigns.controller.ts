import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { EmailCampaignService } from "./email-campaign.service";
import { AudiencePreviewDto, CreateCampaignDto, ListCampaignsDto, ListRecipientsDto, UpdateCampaignDto } from "../dto/email-campaign.dto";

@Controller("communications/email/campaigns")
export class EmailCampaignsController {
  constructor(private readonly campaigns: EmailCampaignService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListCampaignsDto) {
    return this.campaigns.list(query);
  }

  @Post("audience-preview")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  audiencePreview(@Body() dto: AudiencePreviewDto) {
    return this.campaigns.audiencePreview(dto.audience);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.campaigns.findOne(id);
  }

  @Get(":id/recipients")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  recipients(@Param("id", new ParseUUIDPipe()) id: string, @Query() query: ListRecipientsDto) {
    return this.campaigns.recipients(id, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateCampaignDto) {
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
