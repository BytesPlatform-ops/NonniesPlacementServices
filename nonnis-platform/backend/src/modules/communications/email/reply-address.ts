import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";

/**
 * Canonical formatter/parser for the conversation-specific inbound reply address.
 *
 *   reply-<opaqueToken>@<inboundDomain>
 *
 * The local part uses a fixed "reply-" prefix (a hyphen — never subaddressing "+",
 * which some MTAs strip) followed by the opaque conversation thread token. The token
 * itself is high-entropy and NEVER a raw contact/campaign/database id or email.
 *
 * Provider-independent: Brevo inbound parsing routes every message for the inbound
 * domain to the webhook regardless of local part, so any local part is delivered; the
 * mock harness uses this same parser. There is exactly ONE formatter/parser.
 */
const PREFIX = "reply-";
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function inboundDomain(config: ConfigService<AppConfig, true>): string {
  return config.get("communicationsInboundEmailDomain", { infer: true });
}

/** Build the reply-to address for a conversation's opaque thread token. */
export function formatReplyAddress(config: ConfigService<AppConfig, true>, token: string): string {
  return `${PREFIX}${token}@${inboundDomain(config)}`;
}

/**
 * Extract the opaque thread token from a single email address, or null. Matching is
 * domain-scoped (case-insensitive) and requires the exact "reply-" prefix; a valid
 * token charset/length is enforced so garbage never resolves.
 */
export function parseReplyToken(config: ConfigService<AppConfig, true>, address: string | null | undefined): string | null {
  if (!address) return null;
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const local = address.slice(0, at).trim().toLowerCase();
  const domain = address.slice(at + 1).trim().toLowerCase();
  if (domain !== inboundDomain(config)) return null;
  if (!local.startsWith(PREFIX)) return null;
  const token = address.slice(PREFIX.length, at); // preserve original token casing
  return TOKEN_RE.test(token) ? token : null;
}

/** Scan many candidate destination addresses (To/Cc/Recipients/ReplyTo) for a token. */
export function findReplyToken(config: ConfigService<AppConfig, true>, addresses: Array<string | null | undefined>): string | null {
  for (const a of addresses) {
    const token = parseReplyToken(config, a);
    if (token) return token;
  }
  return null;
}
