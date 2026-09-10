import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CaseDocumentsService } from "./case-documents.service";
import type { PrismaService } from "../../database/prisma.service";
import type { PrivateFileStorageService } from "../../common/storage/private-file-storage.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { ConfigService } from "@nestjs/config";

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    caseId: "case-a",
    title: "Insurance card",
    description: null,
    status: "REQUESTED",
    visibility: "CARE_SEEKER",
    requestedFromSeeker: true,
    fileName: null,
    contentType: null,
    sizeBytes: null,
    storagePath: null,
    uploadedAt: null,
    reviewedAt: null,
    reviewNote: null,
    dueAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function build(overrides: { findMany?: unknown; findFirst?: unknown; update?: unknown; create?: unknown } = {}) {
  const findMany = jest.fn().mockResolvedValue([doc()]);
  const findFirst = jest.fn().mockResolvedValue(doc());
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(doc(data)));
  const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(doc(data)));
  const prisma = {
    caseDocument: {
      findMany: overrides.findMany ?? findMany,
      findFirst: overrides.findFirst ?? findFirst,
      update: overrides.update ?? update,
      create: overrides.create ?? create,
    },
  } as unknown as PrismaService;
  const storage = {
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    uploadBuffer: jest.fn().mockResolvedValue(undefined),
    createSignedDownloadUrl: jest.fn().mockResolvedValue("https://signed.example/file"),
  } as unknown as PrivateFileStorageService;
  const events = { record: jest.fn().mockResolvedValue(undefined) } as unknown as WorkflowEventsService;
  const config = { get: jest.fn().mockReturnValue(300) } as unknown as ConfigService<never, true>;
  const svc = new CaseDocumentsService(prisma, storage, config as never, events);
  return { svc, prisma, storage, events, findMany, findFirst, update, create };
}

describe("CaseDocumentsService", () => {
  describe("visibility", () => {
    it("restricts a family listing to documents marked for them", async () => {
      const { svc, findMany } = build();
      await svc.list("case-a", true);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { caseId: "case-a", visibility: "CARE_SEEKER" } }),
      );
    });

    it("lets staff see every document on the case", async () => {
      const { svc, findMany } = build();
      await svc.list("case-a", false);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { caseId: "case-a" } }));
    });

    it("hides a staff-only document from a family lookup", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const { svc } = build({ findFirst });
      await expect(svc.findOne("case-a", "doc-1", true)).rejects.toBeInstanceOf(NotFoundException);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "doc-1", caseId: "case-a", visibility: "CARE_SEEKER" },
      });
    });

    it("always makes a document requested from the family visible to them", async () => {
      // Asking for something they cannot see would be a dead request.
      const { svc, create } = build();
      await svc.create(
        { caseId: "case-a", organizationId: "org", title: "ID", requestedFromSeeker: true, visibility: "CASE_TEAM" },
        "staff-1",
      );
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibility: "CARE_SEEKER" }) }),
      );
    });

    it("defaults a staff-created document to staff-only", async () => {
      const { svc, create } = build();
      await svc.create({ caseId: "case-a", organizationId: "org", title: "Internal form" }, "staff-1");
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibility: "CASE_TEAM" }) }),
      );
    });
  });

  describe("toView", () => {
    it("never exposes the storage path", () => {
      const view = CaseDocumentsService.toView(doc({ storagePath: "cases/case-a/doc-1/secret.pdf" }) as never);
      expect(JSON.stringify(view)).not.toContain("secret.pdf");
      expect(JSON.stringify(view)).not.toContain("storagePath");
      // The family still learns whether a file is attached.
      expect(view.hasFile).toBe(true);
    });

    it("reports no file when nothing has been uploaded", () => {
      expect(CaseDocumentsService.toView(doc() as never).hasFile).toBe(false);
    });
  });

  describe("upload", () => {
    it("rejects a disallowed file type", async () => {
      const { svc } = build();
      await expect(
        svc.upload(
          {
            caseId: "case-a",
            organizationId: "org",
            documentId: "doc-1",
            seekerOnly: true,
            file: { fileName: "payload.exe", contentType: "application/x-msdownload", contentBase64: "AAAA" },
          },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an empty file", async () => {
      const { svc } = build();
      await expect(
        svc.upload(
          {
            caseId: "case-a",
            organizationId: "org",
            documentId: "doc-1",
            seekerOnly: true,
            file: { fileName: "empty.pdf", contentType: "application/pdf", contentBase64: "" },
          },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("stores under a server-generated path that ignores the uploader's filename", async () => {
      const { svc, storage } = build();
      await svc.upload(
        {
          caseId: "case-a",
          organizationId: "org",
          documentId: "doc-1",
          seekerOnly: true,
          file: { fileName: "../../escape.pdf", contentType: "application/pdf", contentBase64: Buffer.from("hello").toString("base64") },
        },
        "user-1",
      );
      const path = (storage.uploadBuffer as jest.Mock).mock.calls[0][1] as string;
      expect(path).toMatch(/^cases\/case-a\/doc-1\/[0-9a-f-]+\.pdf$/);
      expect(path).not.toContain("..");
    });

    it("clears a previous rejection so a stale reason is not shown beside a new file", async () => {
      const { svc, update } = build();
      await svc.upload(
        {
          caseId: "case-a",
          organizationId: "org",
          documentId: "doc-1",
          seekerOnly: true,
          file: { fileName: "card.pdf", contentType: "application/pdf", contentBase64: Buffer.from("x").toString("base64") },
        },
        "user-1",
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "UPLOADED", reviewNote: null, reviewedAt: null, reviewedByUserId: null }),
        }),
      );
    });
  });

  describe("review", () => {
    it("refuses to review a document with no file yet", async () => {
      const { svc } = build();
      await expect(
        svc.review({ caseId: "case-a", organizationId: "org", documentId: "doc-1", status: "ACCEPTED" }, "staff-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("requires a reason when asking for an update", async () => {
      // "Needs update" with no explanation leaves a family guessing.
      const findFirst = jest.fn().mockResolvedValue(doc({ storagePath: "p", status: "UPLOADED" }));
      const { svc } = build({ findFirst });
      await expect(
        svc.review({ caseId: "case-a", organizationId: "org", documentId: "doc-1", status: "NEEDS_UPDATE" }, "staff-1"),
      ).rejects.toThrow(/Explain what needs to change/);
    });

    it("accepts a reviewed document", async () => {
      const findFirst = jest.fn().mockResolvedValue(doc({ storagePath: "p", status: "UPLOADED" }));
      const { svc, update } = build({ findFirst });
      await svc.review({ caseId: "case-a", organizationId: "org", documentId: "doc-1", status: "ACCEPTED" }, "staff-1");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "ACCEPTED" }) }),
      );
    });
  });

  describe("downloadUrl", () => {
    it("404s when the document carries no file", async () => {
      const { svc } = build();
      await expect(svc.downloadUrl("case-a", "doc-1", true)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a signed url from the private bucket", async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValue(doc({ storagePath: "p", fileName: "card.pdf", contentType: "application/pdf" }));
      const { svc, storage } = build({ findFirst });
      const result = await svc.downloadUrl("case-a", "doc-1", true);
      expect(result.url).toBe("https://signed.example/file");
      expect((storage.createSignedDownloadUrl as jest.Mock).mock.calls[0][0]).toBe("nonnis-case-documents-private");
    });
  });
});
