/** Provider-independent EMAIL transport port. Brevo becomes an implementation of
 *  this interface in a later phase — business logic depends on the token, never a
 *  vendor SDK. No sending happens in 15A. */
export const EMAIL_TRANSPORT = Symbol("EMAIL_TRANSPORT");

export interface OutboundEmail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface EmailTransport {
  /** Stable provider name, e.g. "mock" or (later) "brevo". */
  readonly name: string;
  send(message: OutboundEmail): Promise<EmailSendResult>;
}
