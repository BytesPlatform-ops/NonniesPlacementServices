import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { PERMISSIONS } from "../../../common/rbac";
import { RequirePermissions } from "../../auth/decorators";
import { EMAIL_TRANSPORT, type EmailTransport } from "../providers/email-transport";
import { INBOUND_EMAIL_ADAPTER, type EmailInboundAdapter } from "../providers/email-inbound-adapter";
import { emailProviderStatus } from "./email-config";
import { EmailDispatcherService } from "./email-dispatcher.service";

@Controller("communications/email")
export class EmailStatusController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly dispatcher: EmailDispatcherService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    @Inject(INBOUND_EMAIL_ADAPTER) private readonly inbound: EmailInboundAdapter,
  ) {}

  @Get("status")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  async status() {
    const provider = this.config.get("communicationsEmailProvider", { infer: true });
    // Inbound is "configured" only when the adapter is ready AND, for a live email
    // provider, the inbound domain is a real one (not the mock placeholder).
    const inboundProvider = this.config.get("communicationsInboundEmailProvider", { infer: true });
    const inboundConfigured = this.inbound.configured && !(provider === "brevo" && this.config.get("communicationsInboundEmailDomain", { infer: true }).endsWith(".mock.local"));
    return {
      provider: emailProviderStatus(this.config, this.transport.configured),
      inbound: {
        provider: inboundProvider,
        mockMode: this.inbound.name === "mock",
        configured: inboundConfigured,
        // Warn when sending is live but replies are not yet wired.
        sendingLiveButInboundMissing: provider === "brevo" && !inboundConfigured,
      },
      dispatch: await this.dispatcher.dispatchStatus(),
    };
  }
}
