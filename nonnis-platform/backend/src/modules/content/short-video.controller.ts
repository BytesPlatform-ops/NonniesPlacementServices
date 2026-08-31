import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ShortVideoService } from "./short-video.service";
import type { VideoAdminView } from "./content.serializer";
import { CreateShortVideoDto, ListShortVideosDto, UpdateShortVideoDto } from "./dto/short-video.dto";
import { SetActiveDto } from "./dto/content-common.dto";

@Controller("short-videos")
export class ShortVideoController {
  constructor(private readonly videos: ShortVideoService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  list(@Query() query: ListShortVideosDto): Promise<PaginatedResult<VideoAdminView>> {
    return this.videos.adminList(query);
  }

  @Get(":id")
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<VideoAdminView> {
    return this.videos.adminFindOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShortVideoDto): Promise<VideoAdminView> {
    return this.videos.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateShortVideoDto): Promise<VideoAdminView> {
    return this.videos.update(user, id, dto);
  }

  @Patch(":id/active")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  setActive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SetActiveDto): Promise<VideoAdminView> {
    return this.videos.setActive(user, id, dto.active);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  remove(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<{ id: string }> {
    return this.videos.remove(user, id);
  }
}
