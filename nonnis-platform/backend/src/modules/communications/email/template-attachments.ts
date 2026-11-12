import { BadRequestException } from "@nestjs/common";
import { MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES, safeDisplayFilename, validateAttachment } from "./attachment-policy";

/**
 * Files attached to an email template, sent with every email built from it
 * (test sends and campaigns).
 *
 * They are kept on the template's `designJson` under `attachments` rather than
 * in a table of their own, so the feature needs no schema migration. The bytes
 * live in the same PRIVATE communications bucket as reply attachments, under a
 * server-generated `attachments/…` path; only the reference is stored here.
 * Stored objects are never overwritten, so a duplicated template can safely
 * share its source's references.
 */
export interface TemplateAttachment {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Reads the references stored on a design, ignoring anything malformed. */
export function readTemplateAttachments(designJson: unknown): TemplateAttachment[] {
  if (!designJson || typeof designJson !== "object") return [];
  const raw = (designJson as Record<string, unknown>).attachments;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const a = item as Record<string, unknown> | null;
    if (!a || typeof a.path !== "string" || typeof a.fileName !== "string" || typeof a.mimeType !== "string" || typeof a.sizeBytes !== "number") return [];
    return [{ path: a.path, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes }];
  });
}

/** The design without its attachment list — what the builder edits. */
export function designWithoutAttachments(designJson: unknown): unknown {
  if (!designJson || typeof designJson !== "object" || Array.isArray(designJson)) return designJson;
  const { attachments: _ignored, ...rest } = designJson as Record<string, unknown>;
  return rest;
}

/** Stores `attachments` on `designJson`, replacing whatever list it carried. */
export function designWithAttachments(designJson: unknown, attachments: TemplateAttachment[]): Record<string, unknown> {
  const base = (designWithoutAttachments(designJson) ?? {}) as Record<string, unknown>;
  return attachments.length > 0 ? { ...base, attachments } : base;
}

/**
 * Applies the same type, size and count limits as reply attachments, and
 * accepts only paths this server generated.
 */
export function validateTemplateAttachments(input: TemplateAttachment[]): TemplateAttachment[] {
  if (input.length > MAX_ATTACHMENTS) throw new BadRequestException(`At most ${MAX_ATTACHMENTS} attachments are allowed.`);
  const seen = new Set<string>();
  let total = 0;
  const out = input.map((a) => {
    validateAttachment(a.fileName, a.mimeType, a.sizeBytes);
    if (!/^attachments\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(a.path)) throw new BadRequestException("Invalid attachment reference.");
    if (seen.has(a.path)) throw new BadRequestException("The same attachment was added twice.");
    seen.add(a.path);
    total += a.sizeBytes;
    return { path: a.path, fileName: safeDisplayFilename(a.fileName), mimeType: a.mimeType.toLowerCase(), sizeBytes: a.sizeBytes };
  });
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) throw new BadRequestException("The attachments exceed the total size limit.");
  return out;
}
