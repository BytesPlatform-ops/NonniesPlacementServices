import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

/**
 * Conservative attachment policy for communication email (NOT the excluded
 * Document/Compliance system). MIME allowlist + size limits only — there is no
 * malware scanning, so nothing here claims files are scanned. Executable/script
 * types are rejected. Storage paths are always server-generated; provider/browser
 * filenames are never trusted for the path.
 */
export const ATTACHMENT_MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Extensions we refuse regardless of the claimed MIME type. */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "js", "mjs", "sh", "bat", "cmd", "com", "scr", "msi", "vbs", "ps1", "jar",
  "app", "dll", "so", "bin", "pif", "gadget", "wsf", "html", "htm", "svg",
]);

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB each
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB per message

export function isAllowedAttachmentType(mimeType: string): boolean {
  return !!ATTACHMENT_MIME_EXT[mimeType.toLowerCase()];
}

function extensionOf(fileName: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/** Validate a single attachment intent; returns the resolved safe extension. */
export function validateAttachment(fileName: string, mimeType: string, sizeBytes: number, maxBytes = MAX_ATTACHMENT_BYTES): string {
  const mime = mimeType.toLowerCase();
  const ext = ATTACHMENT_MIME_EXT[mime];
  if (!ext) throw new BadRequestException(`Unsupported attachment type: ${mimeType}`);
  const claimedExt = extensionOf(fileName);
  if (claimedExt && BLOCKED_EXTENSIONS.has(claimedExt)) throw new BadRequestException("This file type is not allowed.");
  if (sizeBytes <= 0) throw new BadRequestException("Empty attachment.");
  if (sizeBytes > maxBytes) throw new BadRequestException(`Attachment exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`);
  return ext;
}

/** Server-generated private storage path — never derived from the untrusted filename. */
export function buildAttachmentPath(mimeType: string): string {
  const ext = ATTACHMENT_MIME_EXT[mimeType.toLowerCase()] ?? "bin";
  return `attachments/${randomUUID()}.${ext}`;
}

/** Sanitize a display filename (strip path separators/control chars; keep it short). */
export function safeDisplayFilename(fileName: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = fileName.replace(/[\x00-\x1f\x7f]/g, "").replace(/[\\/]+/g, "_").replace(/[<>:"|?*]/g, "").trim().slice(0, 200);
  return cleaned || "attachment";
}
