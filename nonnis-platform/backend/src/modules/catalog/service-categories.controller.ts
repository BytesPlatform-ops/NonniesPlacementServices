import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ServiceCategoriesService } from "./service-categories.service";
import type { ServiceCategoryView } from "./catalog.serializer";
import {
  CatalogStatusDto,
  CreateServiceCategoryDto,
  ListCatalogQueryDto,
  UpdateServiceCategoryDto,
} from "./dto/catalog.dto";

@Controller("service-categories")
export class ServiceCategoriesController {
  constructor(private readonly categories: ServiceCategoriesService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.SERVICE_CATEGORIES_READ, PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  list(@Query() query: ListCatalogQueryDto): Promise<PaginatedResult<ServiceCategoryView>> {
    return this.categories.list(query);
  }

  @Get(":id")
  @RequireAnyPermission(PERMISSIONS.SERVICE_CATEGORIES_READ, PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<ServiceCategoryView> {
    return this.categories.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateServiceCategoryDto): Promise<ServiceCategoryView> {
    return this.categories.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ): Promise<ServiceCategoryView> {
    return this.categories.update(user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CatalogStatusDto,
  ): Promise<ServiceCategoryView> {
    return this.categories.setStatus(user, id, dto);
  }
}
