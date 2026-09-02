import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import type { InboundOptOutType, NormalizedInboundSms, NormalizedSmsStatusCallback, SmsInboundAdapter } from "./sms-inbound-adapter";

const OPT_OUT_TYPES: InboundOptOutType[] = ["STOP", "START", "HELP"];

/**
 * Mock inbound SMS adapter for local development and tests. It parses the SAME
 * provider-shaped field names as Twilio so fixtures exercise the real code path.
 *
 * Signature verification is a DEVELOPMENT-ONLY bypass: it returns false whenever
 * NODE_ENV=production, so a mock deployment can never expose an unauthenticated
 * inbound endpoint. Local end-to-end testing goes through the guarded CLI.
 */
@Injectable()
export class MockSmsInboundAdapter implements SmsInboundAdapter {
  readonly name = "mock";
  readonly configured = true;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  verify(): boolean {
    return this.config.get("nodeEnv", { infer: true }) !== "production";
  }

  parseInbound(params: Record<string, string>): NormalizedInboundSms | null {
    const providerMessageId = params.MessageSid ?? params.SmsSid;
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
    return { providerMessageId, providerStatus, errorCode: params.ErrorCode || undefined, errorMessageSafe: params.ErrorMessage ? params.ErrorMessage.slice(0, 200) : undefined };
  }
}
