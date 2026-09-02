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
import { SmsTemplatesController } from "./sms/sms-templates.controller";
import { SmsTemplateService } from "./sms/sms-template.service";
import { SmsCampaignsController } from "./sms/sms-campaigns.controller";
import { SmsCampaignService } from "./sms/sms-campaign.service";
import { SmsDispatcherService } from "./sms/sms-dispatcher.service";
import { SmsConversationService } from "./sms/sms-conversation.service";
import { SmsStatusService } from "./sms/sms-status.service";
import { InboundSmsService } from "./sms/inbound-sms.service";
import { SmsWebhookController } from "./sms/sms-webhook.controller";
import { SmsStatusController } from "./sms/sms-status.controller";

/**
 * Communications module. Phase 15A: contacts, lists, tags, consent, suppression,
 * imports, transport ports. Phase 15B: email templates + visual builder, campaigns,
 * recipient snapshots, a Postgres-backed delivery dispatcher, mock + Brevo email
 * transports, delivery-event webhook, and public unsubscribe. Phase 15C: the shared
 * Communications Inbox, inbound email adapters, threading, replies and attachments.
 * Phase 15D: SMS templates + segment calculator, SMS campaigns, the SMS dispatcher,
 * mock + Twilio transports, two-way SMS with signature-verified webhooks, and
 * STOP/START/HELP opt-out synchronization.
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
    SmsTemplatesController,
    SmsCampaignsController,
    SmsWebhookController,
    SmsStatusController,
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
    SmsTemplateService,
    SmsCampaignService,
    SmsDispatcherService,
    SmsConversationService,
    SmsStatusService,
    InboundSmsService,
    ...transportProviders,
  ],
})
export class CommunicationsModule {}
