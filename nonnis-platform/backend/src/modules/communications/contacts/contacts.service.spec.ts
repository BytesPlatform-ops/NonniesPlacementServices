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
