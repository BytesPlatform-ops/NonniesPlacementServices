/**
 * Provider-independent EMAIL transport port. Campaign/dispatch business logic
 * depends on this token — never a vendor SDK. Implemented by MockEmailTransport
 * and BrevoEmailTransport; the two are interchangeable through DI.
 */
export const EMAIL_TRANSPORT = Symbol("EMAIL_TRANSPORT");

export interface OutboundEmailMessage {
  /** Our correlation id (stored on the recipient/message; passed to the provider). */
  internalMessageId: string;
  to: string;
  toName?: string;
  senderEmail: string;
  senderName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
  tags?: string[];
}

/** How a failure should be treated by the dispatcher — never raw HTTP text. */
export type EmailSendClassification = "PERMANENT" | "RATE_LIMIT" | "TEMPORARY" | "AMBIGUOUS";

export type EmailSendOutcome =
  | { ok: true; providerMessageId: string; acceptedAt: string }
  | { ok: false; classification: EmailSendClassification; code: string; message: string; retryAfterMs?: number };

export interface EmailTransport {
  /** Stable provider name, e.g. "mock" or "brevo". */
  readonly name: string;
  /** True when the provider has everything it needs to send (mock is always true). */
  readonly configured: boolean;
  sendEmail(message: OutboundEmailMessage): Promise<EmailSendOutcome>;
}
