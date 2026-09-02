import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import type { SmsTransport } from "../providers/sms-transport";

/**
 * Central SMS readiness policy. Every gate lives here so campaign/conversation
 * services never inspect provider names or credentials themselves.
 *
 * The A2P flag is an explicit OPERATOR ACKNOWLEDGEMENT that US 10DLC/carrier
 * registration is complete. It is NOT verified against Twilio — the CRM cannot
 * know registration state, so a human must assert it before live bulk sending.
 */

export const SMS_STATUS_CALLBACK_PATH = "/api/v1/webhooks/communications/sms/status";
export const SMS_INBOUND_WEBHOOK_PATH = "/api/v1/webhooks/communications/sms/inbound";

export interface SmsReadiness {
  provider: string;
  mockMode: boolean;
  /** Transport has the credentials/sender it needs. */
  configured: boolean;
  /** Safe, secret-free explanation when not configured. */
  configurationError: string | null;
  messagingServiceConfigured: boolean;
  /** Display-safe sending identity (a phone number is not a secret). */
  sendingNumber: string | null;
  a2pApproved: boolean;
  webhooksConfigured: boolean;
  /** Bulk marketing campaigns may be queued for live sending. */
  campaignSendingAllowed: boolean;
  /** Why bulk campaign sending is blocked (null when allowed). */
  campaignBlockedReason: string | null;
  /** 1:1 conversational replies may be sent. */
  directReplyAllowed: boolean;
  directReplyBlockedReason: string | null;
}

function webhookBase(config: ConfigService<AppConfig, true>): string | undefined {
  return config.get("communicationsTwilioWebhookBaseUrl", { infer: true });
}

/** Public status callback URL, or undefined when no public base URL is configured. */
export function statusCallbackUrl(config: ConfigService<AppConfig, true>): string | undefined {
  const base = webhookBase(config);
  return base ? `${base}${SMS_STATUS_CALLBACK_PATH}` : undefined;
}

/** The exact externally-requested URL Twilio signs — must match end to end. */
export function inboundWebhookUrl(config: ConfigService<AppConfig, true>): string | undefined {
  const base = webhookBase(config);
  return base ? `${base}${SMS_INBOUND_WEBHOOK_PATH}` : undefined;
}

export function smsReadiness(config: ConfigService<AppConfig, true>, transport: SmsTransport): SmsReadiness {
  const provider = config.get("communicationsSmsProvider", { infer: true });
  const mockMode = provider === "mock";
  const messagingServiceConfigured = !!config.get("twilioMessagingServiceSid", { infer: true });
  const sendingNumber = config.get("twilioPhoneNumber", { infer: true }) ?? null;
  const a2pApproved = config.get("twilioA2pApproved", { infer: true });
  // Signature validation needs the Account Auth Token; callbacks need a public URL.
  const webhooksConfigured = !!webhookBase(config) && !!config.get("twilioAuthToken", { infer: true });

  let campaignBlockedReason: string | null = null;
  if (!mockMode) {
    if (!transport.configured) campaignBlockedReason = transport.configurationError ?? "SMS provider is not fully configured.";
    else if (!messagingServiceConfigured && !sendingNumber) campaignBlockedReason = "No Messaging Service or sending number is configured.";
    else if (!a2pApproved) campaignBlockedReason = "A2P 10DLC registration has not been marked complete by an operator (set TWILIO_A2P_APPROVED=true once registration is approved).";
  }

  // Conversational 1:1 replies are not gated on the A2P campaign flag — only on the
  // provider being usable. STOP / suppression still block every outgoing message.
  let directReplyBlockedReason: string | null = null;
  if (!mockMode && !transport.configured) directReplyBlockedReason = transport.configurationError ?? "SMS provider is not fully configured.";

  return {
    provider,
    mockMode,
    configured: transport.configured,
    configurationError: transport.configurationError,
    messagingServiceConfigured,
    sendingNumber,
    a2pApproved,
    webhooksConfigured,
    campaignSendingAllowed: campaignBlockedReason === null,
    campaignBlockedReason,
    directReplyAllowed: directReplyBlockedReason === null,
    directReplyBlockedReason,
  };
}
