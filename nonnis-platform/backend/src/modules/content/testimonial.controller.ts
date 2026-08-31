import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { TestimonialService } from "./testimonial.service";
import type { TestimonialAdminView } from "./content.serializer";
import { CreateTestimonialDto, ListTestimonialsDto, UpdateTestimonialDto } from "./dto/testimonial.dto";
import { SetActiveDto } from "./dto/content-common.dto";

@Controller("testimonials")
export class TestimonialController {
  constructor(private readonly testimonials: TestimonialService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  list(@Query() query: ListTestimonialsDto): Promise<PaginatedResult<TestimonialAdminView>> {
    return this.testimonials.adminList(query);
  }

  @Get(":id")
  @RequireAnyPermission(PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<TestimonialAdminView> {
    return this.testimonials.adminFindOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTestimonialDto): Promise<TestimonialAdminView> {
    return this.testimonials.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateTestimonialDto): Promise<TestimonialAdminView> {
    return this.testimonials.update(user, id, dto);
  }

  @Patch(":id/active")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  setActive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SetActiveDto): Promise<TestimonialAdminView> {
    return this.testimonials.setActive(user, id, dto.active);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  remove(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<{ id: string }> {
    return this.testimonials.remove(user, id);
  }
}
