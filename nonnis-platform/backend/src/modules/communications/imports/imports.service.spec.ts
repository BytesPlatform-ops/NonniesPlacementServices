import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import type { ListsService } from "../lists/lists.service";
import type { TagsService } from "../tags/tags.service";
import { ImportsService } from "./imports.service";
import type { ImportPreviewDto } from "../dto/imports.dto";

function makeService(opts: { existing?: Array<{ id: string; normalizedEmail: string | null; normalizedPhoneE164: string | null }>; suppressedEmails?: string[] } = {}) {
  const findMany = jest.fn().mockResolvedValue(opts.existing ?? []);
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    communicationContact: { findMany, createMany },
    contactChannelPreference: { createMany },
    communicationImportBatch: { create: jest.fn().mockResolvedValue({ id: "batch-1" }) },
  } as unknown as PrismaService;
  const suppressions = {
    flagsFor: jest.fn().mockResolvedValue({ emails: new Set(opts.suppressedEmails ?? []), phones: new Set() }),
  } as unknown as SuppressionsService;
  const audit = { record: jest.fn() } as unknown as AuditService;
  const svc = new ImportsService(prisma, audit, suppressions, {} as ListsService, {} as TagsService);
  return { svc, findMany, createMany };
}

const paste = (content: string): ImportPreviewDto => ({ sourceType: "PASTE", mode: "EMAIL", content } as ImportPreviewDto);

describe("ImportsService.preview (paste emails)", () => {
  it("classifies valid/invalid/in-batch-duplicate rows and never mutates the DB", async () => {
    const { svc, createMany } = makeService();
    const res = await svc.preview(paste("a@x.com\nA@X.com\nnot-an-email\nb@x.com"));
    expect(res.counts).toEqual({ total: 4, new: 2, duplicate: 1, invalid: 1, conflict: 0, suppressed: 0 });
    // A@X.com duplicates a@x.com within the batch.
    const dup = res.sampleRows.find((r) => r.status === "DUPLICATE");
    expect(dup?.issue).toMatch(/within this import/i);
    // preview must NOT insert anything.
    expect(createMany).not.toHaveBeenCalled();
  });

  it("marks a row DUPLICATE when it already exists in the database", async () => {
    const { svc } = makeService({ existing: [{ id: "c1", normalizedEmail: "a@x.com", normalizedPhoneE164: null }] });
    const res = await svc.preview(paste("a@x.com\nnew@x.com"));
    expect(res.counts.duplicate).toBe(1);
    expect(res.counts.new).toBe(1);
  });

  it("marks a row SUPPRESSED when the address is actively suppressed", async () => {
    const { svc } = makeService({ suppressedEmails: ["a@x.com"] });
    const res = await svc.preview(paste("a@x.com\nb@x.com"));
    expect(res.counts.suppressed).toBe(1);
    expect(res.counts.new).toBe(1);
    expect(res.sampleRows.find((r) => r.status === "SUPPRESSED")?.email).toBe("a@x.com");
  });
});

describe("ImportsService.preview (CSV)", () => {
  it("uses column mapping and flags an invalid mapped email", async () => {
    const { svc } = makeService();
    const csv = "Name,Mail,Company\nJohn,john@x.com,Acme\nJane,bad-email,Globex";
    const res = await svc.preview({ sourceType: "CSV", content: csv, mapping: { firstName: 0, email: 1, organization: 2 } } as ImportPreviewDto);
    expect(res.counts.total).toBe(2);
    expect(res.counts.new).toBe(1);
    expect(res.counts.invalid).toBe(1);
  });

  it("rejects a CSV import with no email/phone mapping", async () => {
    const { svc } = makeService();
    await expect(svc.preview({ sourceType: "CSV", content: "A,B\n1,2", mapping: { firstName: 0 } } as ImportPreviewDto)).rejects.toThrow(/Map at least/i);
  });
});
