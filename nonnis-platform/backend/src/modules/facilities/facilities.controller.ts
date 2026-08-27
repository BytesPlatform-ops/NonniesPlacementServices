import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { FacilitiesService } from "./facilities.service";
import type { FacilityView } from "./facilities.serializer";
import {
  CreateFacilityDto,
  FacilityStatusDto,
  ListFacilitiesQueryDto,
  UpdateFacilityDto,
} from "./dto/facility.dto";

@Controller("facilities")
export class FacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FACILITIES_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListFacilitiesQueryDto): Promise<PaginatedResult<FacilityView>> {
    return this.facilities.list(user, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.FACILITIES_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<FacilityView> {
    return this.facilities.findOne(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FACILITIES_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFacilityDto): Promise<FacilityView> {
    return this.facilities.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.FACILITIES_MANAGE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFacilityDto,
  ): Promise<FacilityView> {
    return this.facilities.update(user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.FACILITIES_MANAGE)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: FacilityStatusDto,
  ): Promise<FacilityView> {
    return this.facilities.setStatus(user, id, dto.status);
  }
}
