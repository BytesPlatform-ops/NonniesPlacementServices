import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { calculateSegments } from "../sms/sms-segments";
import type { OutboundSmsMessage, SmsSendOutcome, SmsTransport } from "./sms-transport";

/** Deterministic mock sender number used when no real number is configured. */
export const MOCK_SMS_FROM_NUMBER = "+15550001000";

/**
 * Deterministic mock SMS transport for development/tests. Performs ZERO network
 * calls and returns predictable provider message IDs. The destination's last four
 * digits select an outcome so the whole dispatch state machine — including the
 * provider opt-out block — can be exercised entirely offline:
 *   ...0001 permanent failure   ...0002 rate limit      ...0003 ambiguous timeout
 *   ...0004 temporary failure   ...0005 opt-out block   anything else succeeds
 */
@Injectable()
export class MockSmsTransport implements SmsTransport {
  readonly name = "mock";
  readonly configured = true;
  readonly configurationError = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** The mock "business number" — mirrors the configured one so E2E stays consistent. */
  get fromNumber(): string {
    return this.config.get("twilioPhoneNumber", { infer: true }) ?? MOCK_SMS_FROM_NUMBER;
  }

  async sendSms(message: OutboundSmsMessage): Promise<SmsSendOutcome> {
    const suffix = message.to.replace(/\D/g, "").slice(-4);
    if (suffix === "0001") return { ok: false, classification: "PERMANENT", code: "MOCK_INVALID", message: "Mock permanent failure" };
    if (suffix === "0002") return { ok: false, classification: "RATE_LIMIT", code: "MOCK_429", message: "Mock rate limit", retryAfterMs: 1000 };
    if (suffix === "0003") return { ok: false, classification: "AMBIGUOUS", code: "MOCK_TIMEOUT", message: "Mock network timeout" };
    if (suffix === "0004") return { ok: false, classification: "TEMPORARY", code: "MOCK_5XX", message: "Mock temporary failure" };
    if (suffix === "0005") return { ok: false, classification: "PROVIDER_OPT_OUT_BLOCK", code: "MOCK_21610", message: "Mock recipient has opted out" };
    return {
      ok: true,
      providerMessageId: `mock-sms-${randomUUID()}`,
      providerStatus: "queued",
      fromNumber: this.fromNumber,
      acceptedAt: new Date().toISOString(),
      providerSegmentCount: calculateSegments(message.body).segmentCount,
    };
  }
}
