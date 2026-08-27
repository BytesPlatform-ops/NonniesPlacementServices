import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { ServiceRequestsService } from "./service-requests.service";
import type { ServiceRequestView } from "../cases.serializer";
import { CreateServiceRequestDto, UpdateServiceRequestDto } from "./service-requests.dto";

@Controller("cases/:caseId/service-requests")
export class ServiceRequestsController {
  constructor(private readonly serviceRequests: ServiceRequestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASES_READ)
  list(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string): Promise<ServiceRequestView[]> {
    return this.serviceRequests.list(user, caseId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestView> {
    return this.serviceRequests.create(user, caseId, dto);
  }

  @Patch(":serviceRequestId")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() dto: UpdateServiceRequestDto,
  ): Promise<ServiceRequestView> {
    return this.serviceRequests.update(user, caseId, serviceRequestId, dto);
  }

  @Delete(":serviceRequestId")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  cancel(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
  ): Promise<ServiceRequestView> {
    return this.serviceRequests.cancel(user, caseId, serviceRequestId);
  }
}
