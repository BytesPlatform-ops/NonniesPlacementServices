import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CaseDocumentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PrivateFileStorageService } from "../../common/storage/private-file-storage.service";
import type { AppConfig } from "../../config/configuration";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
// The platform already has one definition of what it accepts as an uploaded
// file — MIME allowlist, size cap, filename sanitising. Case documents reuse it
// rather than introducing a second, divergent policy.
import { safeDisplayFilename, validateAttachment } from "../communications/email/attachment-policy";

/** Dedicated PRIVATE bucket, separate from submissions and communications. */
export const CASE_DOCUMENTS_BUCKET = "nonnis-case-documents-private";

export interface CaseDocumentView {
  id: string;
  title: string;
  description: string | null;
  status: CaseDocumentStatus;
  statusLabel: string;
  visibility: string;
  requestedFromSeeker: boolean;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  hasFile: boolean;
  uploadedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  dueAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<CaseDocumentStatus, string> = {
  REQUESTED: "Required",
  UPLOADED: "Uploaded",
  ACCEPTED: "Accepted",
  NEEDS_UPDATE: "Needs update",
};

export interface UploadInput {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

/**
 * Case documents, shared by the staff console and the family portal.
 *
 * Authorization is deliberately NOT done here: staff reach these methods
 * through `ensureCaseAccess` and families through `SeekerCaseAccessService`, so
 * every method takes a case id that has already been proven. Keeping one
 * service means the two front doors cannot drift into different rules about
 * what a document is or how a file is stored.
 *
 * File bytes live in a private bucket; only the object key is persisted and it
 * is never returned. Downloads are short-lived signed URLs.
 */
@Injectable()
export class CaseDocumentsService {
  private readonly logger = new Logger(CaseDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateFileStorageService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly workflowEvents: WorkflowEventsService,
  ) {}

  static toView(row: {
    id: string;
    title: string;
    description: string | null;
    status: CaseDocumentStatus;
    visibility: string;
    requestedFromSeeker: boolean;
    fileName: string | null;
    contentType: string | null;
    sizeBytes: number | null;
    storagePath: string | null;
    uploadedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    dueAt: Date | null;
    createdAt: Date;
  }): CaseDocumentView {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      visibility: row.visibility,
      requestedFromSeeker: row.requestedFromSeeker,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      // The path itself is an internal key, never an address handed out.
      hasFile: row.storagePath !== null,
      uploadedAt: row.uploadedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      dueAt: row.dueAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Documents on a case. `seekerOnly` restricts to what a family may see. */
  async list(caseId: string, seekerOnly: boolean): Promise<CaseDocumentView[]> {
    const where: Prisma.CaseDocumentWhereInput = seekerOnly
      ? { caseId, visibility: "CARE_SEEKER" }
      : { caseId };
    const rows = await this.prisma.caseDocument.findMany({ where, orderBy: [{ createdAt: "asc" }] });
    return rows.map((r) => CaseDocumentsService.toView(r));
  }

  /** One document, 404 when it is not on this case or not family-visible. */
  async findOne(caseId: string, documentId: string, seekerOnly: boolean) {
    const row = await this.prisma.caseDocument.findFirst({
      where: { id: documentId, caseId, ...(seekerOnly ? { visibility: "CARE_SEEKER" as const } : {}) },
    });
    if (!row) throw new NotFoundException(`Document ${documentId} not found`);
    return row;
  }

  async create(
    input: {
      caseId: string;
      organizationId: string;
      title: string;
      description?: string | null;
      requestedFromSeeker?: boolean;
      visibility?: "CASE_TEAM" | "CARE_SEEKER";
      dueAt?: Date | null;
    },
    actorUserId: string,
  ): Promise<CaseDocumentView> {
    // Asking the family for something they cannot see would be a dead request,
    // so a seeker request is always family-visible.
    const visibility = input.requestedFromSeeker ? "CARE_SEEKER" : (input.visibility ?? "CASE_TEAM");
    const row = await this.prisma.caseDocument.create({
      data: {
        caseId: input.caseId,
        title: input.title,
        description: input.description ?? null,
        requestedFromSeeker: input.requestedFromSeeker ?? false,
        visibility,
        dueAt: input.dueAt ?? null,
        requestedByUserId: actorUserId,
        status: "REQUESTED",
      },
    });
    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: "DOCUMENT_REQUESTED",
      actorUserId,
      source: "MANUAL",
      metadata: { documentId: row.id, title: row.title, fromFamily: row.requestedFromSeeker },
    });
    return CaseDocumentsService.toView(row);
  }

  /**
   * Attaches a file to a document request.
   *
   * The object key is generated server-side from the document id and a random
   * name: an uploader's filename never shapes the storage path, so it cannot
   * traverse or collide. The display name is sanitised separately.
   */
  async upload(
    input: { caseId: string; organizationId: string; documentId: string; file: UploadInput; seekerOnly: boolean },
    actorUserId: string,
  ): Promise<CaseDocumentView> {
    const doc = await this.findOne(input.caseId, input.documentId, input.seekerOnly);

    const buffer = Buffer.from(input.file.contentBase64, "base64");
    // Rejects an unsupported or dangerous type, a mismatched extension, and
    // anything empty or oversized — and returns the extension to store under.
    const ext = validateAttachment(input.file.fileName, input.file.contentType, buffer.length);

    const path = `cases/${input.caseId}/${doc.id}/${randomUUID()}.${ext}`;
    await this.storage.ensureBucket(CASE_DOCUMENTS_BUCKET);
    await this.storage.uploadBuffer(CASE_DOCUMENTS_BUCKET, path, buffer, input.file.contentType);

    const row = await this.prisma.caseDocument.update({
      where: { id: doc.id },
      data: {
        fileName: safeDisplayFilename(input.file.fileName),
        contentType: input.file.contentType,
        sizeBytes: buffer.length,
        storagePath: path,
        uploadedByUserId: actorUserId,
        uploadedAt: new Date(),
        status: "UPLOADED",
        // A replacement clears the previous rejection so the family is not left
        // looking at a stale "needs update" reason next to a new file.
        reviewNote: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
    });

    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: "DOCUMENT_UPLOADED",
      actorUserId,
      source: "MANUAL",
      metadata: { documentId: row.id, title: row.title },
    });
    return CaseDocumentsService.toView(row);
  }

  /** Staff review outcome: accept, or send it back with a reason. */
  async review(
    input: {
      caseId: string;
      organizationId: string;
      documentId: string;
      status: "ACCEPTED" | "NEEDS_UPDATE";
      reviewNote?: string | null;
    },
    actorUserId: string,
  ): Promise<CaseDocumentView> {
    const doc = await this.findOne(input.caseId, input.documentId, false);
    if (!doc.storagePath) throw new BadRequestException("This document has no file to review yet.");
    if (input.status === "NEEDS_UPDATE" && !input.reviewNote?.trim()) {
      // "Needs update" without a reason leaves a family guessing what to fix.
      throw new BadRequestException("Explain what needs to change when asking for an update.");
    }

    const row = await this.prisma.caseDocument.update({
      where: { id: doc.id },
      data: {
        status: input.status,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: actorUserId,
      },
    });
    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: input.status === "ACCEPTED" ? "DOCUMENT_ACCEPTED" : "DOCUMENT_UPDATE_REQUESTED",
      actorUserId,
      source: "MANUAL",
      metadata: { documentId: row.id, title: row.title },
    });
    return CaseDocumentsService.toView(row);
  }

  /** A short-lived signed URL. 404 when the document carries no file. */
  async downloadUrl(
    caseId: string,
    documentId: string,
    seekerOnly: boolean,
  ): Promise<{ url: string; fileName: string; contentType: string }> {
    const doc = await this.findOne(caseId, documentId, seekerOnly);
    if (!doc.storagePath || !doc.fileName || !doc.contentType) {
      throw new NotFoundException("This document has no file to download.");
    }
    const ttl = this.config.get("communicationsAttachmentUrlTtlSeconds", { infer: true });
    const url = await this.storage.createSignedDownloadUrl(
      CASE_DOCUMENTS_BUCKET,
      doc.storagePath,
      ttl,
      doc.fileName,
    );
    return { url, fileName: doc.fileName, contentType: doc.contentType };
  }
}
