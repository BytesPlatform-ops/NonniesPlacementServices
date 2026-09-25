import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";

/**
 * The payment link that travels in an invoice email and PDF.
 *
 * An emailed link has to survive for as long as the bill does — weeks, not
 * hours — so it can never be a Stripe Checkout URL: those expire within a day.
 * What goes out is a link back to Nonni's, which mints a fresh Stripe session
 * at the moment somebody clicks it.
 *
 * The token is the invoice id sealed with AES-256-GCM under a key derived from
 * a server secret. Three properties follow, and all three are required of it:
 *
 *  - It cannot be forged. GCM authenticates the ciphertext, so a tampered or
 *    guessed token fails to open rather than opening a different invoice. There
 *    is no id in a query parameter to swap for somebody else's.
 *  - It reveals nothing. The invoice id is encrypted, not encoded, so the link
 *    carries no database identifier a reader could try elsewhere.
 *  - It grants nothing by itself. Opening a token yields an invoice id and
 *    stops there; whether that invoice may be paid is decided fresh, from the
 *    stored record, every time. A token for a paid or cancelled invoice is a
 *    dead link, without anything having to revoke it.
 *
 * Deriving the token rather than storing one keeps this off the invoice table,
 * at one cost worth stating plainly: rotating the secret invalidates links
 * already sent, and those invoices have to be re-sent to get a working link.
 */

const KEY_INFO = "nonnis:invoice-payment-link:v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const UUID_BYTES = 16;

function keyFor(secret: string): Buffer {
  // A derived key, so the underlying secret is never used directly and cannot
  // be worn down by use in two places.
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), Buffer.from(KEY_INFO, "utf8"), 32));
}

function uuidToBytes(uuid: string): Buffer | null {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32 || !/^[0-9a-f]+$/i.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function bytesToUuid(buf: Buffer): string {
  const h = buf.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Whether payment links can be produced at all. */
export function paymentLinksConfigured(config: ConfigService<AppConfig, true>): boolean {
  return !!config.get("invoicePaymentLinkSecret", { infer: true });
}

/**
 * Seal one invoice id into an opaque token.
 *
 * Returns null when no secret is configured, so a caller leaves the link out
 * rather than sending an invoice with a button that cannot work.
 */
export function mintPaymentToken(config: ConfigService<AppConfig, true>, invoiceId: string): string | null {
  const secret = config.get("invoicePaymentLinkSecret", { infer: true });
  if (!secret) return null;
  const raw = uuidToBytes(invoiceId);
  if (!raw) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const sealed = Buffer.concat([cipher.update(raw), cipher.final(), cipher.getAuthTag()]);
  return Buffer.concat([iv, sealed]).toString("base64url");
}

/**
 * Open a token back into the invoice id it was minted for.
 *
 * Returns null for anything that is not a token this server sealed — a
 * truncated string, a tampered one, or one from a different secret. The caller
 * can only answer "not found"; it never learns why, and never learns whether
 * some other invoice exists.
 */
export function readPaymentToken(config: ConfigService<AppConfig, true>, token: string): string | null {
  const secret = config.get("invoicePaymentLinkSecret", { infer: true });
  if (!secret || !token) return null;

  let buf: Buffer;
  try {
    buf = Buffer.from(token, "base64url");
  } catch {
    return null;
  }
  if (buf.length !== IV_BYTES + UUID_BYTES + TAG_BYTES) return null;

  const iv = buf.subarray(0, IV_BYTES);
  const body = buf.subarray(IV_BYTES, IV_BYTES + UUID_BYTES);
  const tag = buf.subarray(IV_BYTES + UUID_BYTES);

  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv);
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(body), decipher.final()]);
    return raw.length === UUID_BYTES ? bytesToUuid(raw) : null;
  } catch {
    // Authentication failed: forged, truncated, or minted under another secret.
    return null;
  }
}

/** The public URL a provider follows to pay an invoice by card. */
export function paymentLinkUrl(config: ConfigService<AppConfig, true>, token: string): string {
  const base = config.get("communicationsApiUrl", { infer: true }).replace(/\/$/, "");
  return `${base}/invoice-payments/${encodeURIComponent(token)}`;
}

/** Constant-time equality, for comparing two tokens without leaking position. */
export function tokensMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
