import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateRequest } from "twilio";
import type { AppConfig } from "../../../config/configuration";
import type { InboundOptOutType, NormalizedInboundSms, NormalizedSmsStatusCallback, SmsInboundAdapter } from "./sms-inbound-adapter";

const OPT_OUT_TYPES: InboundOptOutType[] = ["STOP", "START", "HELP"];

/**
 * Twilio inbound-message + status-callback adapter.
 *
 * Signature verification uses the OFFICIAL twilio helper (`validateRequest`) — no
 * home-grown HMAC. Twilio signs the exact externally requested URL plus the full
 * form-encoded parameter set, so the caller must pass the public URL and every
 * parameter unmodified. The Account Auth Token is the required key (API Keys do
 * not work for webhook validation) and is server-only: never logged or returned.
 */
@Injectable()
export class TwilioSmsInboundAdapter implements SmsInboundAdapter {
  readonly name = "twilio";
  private readonly logger = new Logger("TwilioSmsInbound");

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get authToken(): string | undefined {
    return this.config.get("twilioAuthToken", { infer: true });
  }

  get configured(): boolean {
    return !!this.authToken && !!this.config.get("communicationsTwilioWebhookBaseUrl", { infer: true });
  }

  verify(url: string, params: Record<string, string>, signature: string | undefined): boolean {
    const token = this.authToken;
    if (!token || !signature) return false;
    try {
      return validateRequest(token, signature, url, params);
    } catch (err) {
      this.logger.warn(`Signature validation error: ${err instanceof Error ? err.message : "unknown"}`);
      return false;
    }
  }

  parseInbound(params: Record<string, string>): NormalizedInboundSms | null {
    const providerMessageId = params.MessageSid ?? params.SmsSid ?? params.SmsMessageSid;
    const fromPhone = params.From;
    const toPhone = params.To;
    if (!providerMessageId || !fromPhone || !toPhone) return null;
    const optOut = (params.OptOutType ?? "").toUpperCase() as InboundOptOutType;
    const numMedia = Number.parseInt(params.NumMedia ?? "0", 10);
    return {
      providerMessageId,
      fromPhone: fromPhone.trim(),
      toPhone: toPhone.trim(),
      body: params.Body ?? "",
      optOutType: OPT_OUT_TYPES.includes(optOut) ? optOut : undefined,
      numMedia: Number.isNaN(numMedia) ? 0 : numMedia,
    };
  }

  parseStatus(params: Record<string, string>): NormalizedSmsStatusCallback | null {
    const providerMessageId = params.MessageSid ?? params.SmsSid;
    const providerStatus = params.MessageStatus ?? params.SmsStatus;
    if (!providerMessageId || !providerStatus) return null;
    return {
      providerMessageId,
      providerStatus,
      errorCode: params.ErrorCode || undefined,
      // Keep a short, non-PII summary only.
      errorMessageSafe: params.ErrorMessage ? params.ErrorMessage.slice(0, 200) : undefined,
    };
  }
}
