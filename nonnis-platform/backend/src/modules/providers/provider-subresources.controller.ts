import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ProviderServicesService } from "./provider-services.service";
import { ProviderCoverageService } from "./provider-coverage.service";
import { ProviderAttributesService } from "./provider-attributes.service";
import { ProviderCapacityService } from "./provider-capacity.service";
import {
  CreateCoverageAreaDto,
  CreateProviderLanguageDto,
  CreateProviderPaymentTypeDto,
  CreateProviderServiceDto,
  SetCapacityDto,
  SetHoursDto,
  UpdateCoverageAreaDto,
  UpdateProviderLanguageDto,
  UpdateProviderPaymentTypeDto,
  UpdateProviderServiceDto,
} from "./dto/provider-subresources.dto";

const WRITE = [PERMISSIONS.PROVIDERS_MANAGE, PERMISSIONS.PROVIDERS_MANAGE_OWN] as const;
const CAPACITY_WRITE = [PERMISSIONS.PROVIDER_CAPACITY_MANAGE, PERMISSIONS.PROVIDER_CAPACITY_MANAGE_OWN] as const;
const uuid = () => new ParseUUIDPipe();

@Controller("providers/:providerId/services")
export class ProviderServicesController {
  constructor(private readonly services: ProviderServicesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  list(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.services.list(user, providerId);
  }

  @Post()
  @RequireAnyPermission(...WRITE)
  create(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: CreateProviderServiceDto,
  ) {
    return this.services.create(user, providerId, dto);
  }

  @Patch(":providerServiceId")
  @RequireAnyPermission(...WRITE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("providerServiceId", uuid()) providerServiceId: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return this.services.update(user, providerId, providerServiceId, dto);
  }

  @Delete(":providerServiceId")
  @RequireAnyPermission(...WRITE)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("providerServiceId", uuid()) providerServiceId: string,
  ) {
    return this.services.remove(user, providerId, providerServiceId);
  }
}

@Controller("providers/:providerId/coverage")
export class ProviderCoverageController {
  constructor(private readonly coverage: ProviderCoverageService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  list(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.coverage.list(user, providerId);
  }

  @Post()
  @RequireAnyPermission(...WRITE)
  create(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: CreateCoverageAreaDto,
  ) {
    return this.coverage.create(user, providerId, dto);
  }

  @Patch(":coverageId")
  @RequireAnyPermission(...WRITE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("coverageId", uuid()) coverageId: string,
    @Body() dto: UpdateCoverageAreaDto,
  ) {
    return this.coverage.update(user, providerId, coverageId, dto);
  }

  @Delete(":coverageId")
  @RequireAnyPermission(...WRITE)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("coverageId", uuid()) coverageId: string,
  ) {
    return this.coverage.remove(user, providerId, coverageId);
  }
}

@Controller("providers/:providerId")
export class ProviderAttributesController {
  constructor(private readonly attributes: ProviderAttributesService) {}

  // Payment types
  @Get("payment-types")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  listPaymentTypes(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.attributes.listPaymentTypes(user, providerId);
  }

  @Post("payment-types")
  @RequireAnyPermission(...WRITE)
  addPaymentType(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: CreateProviderPaymentTypeDto,
  ) {
    return this.attributes.addPaymentType(user, providerId, dto);
  }

  @Patch("payment-types/:id")
  @RequireAnyPermission(...WRITE)
  updatePaymentType(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("id", uuid()) id: string,
    @Body() dto: UpdateProviderPaymentTypeDto,
  ) {
    return this.attributes.updatePaymentType(user, providerId, id, dto);
  }

  @Delete("payment-types/:id")
  @RequireAnyPermission(...WRITE)
  removePaymentType(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("id", uuid()) id: string,
  ) {
    return this.attributes.removePaymentType(user, providerId, id);
  }

  // Languages
  @Get("languages")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  listLanguages(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.attributes.listLanguages(user, providerId);
  }

  @Post("languages")
  @RequireAnyPermission(...WRITE)
  addLanguage(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: CreateProviderLanguageDto,
  ) {
    return this.attributes.addLanguage(user, providerId, dto);
  }

  @Patch("languages/:id")
  @RequireAnyPermission(...WRITE)
  setLanguageActive(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("id", uuid()) id: string,
    @Body() dto: UpdateProviderLanguageDto,
  ) {
    return this.attributes.setLanguageActive(user, providerId, id, dto);
  }

  @Delete("languages/:id")
  @RequireAnyPermission(...WRITE)
  removeLanguage(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("id", uuid()) id: string,
  ) {
    return this.attributes.removeLanguage(user, providerId, id);
  }

  // Hours
  @Get("hours")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  listHours(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.attributes.listHours(user, providerId);
  }

  @Put("hours")
  @RequireAnyPermission(...WRITE)
  setHours(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: SetHoursDto,
  ) {
    return this.attributes.setHours(user, providerId, dto);
  }
}

@Controller("providers/:providerId/capacity")
export class ProviderCapacityController {
  constructor(private readonly capacity: ProviderCapacityService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  list(@CurrentUser() user: RequestUser, @Param("providerId", uuid()) providerId: string) {
    return this.capacity.list(user, providerId);
  }

  @Put()
  @RequireAnyPermission(...CAPACITY_WRITE)
  set(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Body() dto: SetCapacityDto,
  ) {
    return this.capacity.set(user, providerId, dto);
  }

  @Delete(":capacityId")
  @RequireAnyPermission(...CAPACITY_WRITE)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("providerId", uuid()) providerId: string,
    @Param("capacityId", uuid()) capacityId: string,
  ) {
    return this.capacity.remove(user, providerId, capacityId);
  }
}
