import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { CasesService } from "./cases.service";
import type { CaseDetail, CaseSummary } from "./cases.serializer";
import { CreateCaseDto } from "./dto/create-case.dto";
import { ListCasesQueryDto } from "./dto/list-cases.dto";

@Controller("cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Query() query: ListCasesQueryDto): Promise<PaginatedResult<CaseSummary>> {
    return this.cases.list(query);
  }

  @Get(":id")
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<CaseDetail> {
    return this.cases.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCaseDto): Promise<CaseDetail> {
    return this.cases.create(dto);
  }
}
