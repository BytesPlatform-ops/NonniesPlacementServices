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
import { ConversationsController } from "./email/conversations.controller";
import { ConversationService } from "./email/conversation.service";
import { InboundReviewController } from "./email/inbound-review.controller";
import { InboundReviewService } from "./email/inbound-review.service";
import { InboundEmailService } from "./email/inbound-email.service";
import { EmailInboundWebhookController } from "./email/email-inbound-webhook.controller";
import { AttachmentStorageService } from "./email/attachment-storage.service";

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
    ConversationsController,
    InboundReviewController,
    EmailInboundWebhookController,
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
    ConversationService,
    InboundReviewService,
    InboundEmailService,
    AttachmentStorageService,
    ...transportProviders,
  ],
})
export class CommunicationsModule {}
