import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { OrganizationsService } from "./organizations.service";
import type { OrganizationView } from "./organizations.serializer";
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  OrganizationStatusDto,
  UpdateOrganizationDto,
} from "./dto/organization.dto";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_MANAGE)
  list(@Query() query: ListOrganizationsQueryDto): Promise<PaginatedResult<OrganizationView>> {
    return this.organizations.list(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrganizationView> {
    return this.organizations.findOne(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrganizationDto): Promise<OrganizationView> {
    return this.organizations.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_MANAGE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationView> {
    return this.organizations.update(user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_MANAGE)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: OrganizationStatusDto,
  ): Promise<OrganizationView> {
    return this.organizations.setStatus(user, id, dto.status);
  }
}
