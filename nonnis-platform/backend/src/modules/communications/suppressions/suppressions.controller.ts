import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { SuppressionsService } from "./suppressions.service";
import { CreateSuppressionDto, ListSuppressionsQueryDto } from "../dto/suppressions.dto";

@Controller("communications/suppressions")
export class SuppressionsController {
  constructor(private readonly suppressions: SuppressionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListSuppressionsQueryDto) {
    return this.suppressions.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSuppressionDto) {
    return this.suppressions.create(user, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  deactivate(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.suppressions.deactivate(user, id);
  }
}
