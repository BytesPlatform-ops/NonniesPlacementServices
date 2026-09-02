import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { DeliveryOperationsService } from "./delivery-operations.service";
import { CommunicationsStatusService } from "./communications-status.service";
import { ListDeliveryFailuresDto, RetryDeliveryDto } from "../dto/operations.dto";

/**
 * Communications operations: actionable delivery failures, provider configuration
 * status, and operational health counts. Every response is secret-free.
 */
@Controller("communications")
export class CommunicationsOperationsController {
  constructor(
    private readonly delivery: DeliveryOperationsService,
    private readonly status: CommunicationsStatusService,
  ) {}

  @Get("delivery")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  listFailures(@Query() query: ListDeliveryFailuresDto) {
    return this.delivery.list({ channel: query.channel, source: query.source, status: query.status, page: query.page, pageSize: query.pageSize });
  }

  /** Re-queue a failed delivery. Requires send permission; ambiguous sends need confirmation. */
  @Post("delivery/:id/retry")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_SEND)
  retry(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: RetryDeliveryDto) {
    return this.delivery.retry(user, dto.source, id, dto.acknowledgeDuplicateRisk === true);
  }

  /** Provider configuration + live-readiness. Never returns a credential value. */
  @Get("configuration")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  configuration() {
    return this.status.configuration();
  }

  /** Operational queue health. Administrative, so it needs manage permission. */
  @Get("health")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  health() {
    return this.status.health();
  }
}
