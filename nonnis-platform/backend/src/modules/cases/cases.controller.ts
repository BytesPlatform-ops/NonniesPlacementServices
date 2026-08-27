import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { CasesService } from "./cases.service";
import type { CaseDetail, CaseSummary } from "./cases.serializer";
import { CreateCaseDto } from "./dto/create-case.dto";
import { ListCasesQueryDto } from "./dto/list-cases.dto";

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
}
