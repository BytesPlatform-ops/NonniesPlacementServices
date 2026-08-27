import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { RequirementsService } from "./requirements.service";
import type { CaseRequirementView } from "../cases.serializer";
import { CreateRequirementDto, UpdateRequirementDto } from "./requirements.dto";

@Controller("cases/:caseId/requirements")
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASES_READ)
  list(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string): Promise<CaseRequirementView[]> {
    return this.requirements.list(user, caseId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() dto: CreateRequirementDto,
  ): Promise<CaseRequirementView> {
    return this.requirements.create(user, caseId, dto);
  }

  @Patch(":requirementId")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Param("requirementId", new ParseUUIDPipe()) requirementId: string,
    @Body() dto: UpdateRequirementDto,
  ): Promise<CaseRequirementView> {
    return this.requirements.update(user, caseId, requirementId, dto);
  }
}
