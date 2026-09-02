import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { PERMISSIONS } from "../../../common/rbac";
import { RequirePermissions } from "../../auth/decorators";
import { SMS_TRANSPORT, type SmsTransport } from "../providers/sms-transport";
import { SMS_INBOUND_ADAPTER, type SmsInboundAdapter } from "../providers/sms-inbound-adapter";
import { smsReadiness } from "./sms-config";

/** Safe, secret-free SMS configuration status for the CRM settings/banner UI. */
@Controller("communications/sms")
export class SmsStatusController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(SMS_TRANSPORT) private readonly transport: SmsTransport,
    @Inject(SMS_INBOUND_ADAPTER) private readonly inbound: SmsInboundAdapter,
  ) {}

  @Get("status")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  status() {
    const readiness = smsReadiness(this.config, this.transport);
    // Never expose the Auth Token, API key secret, or any credential value.
    return { ...readiness, inboundAdapter: this.inbound.name, inboundVerifiable: this.inbound.configured };
  }
}
