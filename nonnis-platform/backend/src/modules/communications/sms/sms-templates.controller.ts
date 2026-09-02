import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { SmsTemplateService } from "./sms-template.service";
import { CreateSmsTemplateDto, ListSmsTemplatesDto, PreviewSmsDto, TestSmsDto, UpdateSmsTemplateDto } from "../dto/sms.dto";

@Controller("communications/sms/templates")
export class SmsTemplatesController {
  constructor(private readonly templates: SmsTemplateService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListSmsTemplatesDto) {
    return this.templates.list(query);
  }

  /** Segment/encoding estimate for unsaved editor content (declared before :id). */
  @Post("preview")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  preview(@Body() dto: PreviewSmsDto) {
    return this.templates.preview(dto.body);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.templates.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSmsTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateSmsTemplateDto) {
    return this.templates.update(user, id, dto);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  archive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.templates.archive(user, id);
  }

  @Post(":id/test")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  test(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: TestSmsDto) {
    return this.templates.testSend(user, id, dto.phone, dto.body);
  }
}
