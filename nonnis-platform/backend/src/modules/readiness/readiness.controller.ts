import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ReadinessService, type OperationsReadinessSummary } from "./readiness.service";
import type { ReadinessView } from "./readiness.serializer";
import { MarkCompletedDto, MarkDischargedDto, MarkReadyDto, MarkServiceStartedDto } from "./dto/readiness.dto";

@Controller()
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get("cases/:caseId/readiness")
  @RequirePermissions(PERMISSIONS.CASES_READ)
  get(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string): Promise<ReadinessView> {
    return this.readiness.getReadiness(user, caseId);
  }

  @Post("cases/:caseId/mark-ready-for-discharge")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  markReady(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() _dto: MarkReadyDto,
  ): Promise<ReadinessView> {
    return this.readiness.markReadyForDischarge(user, caseId);
  }

  @Post("cases/:caseId/mark-discharged")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  markDischarged(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: MarkDischargedDto,
  ): Promise<ReadinessView> {
    return this.readiness.markDischarged(user, caseId, dto.actualDischargeDate, dto.note);
  }

  @Post("cases/:caseId/mark-service-started")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  markServiceStarted(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: MarkServiceStartedDto,
  ): Promise<ReadinessView> {
    return this.readiness.markServiceStarted(user, caseId, dto.note);
  }

  @Post("cases/:caseId/mark-completed")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  markCompleted(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: MarkCompletedDto,
  ): Promise<ReadinessView> {
    return this.readiness.markCompleted(user, caseId, dto.note);
  }

  @Get("operations/readiness/summary")
  @RequirePermissions(PERMISSIONS.CASES_READ_ALL)
  operationsSummary(): Promise<OperationsReadinessSummary> {
    return this.readiness.operationsSummary();
  }
}
