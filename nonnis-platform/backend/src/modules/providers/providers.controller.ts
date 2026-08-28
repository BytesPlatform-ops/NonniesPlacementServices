import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ProvidersService } from "./providers.service";
import type { ProviderDetailView, ProviderSummaryView } from "./providers.serializer";
import { CreateProviderDto, ListProvidersQueryDto, ProviderStatusDto, UpdateProviderDto } from "./dto/provider.dto";

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
}
