import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "../providers/email-transport";
import { INBOUND_EMAIL_ADAPTER, type EmailInboundAdapter } from "../providers/email-inbound-adapter";
import { SMS_TRANSPORT, type SmsTransport } from "../providers/sms-transport";
import { SMS_INBOUND_ADAPTER, type SmsInboundAdapter } from "../providers/sms-inbound-adapter";
import { emailProviderStatus } from "../email/email-config";
import { inboundWebhookUrl, smsReadiness, statusCallbackUrl } from "../sms/sms-config";

export type Readiness = "MOCK" | "LIVE_READY" | "INCOMPLETE";

export interface ChannelConfiguration {
  provider: string;
  mockMode: boolean;
  readiness: Readiness;
  /** Human-readable list of what is still missing for live operation. */
  missing: string[];
  /** Display-safe values only — never a credential. */
  details: Record<string, string | boolean | null>;
}

export interface CommunicationsConfiguration {
  email: ChannelConfiguration;
  sms: ChannelConfiguration;
}

export interface CommunicationsHealth {
  email: { provider: string; dispatcherEnabled: boolean; queued: number; processing: number; staleClaims: number; failed: number; deliveryUnknown: number };
  sms: { provider: string; dispatcherEnabled: boolean; queued: number; processing: number; staleClaims: number; failed: number; deliveryUnknown: number };
  replies: { queued: number; processing: number; staleClaims: number; failed: number; deliveryUnknown: number };
  inboundReviewPending: number;
}

/**
 * Safe, secret-free configuration + operational health for Communications.
 *
 * Readiness is derived purely from CONFIGURATION — no provider API is ever called,
 * and no probe message is ever sent, so asking for status can never cost money or
 * touch a real recipient. No response field ever contains an API key, auth token,
 * webhook secret, or storage credential.
 */
@Injectable()
export class CommunicationsStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(EMAIL_TRANSPORT) private readonly emailTransport: EmailTransport,
    @Inject(INBOUND_EMAIL_ADAPTER) private readonly emailInbound: EmailInboundAdapter,
    @Inject(SMS_TRANSPORT) private readonly smsTransport: SmsTransport,
    @Inject(SMS_INBOUND_ADAPTER) private readonly smsInbound: SmsInboundAdapter,
  ) {}

  configuration(): CommunicationsConfiguration {
    return { email: this.emailConfiguration(), sms: this.smsConfiguration() };
  }

  private emailConfiguration(): ChannelConfiguration {
    const status = emailProviderStatus(this.config, this.emailTransport.configured);
    const inboundDomain = this.config.get("communicationsInboundEmailDomain", { infer: true });
    const inboundSecret = !!this.config.get("communicationsInboundEmailSecret", { infer: true });
    const deliveryWebhookSecret = !!this.config.get("communicationsWebhookSecret", { infer: true });
    const mockMode = status.mockMode;

    const missing: string[] = [];
    if (!mockMode) {
      if (!this.config.get("brevoApiKey", { infer: true })) missing.push("BREVO_API_KEY");
      if (!this.config.get("brevoSenderEmail", { infer: true })) missing.push("BREVO_SENDER_EMAIL");
      if (!deliveryWebhookSecret) missing.push("COMMUNICATIONS_WEBHOOK_SECRET (delivery events)");
      if (this.config.get("communicationsInboundEmailProvider", { infer: true }) !== "brevo") missing.push("COMMUNICATIONS_INBOUND_EMAIL_PROVIDER=brevo (inbound replies)");
      else {
        if (!inboundSecret) missing.push("COMMUNICATIONS_INBOUND_EMAIL_SECRET");
        if (inboundDomain.endsWith(".mock.local")) missing.push("COMMUNICATIONS_INBOUND_EMAIL_DOMAIN (a real reply subdomain)");
      }
    }

    return {
      provider: status.provider,
      mockMode,
      readiness: mockMode ? "MOCK" : missing.length ? "INCOMPLETE" : "LIVE_READY",
      missing,
      details: {
        outboundSending: this.emailTransport.configured,
        senderEmail: status.senderEmail,
        senderName: status.senderName,
        inboundProvider: this.emailInbound.name,
        inboundReplies: this.emailInbound.configured,
        inboundDomain,
        inboundWebhookSecretConfigured: inboundSecret,
        deliveryWebhookSecretConfigured: deliveryWebhookSecret,
      },
    };
  }

  private smsConfiguration(): ChannelConfiguration {
    const readiness = smsReadiness(this.config, this.smsTransport);
    const missing: string[] = [];
    if (!readiness.mockMode) {
      if (!readiness.configured) missing.push(readiness.configurationError ?? "Twilio credentials");
      if (!readiness.messagingServiceConfigured && !readiness.sendingNumber) missing.push("TWILIO_MESSAGING_SERVICE_SID (or TWILIO_PHONE_NUMBER)");
      if (!readiness.a2pApproved) missing.push("TWILIO_A2P_APPROVED=true (operator acknowledgement)");
      if (!readiness.webhooksConfigured) missing.push("COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL + TWILIO_AUTH_TOKEN (inbound + status callbacks)");
    }

    return {
      provider: readiness.provider,
      mockMode: readiness.mockMode,
      readiness: readiness.mockMode ? "MOCK" : missing.length ? "INCOMPLETE" : "LIVE_READY",
      missing,
      details: {
        outboundSending: readiness.configured,
        messagingService: readiness.messagingServiceConfigured,
        sendingNumber: readiness.sendingNumber,
        a2pAcknowledged: readiness.a2pApproved,
        inboundAdapter: this.smsInbound.name,
        inboundWebhook: inboundWebhookUrl(this.config) ? true : false,
        statusCallback: statusCallbackUrl(this.config) ? true : false,
        campaignSendingAllowed: readiness.campaignSendingAllowed,
        directReplyAllowed: readiness.directReplyAllowed,
      },
    };
  }

  /** Current operational counts only — no trends, rates, or provider comparisons. */
  async health(): Promise<CommunicationsHealth> {
    const now = new Date();
    const [
      emailQueued, emailProcessing, emailStale, emailFailed, emailUnknown,
      smsQueued, smsProcessing, smsStale, smsFailed, smsUnknown,
      replyQueued, replyProcessing, replyStale, replyFailed, replyUnknown,
      reviewPending,
    ] = await this.prisma.$transaction([
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "QUEUED" } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "PROCESSING" } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "PROCESSING", leaseExpiresAt: { lt: now } } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: { in: ["FAILED", "BOUNCED"] } } }),
      this.prisma.communicationEmailCampaignRecipient.count({ where: { deliveryStatus: "DELIVERY_UNKNOWN" } }),
      this.prisma.communicationSmsCampaignRecipient.count({ where: { deliveryStatus: "QUEUED" } }),
      this.prisma.communicationSmsCampaignRecipient.count({ where: { deliveryStatus: "PROCESSING" } }),
      this.prisma.communicationSmsCampaignRecipient.count({ where: { deliveryStatus: "PROCESSING", leaseExpiresAt: { lt: now } } }),
      this.prisma.communicationSmsCampaignRecipient.count({ where: { deliveryStatus: { in: ["FAILED", "UNDELIVERED"] } } }),
      this.prisma.communicationSmsCampaignRecipient.count({ where: { deliveryStatus: "DELIVERY_UNKNOWN" } }),
      this.prisma.communicationMessage.count({ where: { direction: "OUTBOUND", status: "QUEUED" } }),
      this.prisma.communicationMessage.count({ where: { direction: "OUTBOUND", status: "PROCESSING" } }),
      this.prisma.communicationMessage.count({ where: { direction: "OUTBOUND", status: "PROCESSING", leaseExpiresAt: { lt: now } } }),
      this.prisma.communicationMessage.count({ where: { direction: "OUTBOUND", status: { in: ["FAILED", "BOUNCED", "UNDELIVERED"] } } }),
      this.prisma.communicationMessage.count({ where: { direction: "OUTBOUND", status: "DELIVERY_UNKNOWN" } }),
      this.prisma.communicationInboundEmailReview.count({ where: { status: "PENDING" } }),
    ]);

    return {
      email: {
        provider: this.emailTransport.name,
        dispatcherEnabled: this.config.get("emailDispatchEnabled", { infer: true }),
        queued: emailQueued, processing: emailProcessing, staleClaims: emailStale, failed: emailFailed, deliveryUnknown: emailUnknown,
      },
      sms: {
        provider: this.smsTransport.name,
        dispatcherEnabled: this.config.get("smsDispatchEnabled", { infer: true }),
        queued: smsQueued, processing: smsProcessing, staleClaims: smsStale, failed: smsFailed, deliveryUnknown: smsUnknown,
      },
      replies: { queued: replyQueued, processing: replyProcessing, staleClaims: replyStale, failed: replyFailed, deliveryUnknown: replyUnknown },
      inboundReviewPending: reviewPending,
    };
  }
}
