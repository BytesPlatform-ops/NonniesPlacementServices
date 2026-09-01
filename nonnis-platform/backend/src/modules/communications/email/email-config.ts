import { createHmac, randomBytes } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";

export interface ResolvedSender {
  email: string;
  name: string;
}

/**
 * The verified/configured sender. Campaign users NEVER supply the From address —
 * only (optionally) a From name. In mock mode a local placeholder is used since
 * nothing is delivered.
 */
export function resolveSender(config: ConfigService<AppConfig, true>): ResolvedSender {
  return {
    email: config.get("brevoSenderEmail", { infer: true }) ?? "no-reply@nonnis.local",
    name: config.get("brevoSenderName", { infer: true }) ?? "Nonni's Placement",
  };
}

export function publicSiteUrl(config: ConfigService<AppConfig, true>): string {
  return config.get("communicationsPublicSiteUrl", { infer: true });
}

/** Public unsubscribe URL for an opaque per-contact token. */
export function unsubscribeUrl(config: ConfigService<AppConfig, true>, token: string): string {
  return `${publicSiteUrl(config)}/unsubscribe/email?token=${encodeURIComponent(token)}`;
}

/** A high-entropy opaque unsubscribe token (never encodes the contact id/email). */
export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Opaque per-recipient thread/correlation token (used by 15C for inbound routing). */
export function generateThreadToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Safe, public provider status (never exposes the API key or secrets). */
export interface EmailProviderStatus {
  provider: string;
  configured: boolean;
  mockMode: boolean;
  senderEmail: string;
  senderName: string;
}

export function emailProviderStatus(config: ConfigService<AppConfig, true>, configured: boolean): EmailProviderStatus {
  const provider = config.get("communicationsEmailProvider", { infer: true });
  const sender = resolveSender(config);
  return { provider, configured, mockMode: provider === "mock", senderEmail: sender.email, senderName: sender.name };
}

/** Constant-time-ish comparison of a provided secret against an expected one. */
function secretsMatch(expected: string | undefined, provided: string | undefined): boolean {
  if (!expected) return false; // never accept an unauthenticated mutation webhook
  if (!provided || provided.length !== expected.length) return false;
  const a = createHmac("sha256", expected).update(provided).digest();
  const b = createHmac("sha256", expected).update(expected).digest();
  return a.equals(b);
}

/** Guards the provider delivery-event webhook. */
export function verifyWebhookSecret(config: ConfigService<AppConfig, true>, provided: string | undefined): boolean {
  return secretsMatch(config.get("communicationsWebhookSecret", { infer: true }), provided);
}

/**
 * Guards the provider INBOUND-content webhook. Brevo inbound parsing is not
 * cryptographically signed, so a high-entropy shared secret (URL/header) is the
 * strongest available verification — a missing configured secret rejects everything.
 */
export function verifyInboundSecret(config: ConfigService<AppConfig, true>, provided: string | undefined): boolean {
  return secretsMatch(config.get("communicationsInboundEmailSecret", { infer: true }), provided);
}
