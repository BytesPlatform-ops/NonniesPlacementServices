import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditModule } from "../audit/audit.module";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";
import type { AppConfig } from "../../config/configuration";
import { ReferralsController } from "./referrals.controller";
import { ProviderReferralsController } from "./provider-referrals.controller";
import { ReferralsService } from "./referrals.service";
import { ReferralAccessService } from "./referral-access";
import { MAIL_TRANSPORT, ReferralMailService, createDefaultMailTransport, type MailTransport } from "./referral-mail.service";

@Module({
  imports: [WorkflowEventsModule, AuditModule],
  controllers: [ReferralsController, ProviderReferralsController],
  providers: [
    ReferralsService,
    ReferralAccessService,
    ReferralMailService,
    {
      provide: MAIL_TRANSPORT,
      useFactory: (config: ConfigService<AppConfig, true>): MailTransport => createDefaultMailTransport(config),
      inject: [ConfigService],
    },
  ],
})
export class ReferralsModule {}
