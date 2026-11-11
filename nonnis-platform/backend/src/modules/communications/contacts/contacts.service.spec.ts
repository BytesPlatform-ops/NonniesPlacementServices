import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { ContactsService } from "./contacts.service";
import type { RequestUser } from "../../auth/request-user";

const user = { id: "u1" } as RequestUser;

function makeService(existingOnConflictCheck: Array<{ id: string; normalizedEmail: string | null; normalizedPhoneE164: string | null }> = []) {
  const prisma = {
    communicationContact: { findMany: jest.fn().mockResolvedValue(existingOnConflictCheck) },
  } as unknown as PrismaService;
  const audit = { record: jest.fn() } as unknown as AuditService;
  const suppressions = {} as unknown as SuppressionsService;
  return new ContactsService(prisma, audit, suppressions);
}

describe("ContactsService.create validation", () => {
  it("requires at least a valid email or phone", async () => {
    await expect(makeService().create(user, {})).rejects.toBeInstanceOf(BadRequestException);
  });
  it("rejects an invalid email format", async () => {
    await expect(makeService().create(user, { email: "john@" })).rejects.toThrow(/Invalid email/i);
  });
  it("rejects an invalid phone", async () => {
    await expect(makeService().create(user, { phone: "12345" })).rejects.toThrow(/Invalid phone/i);
  });
  it("rejects a duplicate email against an existing contact", async () => {
    const svc = makeService([{ id: "c1", normalizedEmail: "a@x.com", normalizedPhoneE164: null }]);
    await expect(svc.create(user, { email: "A@X.com" })).rejects.toBeInstanceOf(ConflictException);
  });
  it("flags a CONFLICT when email matches one contact and phone matches a different contact", async () => {
    const svc = makeService([
      { id: "c1", normalizedEmail: "a@x.com", normalizedPhoneE164: null },
      { id: "c2", normalizedEmail: null, normalizedPhoneE164: "+12024561111" },
    ]);
    await expect(svc.create(user, { email: "a@x.com", phone: "(202) 456-1111" })).rejects.toThrow(/two different existing contacts/i);
  });
});

describe("ContactsService.bulkSetConsent", () => {
  function makeBulk(contacts: Array<{ id: string; normalizedEmail: string | null; normalizedPhoneE164: string | null; preferences: Array<{ id: string; consentStatus: string }> }>, suppressedPhones: string[] = []) {
    const updateMany = jest.fn().mockReturnValue("u");
    const createMany = jest.fn().mockReturnValue("c");
    const prisma = {
      communicationContact: { count: jest.fn().mockResolvedValue(contacts.length), findMany: jest.fn().mockResolvedValue(contacts) },
      contactChannelPreference: { updateMany, createMany },
      $transaction: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const suppressions = { flagsFor: jest.fn().mockResolvedValue({ emails: new Set(), phones: new Set(suppressedPhones) }) } as unknown as SuppressionsService;
    return { svc: new ContactsService(prisma, audit, suppressions), updateMany, createMany, prisma, audit };
  }

  const contacts = [
    { id: "a", normalizedEmail: null, normalizedPhoneE164: "+12024561111", preferences: [{ id: "pa", consentStatus: "UNKNOWN" }] },
    { id: "b", normalizedEmail: null, normalizedPhoneE164: "+12024562222", preferences: [{ id: "pb", consentStatus: "OPTED_OUT" }] },
    { id: "c", normalizedEmail: null, normalizedPhoneE164: "+12024563333", preferences: [] },
    { id: "d", normalizedEmail: null, normalizedPhoneE164: "+12024564444", preferences: [{ id: "pd", consentStatus: "UNKNOWN" }] },
    { id: "e", normalizedEmail: "e@x.com", normalizedPhoneE164: null, preferences: [] },
    { id: "f", normalizedEmail: null, normalizedPhoneE164: "+12024565555", preferences: [{ id: "pf", consentStatus: "OPTED_IN" }] },
  ];

  it("requires a consent source to opt contacts in", async () => {
    const { svc } = makeBulk(contacts);
    await expect(svc.bulkSetConsent(user, { channel: "SMS", consentStatus: "OPTED_IN" })).rejects.toThrow(/how consent was collected/i);
  });

  it("never revives an opt-out or a suppressed number, and counts every skip", async () => {
    const { svc, prisma, audit } = makeBulk(contacts, ["+12024564444"]);
    const res = await svc.bulkSetConsent(user, { channel: "SMS", consentStatus: "OPTED_IN", consentSource: "Written consent" });
    expect(res).toMatchObject({ matched: 6, updated: 2, alreadySet: 1, skippedOptedOut: 1, skippedSuppressed: 1, skippedNoAddress: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "communication.consent.bulk_updated" }));
  });

  it("writes nothing on a dry run", async () => {
    const { svc, prisma } = makeBulk(contacts);
    const res = await svc.bulkSetConsent(user, { channel: "SMS", consentStatus: "OPTED_IN", consentSource: "Written consent", dryRun: true });
    expect(res.updated).toBe(3);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
