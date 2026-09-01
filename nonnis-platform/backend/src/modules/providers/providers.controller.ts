import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import type { UploadTicket } from "../content/media.service";
import { ProvidersService } from "./providers.service";
import type { ProviderDetailView, ProviderSummaryView } from "./providers.serializer";
import {
  CreateProviderDto,
  ListProvidersQueryDto,
  ProviderDeleteMediaDto,
  ProviderStatusDto,
  ProviderUploadUrlDto,
  UpdatePublicListingDto,
  UpdateProviderDto,
} from "./dto/provider.dto";

const WRITE = [PERMISSIONS.PROVIDERS_MANAGE, PERMISSIONS.PROVIDERS_MANAGE_OWN] as const;

@Controller("providers")
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListProvidersQueryDto): Promise<PaginatedResult<ProviderSummaryView>> {
    return this.providers.list(user, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ProviderDetailView> {
    return this.providers.findOne(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProviderDto): Promise<ProviderDetailView> {
    return this.providers.create(user, dto);
  }

  @Patch(":id")
  @RequireAnyPermission(...WRITE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<ProviderDetailView> {
    return this.providers.update(user, id, dto);
  }

  // Provider status is Nonnis-controlled only — provider-org users cannot
  // (re)activate/pause their own provider.
  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ProviderStatusDto,
  ): Promise<ProviderDetailView> {
    return this.providers.setStatus(user, id, dto.status);
  }

  @Get(":id/users")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  listUsers(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.providers.listUsers(user, id);
  }

  // ---- Public residential directory listing (Nonnis-only) -------------------

  @Patch(":id/public-listing")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  updatePublicListing(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePublicListingDto,
  ): Promise<ProviderDetailView> {
    return this.providers.updatePublicListing(user, id, dto);
  }

  @Post(":id/public-listing/publish")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  publish(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ProviderDetailView> {
    return this.providers.publish(user, id);
  }

  @Post(":id/public-listing/unpublish")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  unpublish(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ProviderDetailView> {
    return this.providers.unpublish(user, id);
  }

  @Post(":id/public-listing/image-upload-url")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  imageUploadUrl(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ProviderUploadUrlDto,
  ): Promise<UploadTicket> {
    return this.providers.createPublicImageTicket(user, id, dto);
  }

  @Delete(":id/public-listing/image")
  @RequirePermissions(PERMISSIONS.PROVIDERS_MANAGE)
  deleteImage(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ProviderDeleteMediaDto,
  ) {
    return this.providers.deletePublicImage(user, id, dto.storagePath);
  }
}
