import { Global, Module } from "@nestjs/common";
import { NotificationAudienceService } from "./notification-audience.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Notifications.
 *
 * Global because almost every domain module raises them: making each one
 * import this would add the same line everywhere and invite import cycles,
 * for a service that holds no request state. It follows AuthModule, which is
 * global for the same reason.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationAudienceService],
  exports: [NotificationsService, NotificationAudienceService],
})
export class NotificationsModule {}
