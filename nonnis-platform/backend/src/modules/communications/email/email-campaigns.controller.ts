import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { EmailDispatcherService } from "./email-dispatcher.service";
import { EmailCampaignService } from "./email-campaign.service";
import { AudiencePreviewDto, CreateCampaignDto, ListCampaignsDto, ListRecipientsDto, UpdateCampaignDto } from "../dto/email-campaign.dto";

@Controller("communications/email/campaigns")
export class EmailCampaignsController {
  constructor(
    private readonly campaigns: EmailCampaignService,
    private readonly dispatcher: EmailDispatcherService,
  ) {}

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
  async queue(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    const result = await this.campaigns.queue(user, id);
    // Start sending inside this request: a background timer does not survive on
    // a serverless host, so the first batch would otherwise sit untouched until
    // something else happened to wake an instance. Best effort — recipients stay
    // queued and are picked up again if this pass does not finish them.
    try {
      await this.dispatcher.runOnce();
    } catch {
      // Already queued and retryable; never fail the user's action over this.
    }
    return result;
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  cancel(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.campaigns.cancel(user, id);
  }
}
