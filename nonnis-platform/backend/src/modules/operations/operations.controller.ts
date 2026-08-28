import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import type { ProviderSummaryView } from "../providers/providers.serializer";
import { ListProvidersQueryDto } from "../providers/dto/provider.dto";
import { OperationsService, type OperationsSummary } from "./operations.service";
import { ListOperationsCasesDto } from "./dto/operations.dto";
import type { AssigneeView, OperationsCaseSummary } from "./operations.serializer";

/**
 * Platform-level operations control center. Every route requires cases.read_all,
 * which only Nonnis roles (NONNIS_ADMIN, NONNIS_OPERATIONS) hold — discharge
 * professionals and provider users are excluded.
 */
@Controller("operations")
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.CASES_READ_ALL)
  summary(): Promise<OperationsSummary> {
    return this.operations.summary();
  }

  @Get("cases")
  @RequirePermissions(PERMISSIONS.CASES_READ_ALL)
  cases(@Query() query: ListOperationsCasesDto): Promise<PaginatedResult<OperationsCaseSummary>> {
    return this.operations.cases(query);
  }

  @Get("cases/:id/assignees")
  @RequirePermissions(PERMISSIONS.CASES_READ_ALL)
  assignees(@Param("id", new ParseUUIDPipe()) id: string): Promise<AssigneeView[]> {
    return this.operations.assignees(id);
  }

  @Get("providers")
  @RequirePermissions(PERMISSIONS.CASES_READ_ALL)
  providers(
    @CurrentUser() user: RequestUser,
    @Query() query: ListProvidersQueryDto,
  ): Promise<PaginatedResult<ProviderSummaryView>> {
    return this.operations.providersList(user, query);
  }
}
