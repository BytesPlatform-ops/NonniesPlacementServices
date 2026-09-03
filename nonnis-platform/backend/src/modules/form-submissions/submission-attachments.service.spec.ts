import { NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../database/prisma.service";
import type { PrivateFileStorageService } from "../../common/storage/private-file-storage.service";
import { FORM_SUBMISSIONS_BUCKET, SubmissionAttachmentsService, type IncomingFile } from "./submission-attachments.service";

const config = { get: () => 300 } as unknown as ConfigService;

function build(opts: { uploadFails?: boolean; row?: unknown } = {}) {
  const create = jest.fn().mockResolvedValue({});
  const uploadBuffer = opts.uploadFails
    ? jest.fn().mockRejectedValue(new Error("bucket unavailable"))
    : jest.fn().mockResolvedValue(undefined);
  const createSignedDownloadUrl = jest.fn().mockResolvedValue("https://signed.example/x");
  const prisma = {
    websiteFormSubmissionAttachment: {
      create,
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(opts.row ?? null),
    },
  } as unknown as PrismaService;
  const storage = { uploadBuffer, createSignedDownloadUrl } as unknown as PrivateFileStorageService;
  return { svc: new SubmissionAttachmentsService(prisma, storage, config as never), create, uploadBuffer, createSignedDownloadUrl };
}

const pdf = (over: Partial<IncomingFile> = {}): IncomingFile => ({
  kind: "REPORT",
  fileName: "Submission-REF.pdf",
  contentType: "application/pdf",
  contentBase64: Buffer.from("%PDF-1.4 fake").toString("base64"),
  ...over,
});

describe("SubmissionAttachmentsService.storeMany", () => {
  it("stores an allowed file into the private bucket and records it", async () => {
    const { svc, create, uploadBuffer } = build();
    await expect(svc.storeMany("sub-1", "REF-1", [pdf()])).resolves.toBe(1);
    expect(uploadBuffer).toHaveBeenCalledWith(FORM_SUBMISSIONS_BUCKET, expect.any(String), expect.any(Buffer), "application/pdf");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "REPORT", contentType: "application/pdf" }) }));
  });

  it("never derives the storage path from the submitter's filename", async () => {
    const { svc, uploadBuffer } = build();
    await svc.storeMany("sub-1", "REF-1", [pdf({ fileName: "../../etc/passwd.pdf" })]);
    const path = uploadBuffer.mock.calls[0]![1] as string;
    expect(path).toMatch(/^submissions\/sub-1\/[0-9a-f-]{36}\.pdf$/);
    expect(path).not.toContain("passwd");
  });

  it("skips a disallowed file type without failing the whole submission", async () => {
    const { svc, create } = build();
    const bad = pdf({ fileName: "payload.exe", contentType: "application/x-msdownload" });
    await expect(svc.storeMany("sub-1", "REF-1", [bad, pdf()])).resolves.toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns a count rather than throwing when storage is unavailable", async () => {
    const { svc, create } = build({ uploadFails: true });
    await expect(svc.storeMany("sub-1", "REF-1", [pdf()])).resolves.toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("does nothing for an empty file list", async () => {
    const { svc, uploadBuffer } = build();
    await expect(svc.storeMany("sub-1", "REF-1", [])).resolves.toBe(0);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });
});

describe("SubmissionAttachmentsService.downloadUrl", () => {
  it("mints a short-lived signed url scoped to the submission", async () => {
    const { svc, createSignedDownloadUrl } = build({ row: { storagePath: "submissions/s/a.pdf", fileName: "Record.pdf" } });
    await expect(svc.downloadUrl("sub-1", "att-1")).resolves.toEqual({ url: "https://signed.example/x", fileName: "Record.pdf" });
    expect(createSignedDownloadUrl).toHaveBeenCalledWith(FORM_SUBMISSIONS_BUCKET, "submissions/s/a.pdf", 300, "Record.pdf");
  });

  it("404s an attachment that belongs to a different submission", async () => {
    const { svc, createSignedDownloadUrl } = build({ row: null });
    await expect(svc.downloadUrl("other-sub", "att-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(createSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
