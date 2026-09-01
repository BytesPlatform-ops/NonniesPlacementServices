import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import type { EmailSendOutcome, EmailTransport, OutboundEmailMessage } from "./email-transport";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 15_000;

/**
 * Brevo transactional-email adapter (https://developers.brevo.com — POST
 * /v3/smtp/email with an `api-key` header, `messageId` in the 201 response).
 * A small typed HTTP client — no SDK. The API key is never logged or returned.
 * All failures are normalized so the dispatcher never interprets raw HTTP.
 */
@Injectable()
export class BrevoEmailTransport implements EmailTransport {
  readonly name = "brevo";
  private readonly logger = new Logger("BrevoEmailTransport");

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get apiKey(): string | undefined {
    return this.config.get("brevoApiKey", { infer: true });
  }

  get configured(): boolean {
    return !!this.apiKey && !!this.config.get("brevoSenderEmail", { infer: true });
  }

  async sendEmail(message: OutboundEmailMessage): Promise<EmailSendOutcome> {
    const key = this.apiKey;
    if (!key) return { ok: false, classification: "PERMANENT", code: "NOT_CONFIGURED", message: "Brevo API key is not configured." };

    const body = {
      sender: { email: message.senderEmail, name: message.senderName },
      to: [{ email: message.to, name: message.toName }],
      ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      headers: { "X-Nonnis-Message-Id": message.internalMessageId, ...(message.headers ?? {}) },
      ...(message.tags && message.tags.length ? { tags: message.tags } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      // Network error / timeout: the provider MAY have accepted — never blind-retry.
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ok: false, classification: "AMBIGUOUS", code: aborted ? "TIMEOUT" : "NETWORK", message: aborted ? "Request timed out." : "Network error." };
    } finally {
      clearTimeout(timer);
    }

    return this.classify(res);
  }

  private async classify(res: Response): Promise<EmailSendOutcome> {
    if (res.status === 201 || res.status === 200 || res.status === 202) {
      const json = (await res.json().catch(() => ({}))) as { messageId?: string; messageIds?: string[] };
      const providerMessageId = json.messageId ?? json.messageIds?.[0] ?? "";
      if (!providerMessageId) {
        // Accepted but no id — treat as ambiguous so it is reviewed, not resent.
        return { ok: false, classification: "AMBIGUOUS", code: "NO_MESSAGE_ID", message: "Provider accepted but returned no message id." };
      }
      return { ok: true, providerMessageId, acceptedAt: new Date().toISOString() };
    }
    const safeMessage = await this.safeErrorText(res);
    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      return { ok: false, classification: "RATE_LIMIT", code: "RATE_LIMIT", message: "Rate limited.", retryAfterMs: Number.isNaN(retryAfter) ? undefined : retryAfter * 1000 };
    }
    if (res.status === 401 || res.status === 403) {
      this.logger.error(`Brevo auth/config failure (HTTP ${res.status}).`);
      return { ok: false, classification: "PERMANENT", code: "AUTH", message: "Provider authentication/configuration failed." };
    }
    if (res.status >= 500) return { ok: false, classification: "TEMPORARY", code: `HTTP_${res.status}`, message: "Temporary provider failure." };
    // 400 and other 4xx = permanent validation/rejection.
    return { ok: false, classification: "PERMANENT", code: `HTTP_${res.status}`, message: safeMessage };
  }

  private async safeErrorText(res: Response): Promise<string> {
    try {
      const json = (await res.json()) as { message?: string; code?: string };
      // Only a short, non-PII summary — never the full payload or any secret.
      return (json.code ? `${json.code}: ` : "") + (json.message ?? "Provider rejected the message.").slice(0, 200);
    } catch {
      return "Provider rejected the message.";
    }
  }
}
