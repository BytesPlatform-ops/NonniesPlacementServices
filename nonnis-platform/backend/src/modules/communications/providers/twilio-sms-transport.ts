import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import type { OutboundSmsMessage, SmsSendOutcome, SmsTransport } from "./sms-transport";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const TIMEOUT_MS = 15_000;

/** Twilio: "The person you are trying to message has opted out" (replied STOP). */
const ERROR_OPTED_OUT = 21610;

interface TwilioMessageResponse {
  sid?: string;
  status?: string;
  from?: string;
  num_segments?: string;
  error_code?: number | null;
  error_message?: string | null;
}

interface TwilioErrorResponse {
  code?: number;
  message?: string;
  status?: number;
}

/**
 * Twilio Programmable Messaging adapter (POST /2010-04-01/Accounts/{Sid}/Messages.json,
 * form-encoded, HTTP Basic auth). A small typed HTTP client — no SDK on the send path.
 *
 * Auth: prefers API Key SID + Secret (the Account SID stays in the URL), falling back
 * to Account SID + Auth Token. The Auth Token is otherwise reserved for webhook
 * signature validation and is never logged or returned.
 *
 * Sending always goes through the configured Messaging Service when present, so CRM
 * users can never supply an arbitrary From number. All failures are normalized so the
 * dispatcher never interprets raw HTTP or Twilio status strings.
 */
@Injectable()
export class TwilioSmsTransport implements SmsTransport {
  readonly name = "twilio";
  private readonly logger = new Logger("TwilioSmsTransport");

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get accountSid(): string | undefined {
    return this.config.get("twilioAccountSid", { infer: true });
  }
  private get messagingServiceSid(): string | undefined {
    return this.config.get("twilioMessagingServiceSid", { infer: true });
  }
  private get phoneNumber(): string | undefined {
    return this.config.get("twilioPhoneNumber", { infer: true });
  }

  /** Basic-auth pair: API Key preferred, Auth Token as fallback. Never logged. */
  private credentials(): { user: string; pass: string } | null {
    const keySid = this.config.get("twilioApiKeySid", { infer: true });
    const keySecret = this.config.get("twilioApiKeySecret", { infer: true });
    if (keySid && keySecret) return { user: keySid, pass: keySecret };
    const accountSid = this.accountSid;
    const authToken = this.config.get("twilioAuthToken", { infer: true });
    if (accountSid && authToken) return { user: accountSid, pass: authToken };
    return null;
  }

  get configurationError(): string | null {
    const missing: string[] = [];
    if (!this.accountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!this.credentials()) missing.push("TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (or TWILIO_AUTH_TOKEN)");
    if (!this.messagingServiceSid && !this.phoneNumber) missing.push("TWILIO_MESSAGING_SERVICE_SID (or TWILIO_PHONE_NUMBER)");
    return missing.length ? `SMS provider is not fully configured. Missing: ${missing.join(", ")}.` : null;
  }

  get configured(): boolean {
    return this.configurationError === null;
  }

  async sendSms(message: OutboundSmsMessage): Promise<SmsSendOutcome> {
    const accountSid = this.accountSid;
    const creds = this.credentials();
    if (!accountSid || !creds) {
      return { ok: false, classification: "CONFIGURATION", code: "NOT_CONFIGURED", message: this.configurationError ?? "SMS provider is not fully configured." };
    }

    const form = new URLSearchParams();
    form.set("To", message.to);
    // Prefer the Messaging Service so Twilio owns sender selection + opt-out handling.
    if (this.messagingServiceSid) form.set("MessagingServiceSid", this.messagingServiceSid);
    else if (this.phoneNumber) form.set("From", this.phoneNumber);
    form.set("Body", message.body);
    if (message.statusCallbackUrl) form.set("StatusCallback", message.statusCallbackUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${TWILIO_API_BASE}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${creds.user}:${creds.pass}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: form.toString(),
        signal: controller.signal,
      });
    } catch (err) {
      // Network error / timeout: Twilio MAY have accepted the message — never blind-retry.
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ok: false, classification: "AMBIGUOUS", code: aborted ? "TIMEOUT" : "NETWORK", message: aborted ? "Request timed out." : "Network error." };
    } finally {
      clearTimeout(timer);
    }

    return this.classify(res);
  }

  private async classify(res: Response): Promise<SmsSendOutcome> {
    if (res.status === 201 || res.status === 200) {
      const json = (await res.json().catch(() => ({}))) as TwilioMessageResponse;
      if (!json.sid) {
        // Accepted but no SID — review it rather than risk a duplicate send.
        return { ok: false, classification: "AMBIGUOUS", code: "NO_MESSAGE_SID", message: "Provider accepted but returned no message SID." };
      }
      const segments = Number.parseInt(json.num_segments ?? "", 10);
      return {
        ok: true,
        providerMessageId: json.sid,
        providerStatus: json.status ?? "queued",
        fromNumber: json.from ?? undefined,
        acceptedAt: new Date().toISOString(),
        providerSegmentCount: Number.isNaN(segments) ? undefined : segments,
      };
    }

    const error = await this.safeError(res);
    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      return { ok: false, classification: "RATE_LIMIT", code: "RATE_LIMIT", message: "Rate limited.", retryAfterMs: Number.isNaN(retryAfter) ? undefined : retryAfter * 1000 };
    }
    if (res.status === 401 || res.status === 403) {
      this.logger.error(`Twilio auth/config failure (HTTP ${res.status}).`);
      return { ok: false, classification: "CONFIGURATION", code: "AUTH", message: "SMS provider authentication/configuration failed." };
    }
    if (res.status >= 500) return { ok: false, classification: "TEMPORARY", code: `HTTP_${res.status}`, message: "Temporary provider failure." };
    // The recipient replied STOP: the carrier blocks us until they text START.
    if (error.code === ERROR_OPTED_OUT) {
      return { ok: false, classification: "PROVIDER_OPT_OUT_BLOCK", code: String(ERROR_OPTED_OUT), message: "The recipient has opted out of messages from this sender." };
    }
    return { ok: false, classification: "PERMANENT", code: error.code ? String(error.code) : `HTTP_${res.status}`, message: error.message };
  }

  /** A short, non-PII summary only — never the full payload, body, or any secret. */
  private async safeError(res: Response): Promise<{ code?: number; message: string }> {
    try {
      const json = (await res.json()) as TwilioErrorResponse;
      return { code: json.code, message: (json.message ?? "Provider rejected the message.").slice(0, 200) };
    } catch {
      return { message: "Provider rejected the message." };
    }
  }
}
