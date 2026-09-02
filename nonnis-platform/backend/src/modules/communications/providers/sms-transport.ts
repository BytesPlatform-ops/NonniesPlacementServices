/**
 * Provider-independent SMS transport port. Campaign/conversation business logic
 * depends on this token — never a vendor SDK, and never `if (provider === "twilio")`.
 * Implemented by MockSmsTransport and TwilioSmsTransport; the two are
 * interchangeable through DI/configuration.
 */
export const SMS_TRANSPORT = Symbol("SMS_TRANSPORT");

export interface OutboundSmsMessage {
  /** Our correlation id (stored on the recipient/message and echoed to the provider). */
  internalMessageId: string;
  /** E.164 destination. */
  to: string;
  body: string;
  /** Where the provider should POST delivery status updates. */
  statusCallbackUrl?: string;
  /** Safe, non-PII correlation hints (ids/labels only — never message content). */
  correlationMetadata?: Record<string, string>;
}

/**
 * How a failure should be treated by the dispatcher — never raw HTTP text.
 *  PROVIDER_OPT_OUT_BLOCK: the carrier/provider refuses because the recipient
 *  opted out (Twilio 21610). Never retried, and it synchronizes CRM suppression.
 *  CONFIGURATION: credentials/sender misconfigured — surfaced, never retried.
 */
export type SmsSendClassification = "PERMANENT" | "RATE_LIMIT" | "TEMPORARY" | "AMBIGUOUS" | "PROVIDER_OPT_OUT_BLOCK" | "CONFIGURATION";

export type SmsSendOutcome =
  | {
      ok: true;
      providerMessageId: string;
      /** Provider's own initial status string, already normalized by the adapter. */
      providerStatus: string;
      /** The sender the provider actually used (a Messaging Service may choose it). */
      fromNumber?: string;
      acceptedAt: string;
      providerSegmentCount?: number;
    }
  | { ok: false; classification: SmsSendClassification; code: string; message: string; retryAfterMs?: number };

export interface SmsTransport {
  /** Stable provider name, e.g. "mock" or "twilio". */
  readonly name: string;
  /** True when the provider has everything it needs to send (mock is always true). */
  readonly configured: boolean;
  /** A human-safe explanation when `configured` is false (never contains secrets). */
  readonly configurationError: string | null;
  sendSms(message: OutboundSmsMessage): Promise<SmsSendOutcome>;
}
