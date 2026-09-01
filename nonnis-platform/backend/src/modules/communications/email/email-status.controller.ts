import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { PERMISSIONS } from "../../../common/rbac";
import { RequirePermissions } from "../../auth/decorators";
import { EMAIL_TRANSPORT, type EmailTransport } from "../providers/email-transport";
import { emailProviderStatus } from "./email-config";
import { EmailDispatcherService } from "./email-dispatcher.service";

@Controller("communications/email")
export class EmailStatusController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly dispatcher: EmailDispatcherService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  @Get("status")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  async status() {
    return { provider: emailProviderStatus(this.config, this.transport.configured), dispatch: await this.dispatcher.dispatchStatus() };
  }
}
