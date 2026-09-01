/**
 * Provider-independent INBOUND email port. Inbox/conversation business logic
 * consumes ONLY the normalized result below — never a Brevo-shaped payload. This
 * keeps `if (provider === "brevo")` out of the services. Implemented by
 * MockEmailInboundAdapter and BrevoEmailInboundAdapter, selected by DI/config.
 */
export const INBOUND_EMAIL_ADAPTER = Symbol("INBOUND_EMAIL_ADAPTER");

export interface NormalizedInboundAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  /** Provider token/id needed to fetch the binary (Brevo DownloadToken); mock inlines it. */
  providerAttachmentId?: string;
  contentId?: string;
  /** Inline base64 content (mock fixtures / providers that inline). */
  contentBase64?: string;
}

export interface NormalizedInboundEmail {
  /** Stable provider inbound identity for idempotency (may be absent). */
  providerInboundId?: string;
  from: { address: string; name?: string };
  /** Every destination address seen (To + Cc + envelope Recipients + Reply-To) so the
   *  opaque thread token can be located wherever the provider surfaced it. */
  destinations: string[];
  /** Best single "To" for display. */
  primaryTo?: string;
  subject?: string;
  text?: string;
  /** Raw, UNTRUSTED HTML — the service sanitizes before any storage/display. */
  html?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references?: string;
  receivedAt?: Date;
  /** Detected auto-responder (Auto-Submitted / Precedence) — never triggers needsReply. */
  autoSubmitted?: boolean;
  attachments: NormalizedInboundAttachment[];
}

export interface EmailInboundAdapter {
  readonly name: string;
  /** True when the adapter can actually receive/verify live inbound (mock is always true). */
  readonly configured: boolean;
  /** Parse a raw webhook body into zero or more normalized inbound emails. */
  parse(body: unknown): NormalizedInboundEmail[];
  /** Fetch + return the attachment binary (bounded by maxBytes), or null if unavailable. */
  fetchAttachment(attachment: NormalizedInboundAttachment, maxBytes: number): Promise<Buffer | null>;
}
