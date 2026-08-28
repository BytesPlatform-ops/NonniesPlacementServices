import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { TimelineService, type TimelineFilter, type TimelineItem } from "./timeline.service";

export class ListTimelineDto {
  @IsOptional()
  @IsIn(["all", "case", "tasks", "messages", "referrals"])
  filter?: TimelineFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 30;
}

@Controller("cases/:caseId/timeline")
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CASES_READ)
  build(@CurrentUser() user: RequestUser, @Param("caseId", new ParseUUIDPipe()) caseId: string, @Query() query: ListTimelineDto): Promise<PaginatedResult<TimelineItem>> {
    return this.timeline.build(user, caseId, query.filter ?? "all", query.page, query.pageSize);
  }
}
