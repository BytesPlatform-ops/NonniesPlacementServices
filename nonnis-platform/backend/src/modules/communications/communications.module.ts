import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContactsController } from "./contacts/contacts.controller";
import { ContactsService } from "./contacts/contacts.service";
import { ListsController } from "./lists/lists.controller";
import { ListsService } from "./lists/lists.service";
import { TagsController } from "./tags/tags.controller";
import { TagsService } from "./tags/tags.service";
import { SuppressionsController } from "./suppressions/suppressions.controller";
import { SuppressionsService } from "./suppressions/suppressions.service";
import { ImportsController } from "./imports/imports.controller";
import { ImportsService } from "./imports/imports.service";
import { transportProviders } from "./providers/transport.providers";
import { EmailTemplatesController } from "./email/email-templates.controller";
import { EmailTemplateService } from "./email/email-template.service";
import { EmailCampaignsController } from "./email/email-campaigns.controller";
import { EmailCampaignService } from "./email/email-campaign.service";
import { CampaignAudienceService } from "./email/campaign-audience.service";
import { EmailDispatcherService } from "./email/email-dispatcher.service";
import { EmailEventsService } from "./email/email-events.service";
import { EmailWebhookController } from "./email/email-webhook.controller";
import { EmailStatusController } from "./email/email-status.controller";
import { UnsubscribeController } from "./email/unsubscribe.controller";
import { UnsubscribeService } from "./email/unsubscribe.service";

/**
 * Communications module. Phase 15A: contacts, lists, tags, consent, suppression,
 * imports, transport ports. Phase 15B: email templates + visual builder, campaigns,
 * recipient snapshots, a Postgres-backed delivery dispatcher, mock + Brevo email
 * transports, delivery-event webhook, and public unsubscribe. Still no inbox/inbound
 * (15C) or SMS (15D).
 */
@Module({
  imports: [AuditModule],
  controllers: [
    ContactsController,
    ListsController,
    TagsController,
    SuppressionsController,
    ImportsController,
    EmailTemplatesController,
    EmailCampaignsController,
    EmailWebhookController,
    EmailStatusController,
    UnsubscribeController,
  ],
  providers: [
    ContactsService,
    ListsService,
    TagsService,
    SuppressionsService,
    ImportsService,
    EmailTemplateService,
    EmailCampaignService,
    CampaignAudienceService,
    EmailDispatcherService,
    EmailEventsService,
    UnsubscribeService,
    ...transportProviders,
  ],
})
export class CommunicationsModule {}
