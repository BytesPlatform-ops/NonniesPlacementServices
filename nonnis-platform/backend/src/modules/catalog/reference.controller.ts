import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ReferenceService } from "./reference.service";
import type { ReferenceItemView } from "./catalog.serializer";
import {
  CatalogStatusDto,
  CreateReferenceItemDto,
  ListCatalogQueryDto,
  UpdateReferenceItemDto,
} from "./dto/catalog.dto";

const READ = [PERMISSIONS.SERVICE_CATEGORIES_READ, PERMISSIONS.SERVICE_CATEGORIES_MANAGE, PERMISSIONS.PROVIDERS_READ] as const;

@Controller()
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  // ---- Payment types ----

  @Get("payment-types")
  @RequireAnyPermission(...READ)
  listPaymentTypes(@Query() query: ListCatalogQueryDto): Promise<PaginatedResult<ReferenceItemView>> {
    return this.reference.list("paymentType", query);
  }

  @Post("payment-types")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  createPaymentType(@CurrentUser() user: RequestUser, @Body() dto: CreateReferenceItemDto): Promise<ReferenceItemView> {
    return this.reference.create("paymentType", user, dto);
  }

  @Patch("payment-types/:id")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  updatePaymentType(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReferenceItemDto,
  ): Promise<ReferenceItemView> {
    return this.reference.update("paymentType", user, id, dto);
  }

  @Patch("payment-types/:id/status")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  setPaymentTypeStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CatalogStatusDto,
  ): Promise<ReferenceItemView> {
    return this.reference.setStatus("paymentType", user, id, dto);
  }

  // ---- Languages ----

  @Get("languages")
  @RequireAnyPermission(...READ)
  listLanguages(@Query() query: ListCatalogQueryDto): Promise<PaginatedResult<ReferenceItemView>> {
    return this.reference.list("language", query);
  }

  @Post("languages")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  createLanguage(@CurrentUser() user: RequestUser, @Body() dto: CreateReferenceItemDto): Promise<ReferenceItemView> {
    return this.reference.create("language", user, dto);
  }

  @Patch("languages/:id")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  updateLanguage(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReferenceItemDto,
  ): Promise<ReferenceItemView> {
    return this.reference.update("language", user, id, dto);
  }

  @Patch("languages/:id/status")
  @RequirePermissions(PERMISSIONS.SERVICE_CATEGORIES_MANAGE)
  setLanguageStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CatalogStatusDto,
  ): Promise<ReferenceItemView> {
    return this.reference.setStatus("language", user, id, dto);
  }
}
