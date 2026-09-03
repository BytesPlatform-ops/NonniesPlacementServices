import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { stripQuotedReply } from "../email/strip-quoted-reply";
import type { EmailInboundAdapter, NormalizedInboundAttachment, NormalizedInboundEmail } from "./email-inbound-adapter";

const ATTACHMENT_ENDPOINT = "https://api.brevo.com/v3/inbound/attachments";
const FETCH_TIMEOUT_MS = 15_000;

interface BrevoMailbox {
  Address?: string;
  Name?: string;
}

/**
 * Brevo Inbound Parsing adapter. Brevo POSTs `{ items: [ ... ] }`; each item carries
 * From/To/Cc/Recipients/ReplyTo, MessageId, InReplyTo, Subject, RawTextBody/
 * RawHtmlBody/ExtractedMarkdownMessage, Headers, SentAtDate, and attachments with a
 * DownloadToken (content is fetched separately, never inline). References lives in
 * Headers. Only what threading/display needs is extracted — no raw payload is kept.
 *
 * Security note: Brevo inbound parsing is NOT cryptographically signed, so request
 * authentication is a high-entropy secret carried on the webhook URL (enforced by the
 * controller). See docs/COMMUNICATIONS.md.
 */
@Injectable()
export class BrevoEmailInboundAdapter implements EmailInboundAdapter {
  readonly name = "brevo";
  private readonly logger = new Logger("BrevoInbound");

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get configured(): boolean {
    // Inbound needs the domain + guarding secret; API key is only needed to fetch attachments.
    return !!this.config.get("communicationsInboundEmailSecret", { infer: true }) && !!this.config.get("communicationsInboundEmailDomain", { infer: true });
  }

  parse(body: unknown): NormalizedInboundEmail[] {
    const items = this.extractItems(body);
    const out: NormalizedInboundEmail[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as Record<string, unknown>;
      const from = this.mailbox(it.From);
      if (!from?.Address) continue;

      const destinations = [
        ...this.mailboxList(it.To),
        ...this.mailboxList(it.Cc),
        ...this.recipients(it.Recipients),
        ...(this.mailbox(it.ReplyTo)?.Address ? [this.mailbox(it.ReplyTo)!.Address!] : []),
      ];
      const headers = this.normalizeHeaders(it.Headers);
      const attachments: NormalizedInboundAttachment[] = Array.isArray(it.Attachments)
        ? it.Attachments.map((a) => {
            const at = a as Record<string, unknown>;
            return {
              fileName: String(at.Name ?? "attachment"),
              mimeType: String(at.ContentType ?? "application/octet-stream"),
              sizeBytes: typeof at.ContentLength === "number" ? at.ContentLength : undefined,
              providerAttachmentId: at.DownloadToken ? String(at.DownloadToken) : undefined,
              contentId: at.ContentID ? String(at.ContentID) : undefined,
            };
          })
        : [];

      const sentAt = it.SentAtDate ? new Date(String(it.SentAtDate)) : undefined;
      out.push({
        providerInboundId: this.providerInboundId(it),
        from: { address: from.Address, name: from.Name },
        destinations,
        primaryTo: this.mailboxList(it.To)[0],
        subject: it.Subject ? String(it.Subject) : undefined,
        // Brevo's ExtractedMarkdownMessage is the reply WITHOUT the quoted
        // history; RawTextBody is the whole thread pasted under it. Prefer the
        // extraction, and fall back to trimming the raw body ourselves so a
        // reply never arrives with the entire conversation repeated inside it.
        text: this.firstString(it.ExtractedMarkdownMessage) ?? stripQuotedReply(this.firstString(it.RawTextBody)),
        html: it.RawHtmlBody ? String(it.RawHtmlBody) : undefined,
        internetMessageId: it.MessageId ? String(it.MessageId) : undefined,
        inReplyTo: it.InReplyTo ? String(it.InReplyTo) : headers["in-reply-to"],
        references: headers["references"],
        receivedAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : undefined,
        autoSubmitted: this.detectAutoSubmitted(headers),
        attachments,
      });
    }
    return out;
  }

  async fetchAttachment(attachment: NormalizedInboundAttachment, maxBytes: number): Promise<Buffer | null> {
    const token = attachment.providerAttachmentId;
    const key = this.config.get("brevoApiKey", { infer: true });
    if (!token || !key) return null;
    if (attachment.sizeBytes && attachment.sizeBytes > maxBytes) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${ATTACHMENT_ENDPOINT}/${encodeURIComponent(token)}`, { headers: { "api-key": key, accept: "application/octet-stream" }, signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`Attachment fetch failed (HTTP ${res.status}).`);
        return null;
      }
      const len = Number.parseInt(res.headers.get("content-length") ?? "", 10);
      if (!Number.isNaN(len) && len > maxBytes) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.byteLength > maxBytes ? null : buf;
    } catch (err) {
      this.logger.warn(`Attachment fetch error: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // --- payload helpers -------------------------------------------------------
  private extractItems(body: unknown): unknown[] {
    if (Array.isArray(body)) return body;
    if (body && typeof body === "object") {
      const items = (body as Record<string, unknown>).items;
      if (Array.isArray(items)) return items;
      return [body];
    }
    return [];
  }

  private mailbox(v: unknown): BrevoMailbox | null {
    if (!v || typeof v !== "object") return null;
    const m = v as BrevoMailbox;
    return m.Address ? { Address: String(m.Address).trim(), Name: m.Name ? String(m.Name) : undefined } : null;
  }

  private mailboxList(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((m) => this.mailbox(m)?.Address).filter((a): a is string => !!a);
  }

  private recipients(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((r) => String(r).trim()).filter(Boolean);
  }

  private providerInboundId(it: Record<string, unknown>): string | undefined {
    if (Array.isArray(it.Uuid) && it.Uuid.length) return String(it.Uuid[0]);
    if (it.MessageId) return String(it.MessageId);
    return undefined;
  }

  private firstString(...vals: unknown[]): string | undefined {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  }

  private normalizeHeaders(v: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!v || typeof v !== "object") return out;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k.toLowerCase()] = Array.isArray(val) ? val.map((x) => String(x)).join(" ") : String(val);
    }
    return out;
  }

  private detectAutoSubmitted(headers: Record<string, string>): boolean {
    const auto = (headers["auto-submitted"] ?? "").toLowerCase();
    if (auto && auto !== "no") return true;
    const precedence = (headers["precedence"] ?? "").toLowerCase();
    if (["bulk", "auto_reply", "list", "junk"].includes(precedence)) return true;
    return !!headers["x-autoreply"] || !!headers["x-autorespond"];
  }
}
