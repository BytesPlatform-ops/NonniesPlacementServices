import { Injectable } from "@nestjs/common";
import type { EmailInboundAdapter, NormalizedInboundAttachment, NormalizedInboundEmail } from "./email-inbound-adapter";

/**
 * Deterministic mock inbound adapter for local development and tests. It parses a
 * simple, documented JSON body (the same one the dev simulate-reply command and the
 * test fixtures produce) and returns the normalized result. Attachments are inlined
 * as base64 — ZERO network calls.
 *
 * Mock body shape (single object or array):
 *   {
 *     providerInboundId?, from: { address, name? }, to: string[],
 *     subject?, text?, html?, messageId?, inReplyTo?, references?,
 *     receivedAt?, autoSubmitted?, attachments?: [{ fileName, mimeType, contentBase64, contentId? }]
 *   }
 */
@Injectable()
export class MockEmailInboundAdapter implements EmailInboundAdapter {
  readonly name = "mock";
  readonly configured = true;

  parse(body: unknown): NormalizedInboundEmail[] {
    const items = Array.isArray(body) ? body : [body];
    const out: NormalizedInboundEmail[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const from = (r.from ?? {}) as { address?: unknown; name?: unknown };
      const address = String(from.address ?? "").trim();
      if (!address) continue;
      const destinations = Array.isArray(r.to) ? r.to.map((t) => String(t)) : r.to ? [String(r.to)] : [];
      const attachments: NormalizedInboundAttachment[] = Array.isArray(r.attachments)
        ? r.attachments.map((a) => {
            const at = a as Record<string, unknown>;
            return {
              fileName: String(at.fileName ?? "attachment"),
              mimeType: String(at.mimeType ?? "application/octet-stream"),
              sizeBytes: at.contentBase64 ? Buffer.byteLength(String(at.contentBase64), "base64") : undefined,
              contentId: at.contentId ? String(at.contentId) : undefined,
              contentBase64: at.contentBase64 ? String(at.contentBase64) : undefined,
            };
          })
        : [];
      const receivedAt = r.receivedAt ? new Date(String(r.receivedAt)) : undefined;
      out.push({
        providerInboundId: r.providerInboundId ? String(r.providerInboundId) : undefined,
        from: { address, name: from.name ? String(from.name) : undefined },
        destinations,
        primaryTo: destinations[0],
        subject: r.subject ? String(r.subject) : undefined,
        text: r.text ? String(r.text) : undefined,
        html: r.html ? String(r.html) : undefined,
        internetMessageId: r.messageId ? String(r.messageId) : undefined,
        inReplyTo: r.inReplyTo ? String(r.inReplyTo) : undefined,
        references: r.references ? String(r.references) : undefined,
        receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : undefined,
        autoSubmitted: r.autoSubmitted === true,
        attachments,
      });
    }
    return out;
  }

  async fetchAttachment(attachment: NormalizedInboundAttachment, maxBytes: number): Promise<Buffer | null> {
    if (!attachment.contentBase64) return null;
    const buf = Buffer.from(attachment.contentBase64, "base64");
    if (buf.byteLength > maxBytes) return null;
    return buf;
  }
}
