import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FormSubmissionFileKind } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PrivateFileStorageService } from "../../common/storage/private-file-storage.service";
import type { AppConfig } from "../../config/configuration";
// Pure policy helpers (MIME allowlist, size limits, filename sanitising). They
// carry no module state, so reusing them here keeps one definition of what the
// platform accepts as an uploaded file.
import {
  ATTACHMENT_MIME_EXT,
  MAX_ATTACHMENT_BYTES,
  safeDisplayFilename,
  validateAttachment,
} from "../communications/email/attachment-policy";

/** Dedicated PRIVATE bucket — separate from communication attachments. */
export const FORM_SUBMISSIONS_BUCKET = "nonnis-form-submissions-private";

/** Website submissions may carry the generated PDF plus a few uploads. */
export const MAX_SUBMISSION_FILES = 6;

/**
 * Types a browser renders safely inline. Deliberately narrow: HTML and SVG are
 * excluded because serving them inline would execute their script in the
 * storage origin's context. Everything else is download-only.
 */
const PREVIEWABLE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv"]);

export function isPreviewableType(contentType: string): boolean {
  return PREVIEWABLE_TYPES.has(contentType.toLowerCase());
}

export interface IncomingFile {
  kind: FormSubmissionFileKind;
  fileName: string;
  contentType: string;
  contentBase64: string;
}

export interface SubmissionAttachmentView {
  id: string;
  kind: FormSubmissionFileKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  /** Whether the CRM can show this inline instead of only offering a download. */
  previewable: boolean;
}

@Injectable()
export class SubmissionAttachmentsService {
  private readonly logger = new Logger(SubmissionAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateFileStorageService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Server-generated object key. The submitter's filename never shapes the path. */
  private buildPath(submissionId: string, contentType: string): string {
    const ext = ATTACHMENT_MIME_EXT[contentType.toLowerCase()] ?? "bin";
    return `submissions/${submissionId}/${randomUUID()}.${ext}`;
  }

  /**
   * Persist the files that arrived with a submission.
   *
   * Storage failures are deliberately non-fatal: the submission record and the
   * submitter's email are the durable outcome, and losing a file copy must not
   * turn a successful enquiry into a failed one. Whatever is stored is recorded;
   * whatever fails is logged with the submission reference and simply absent.
   * Returns the number of files actually stored.
   */
  async storeMany(submissionId: string, reference: string, files: IncomingFile[]): Promise<number> {
    if (files.length === 0) return 0;
    if (files.length > MAX_SUBMISSION_FILES) {
      throw new BadRequestException(`A submission may carry at most ${MAX_SUBMISSION_FILES} files.`);
    }

    let stored = 0;
    for (const file of files) {
      try {
        const buffer = Buffer.from(file.contentBase64, "base64");
        // Validate the decoded size, not the claimed one.
        validateAttachment(file.fileName, file.contentType, buffer.byteLength, MAX_ATTACHMENT_BYTES);
        const path = this.buildPath(submissionId, file.contentType);
        await this.storage.uploadBuffer(FORM_SUBMISSIONS_BUCKET, path, buffer, file.contentType);
        await this.prisma.websiteFormSubmissionAttachment.create({
          data: {
            submissionId,
            kind: file.kind,
            fileName: safeDisplayFilename(file.fileName),
            contentType: file.contentType.toLowerCase(),
            sizeBytes: buffer.byteLength,
            storagePath: path,
          },
        });
        stored += 1;
      } catch (err) {
        this.logger.warn(
          `Could not store "${safeDisplayFilename(file.fileName)}" for submission ${reference}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
    return stored;
  }

  async listFor(submissionId: string): Promise<SubmissionAttachmentView[]> {
    const rows = await this.prisma.websiteFormSubmissionAttachment.findMany({
      where: { submissionId },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      select: { id: true, kind: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true },
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), previewable: isPreviewableType(r.contentType) }));
  }

  /**
   * Mint a short-lived signed URL for one attachment. The storage path is never
   * exposed; the attachment is addressed by its id and must belong to the given
   * submission, so an id from another submission cannot be fetched through it.
   *
   * `mode` picks the Content-Disposition: "download" saves the file, "preview"
   * serves it inline so staff can read a PDF or view an image without first
   * downloading it. Preview is only offered for types a browser renders safely
   * — never for arbitrary types, which would let a stored file be served inline
   * on a real origin.
   */
  async downloadUrl(
    submissionId: string,
    attachmentId: string,
    mode: "download" | "preview" = "download",
  ): Promise<{ url: string; fileName: string; contentType: string; previewable: boolean }> {
    const row = await this.prisma.websiteFormSubmissionAttachment.findFirst({
      where: { id: attachmentId, submissionId },
      select: { storagePath: true, fileName: true, contentType: true },
    });
    if (!row) throw new NotFoundException("Attachment not found");

    const previewable = isPreviewableType(row.contentType);
    const inline = mode === "preview" && previewable;
    const ttl = this.config.get("communicationsAttachmentUrlTtlSeconds", { infer: true });
    const url = await this.storage.createSignedDownloadUrl(
      FORM_SUBMISSIONS_BUCKET,
      row.storagePath,
      ttl,
      inline ? undefined : row.fileName,
    );
    return { url, fileName: row.fileName, contentType: row.contentType, previewable };
  }
}
