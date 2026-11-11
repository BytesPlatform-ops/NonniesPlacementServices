import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import type { ListsService } from "../lists/lists.service";
import type { TagsService } from "../tags/tags.service";
import { ImportsService } from "./imports.service";
import type { ImportCommitDto, ImportPreviewDto } from "../dto/imports.dto";

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

describe("ImportsService consent", () => {
  const csv = "Name,Phone,SMS ok\nAda,(202) 456-1111,yes\nBen,(202) 456-2222,no\nCal,(202) 456-3333,";

  it("reads a consent column and requires a source before recording opt-ins", async () => {
    const { svc } = makeService();
    const dto = { sourceType: "CSV", content: csv, mapping: { firstName: 0, phone: 1, smsConsent: 2 } } as ImportPreviewDto;
    await expect(svc.preview(dto)).rejects.toThrow(/how consent was collected/i);
    const res = await svc.preview({ ...dto, consent: { source: "Website opt-in" } } as ImportPreviewDto);
    expect(res.consentCounts).toEqual({ emailOptedIn: 0, emailOptedOut: 0, smsOptedIn: 1, smsOptedOut: 1 });
    expect(res.sampleRows.map((r) => r.smsConsent)).toEqual(["OPTED_IN", "OPTED_OUT", null]);
  });

  it("applies a whole-file attestation but keeps a per-row opt-out", async () => {
    const { svc } = makeService();
    const res = await svc.preview({
      sourceType: "CSV",
      content: csv,
      mapping: { firstName: 0, phone: 1, smsConsent: 2 },
      consent: { sms: true, source: "Written consent" },
    } as ImportPreviewDto);
    expect(res.sampleRows.map((r) => r.smsConsent)).toEqual(["OPTED_IN", "OPTED_OUT", "OPTED_IN"]);
  });

  it("does not need a source when the file only records opt-outs", async () => {
    const { svc } = makeService();
    const res = await svc.preview({ sourceType: "CSV", content: "Phone,SMS\n(202) 456-2222,stop", mapping: { phone: 0, smsConsent: 1 } } as ImportPreviewDto);
    expect(res.consentCounts.smsOptedOut).toBe(1);
  });
});

describe("ImportsService.commit (legacy smsConsentSource)", () => {
  it("records SMS consent on the imported contact, with the given source", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([]) // duplicate lookup
      .mockResolvedValueOnce([{ id: "c1", normalizedEmail: null, normalizedPhoneE164: "+12127365000" }]) // created ids
      .mockResolvedValueOnce([{ id: "c1", normalizedEmail: null, normalizedPhoneE164: "+12127365000", preferences: [{ id: "p1", channel: "SMS", consentStatus: "UNKNOWN" }] }]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const audit = { record: jest.fn() };
    const prisma = {
      communicationContact: { findMany, createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      contactChannelPreference: { createMany: jest.fn().mockResolvedValue({ count: 1 }), updateMany },
      communicationImportBatch: { create: jest.fn().mockResolvedValue({ id: "batch-1" }) },
    } as unknown as PrismaService;
    const suppressions = { flagsFor: jest.fn().mockResolvedValue({ emails: new Set(), phones: new Set() }) } as unknown as SuppressionsService;
    const svc = new ImportsService(prisma, audit as unknown as AuditService, suppressions, {} as ListsService, {} as TagsService);

    const res = await svc.commit({ id: "staff-1" } as never, {
      sourceType: "PASTE",
      mode: "PHONE",
      content: "(212) 736-5000",
      defaultCountry: "US",
      smsConsentSource: "Written consent",
    } as ImportCommitDto);

    expect(res.consentApplied.smsOptedIn).toBe(1);
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["p1"] } },
      data: { consentStatus: "OPTED_IN", consentSource: "Import: Written consent", updatedByUserId: "staff-1" },
    });
    expect(audit.record.mock.calls[0][0].metadata).toMatchObject({ consentSource: "Import: Written consent" });
  });
});
