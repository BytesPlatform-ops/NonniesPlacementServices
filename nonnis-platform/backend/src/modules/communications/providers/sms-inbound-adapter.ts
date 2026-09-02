/**
 * Provider-independent INBOUND SMS port. Conversation/opt-out business logic
 * consumes ONLY the normalized results below — a Twilio-shaped payload never
 * reaches a service. Implemented by MockSmsInboundAdapter and
 * TwilioSmsInboundAdapter, selected by DI/config.
 */
export const SMS_INBOUND_ADAPTER = Symbol("SMS_INBOUND_ADAPTER");

/** Provider-authoritative opt-out classification (Twilio `OptOutType`). */
export type InboundOptOutType = "STOP" | "START" | "HELP";

export interface NormalizedInboundSms {
  /** Provider message identity — the strong idempotency key (Twilio MessageSid). */
  providerMessageId: string;
  /** E.164 sender (the customer). */
  fromPhone: string;
  /** E.164 recipient (our business number). */
  toPhone: string;
  body: string;
  receivedAt?: Date;
  /** Present only when the provider classified the message as an opt-out keyword. */
  optOutType?: InboundOptOutType;
  /** Number of media parts. MMS content is NOT fetched or stored in this phase. */
  numMedia: number;
}

export interface NormalizedSmsStatusCallback {
  providerMessageId: string;
  /** Raw provider status string — normalized to a CRM state by the status service. */
  providerStatus: string;
  errorCode?: string;
  errorMessageSafe?: string;
}

export interface SmsInboundAdapter {
  readonly name: string;
  /** True when inbound/status webhooks can actually be verified. */
  readonly configured: boolean;
  /**
   * Verify the provider's request signature against the EXACT externally requested
   * URL and the COMPLETE, unmodified parameter set. Must be called before any
   * parsing or persistence.
   */
  verify(url: string, params: Record<string, string>, signature: string | undefined): boolean;
  parseInbound(params: Record<string, string>): NormalizedInboundSms | null;
  parseStatus(params: Record<string, string>): NormalizedSmsStatusCallback | null;
}
