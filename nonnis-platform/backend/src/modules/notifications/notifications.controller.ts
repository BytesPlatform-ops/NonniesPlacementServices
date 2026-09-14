import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import type { PaginatedResult } from "../../common/types/api-response";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { NotificationsService } from "./notifications.service";
import type { NotificationView } from "./notifications.serializer";
import { ListNotificationsQueryDto, SetReadDto } from "./dto/notifications.dto";

/**
 * A person's own notification feed.
 *
 * There is deliberately no create endpoint: notifications are raised by
 * business events server-side, so no client can address one at another user.
 * Every read and write below is scoped to `@CurrentUser` inside the service.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResult<NotificationView>> {
    return this.notifications.list(user, query);
  }

  @Get("unread-count")
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  unreadCount(@CurrentUser() user: RequestUser): Promise<{ count: number }> {
    return this.notifications.unreadCount(user);
  }

  @Patch(":id/read")
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  setRead(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: SetReadDto,
  ): Promise<NotificationView> {
    return this.notifications.setRead(user, id, dto.read ?? true);
  }

  @Post("mark-all-read")
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: RequestUser): Promise<{ count: number }> {
    return this.notifications.markAllRead(user);
  }
}
