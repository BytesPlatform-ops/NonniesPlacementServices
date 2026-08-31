import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { BlogService } from "./blog.service";
import type { BlogAdminDetail, BlogAdminSummary } from "./content.serializer";
import { CreateBlogPostDto, ListBlogPostsDto, UpdateBlogPostDto } from "./dto/blog.dto";

@Controller("blog-posts")
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  list(@Query() query: ListBlogPostsDto): Promise<PaginatedResult<BlogAdminSummary>> {
    return this.blog.adminList(query);
  }

  @Get(":id")
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<BlogAdminDetail> {
    return this.blog.adminFindOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBlogPostDto): Promise<BlogAdminDetail> {
    return this.blog.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateBlogPostDto): Promise<BlogAdminDetail> {
    return this.blog.update(user, id, dto);
  }

  @Post(":id/publish")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  publish(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<BlogAdminDetail> {
    return this.blog.setStatus(user, id, "PUBLISHED");
  }

  @Post(":id/unpublish")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  unpublish(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<BlogAdminDetail> {
    return this.blog.setStatus(user, id, "DRAFT");
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  archive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<BlogAdminDetail> {
    return this.blog.setStatus(user, id, "ARCHIVED");
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  remove(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<{ id: string }> {
    return this.blog.remove(user, id);
  }
}
