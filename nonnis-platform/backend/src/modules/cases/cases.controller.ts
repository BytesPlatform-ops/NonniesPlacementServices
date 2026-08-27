import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { CasesService } from "./cases.service";
import type { CaseDetail, CaseSummary } from "./cases.serializer";
import { CreateCaseDto } from "./dto/create-case.dto";
import { ListCasesQueryDto } from "./dto/list-cases.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { TransitionCaseDto } from "./dto/transition-case.dto";
import { AssignCaseDto } from "./dto/assign-case.dto";

@Controller("cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASES_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListCasesQueryDto): Promise<PaginatedResult<CaseSummary>> {
    return this.cases.list(user, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CASES_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<CaseDetail> {
    return this.cases.findOne(user, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CASES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCaseDto): Promise<CaseDetail> {
    return this.cases.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCaseDto,
  ): Promise<CaseDetail> {
    return this.cases.update(user, id, dto);
  }

  @Post(":id/transition")
  @RequirePermissions(PERMISSIONS.CASES_UPDATE)
  transition(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionCaseDto,
  ): Promise<CaseDetail> {
    return this.cases.transition(user, id, dto);
  }

  @Patch(":id/assignment")
  @RequirePermissions(PERMISSIONS.CASES_ASSIGN)
  assign(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AssignCaseDto,
  ): Promise<CaseDetail> {
    return this.cases.assign(user, id, dto);
  }
}
