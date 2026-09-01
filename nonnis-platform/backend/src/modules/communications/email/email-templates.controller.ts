import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { EmailTemplateService } from "./email-template.service";
import { CreateEmailTemplateDto, ListEmailTemplatesDto, PreviewDesignDto, TestSendDto, UpdateEmailTemplateDto } from "../dto/email-template.dto";

@Controller("communications/email/templates")
export class EmailTemplatesController {
  constructor(private readonly templates: EmailTemplateService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListEmailTemplatesDto) {
    return this.templates.list(query);
  }

  @Post("preview")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  preview(@Body() dto: PreviewDesignDto) {
    return this.templates.previewDesign(dto);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.templates.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEmailTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.templates.update(user, id, dto);
  }

  @Post(":id/duplicate")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  duplicate(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.templates.duplicate(user, id);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  archive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.templates.archive(user, id);
  }

  @Post(":id/test-send")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  testSend(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: TestSendDto) {
    return this.templates.testSend(user, id, dto);
  }
}
