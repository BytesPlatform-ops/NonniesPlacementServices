import type { PrismaService } from "../../../database/prisma.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { CampaignAudienceService } from "./campaign-audience.service";

function contact(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@x.com`,
    normalizedEmail: `${id}@x.com`,
    firstName: "F",
    lastName: "L",
    organizationName: null,
    status: "ACTIVE",
    preferences: [{ consentStatus: "OPTED_IN" }],
    ...over,
  };
}

function makeService(contacts: Array<ReturnType<typeof contact>>, members: string[] = [], suppressedEmails: string[] = []) {
  const prisma = {
    communicationListMember: { findMany: jest.fn().mockResolvedValue(members.map((contactId) => ({ contactId }))) },
    communicationContact: { findMany: jest.fn().mockResolvedValue(contacts) },
  } as unknown as PrismaService;
  const suppressions = { flagsFor: jest.fn().mockResolvedValue({ emails: new Set(suppressedEmails), phones: new Set() }) } as unknown as SuppressionsService;
  return new CampaignAudienceService(prisma, suppressions);
}

describe("CampaignAudienceService.evaluate (marketing eligibility)", () => {
  it("includes only OPTED_IN, valid, non-suppressed, non-archived contacts", async () => {
    const contacts = [
      contact("in"), // eligible
      contact("unk", { preferences: [{ consentStatus: "UNKNOWN" }] }),
      contact("out", { preferences: [{ consentStatus: "OPTED_OUT" }] }),
      contact("noemail", { normalizedEmail: null, email: null, preferences: [] }),
      contact("arch", { status: "ARCHIVED" }),
    ];
    const svc = makeService(contacts, contacts.map((c) => c.id), ["sup@x.com"]);
    const r = await svc.evaluate({ listIds: ["l1"], contactIds: [] });
    expect(r.eligibleCount).toBe(1);
    expect(r.eligible[0].contactId).toBe("in");
    expect(r.exclusions.CONSENT_UNKNOWN).toBe(1);
    expect(r.exclusions.OPTED_OUT).toBe(1);
    expect(r.exclusions.NO_EMAIL).toBe(1);
    expect(r.exclusions.CONTACT_ARCHIVED).toBe(1);
  });

  it("excludes a suppressed opted-in contact", async () => {
    const svc = makeService([contact("sup", { email: "sup@x.com", normalizedEmail: "sup@x.com" })], ["sup"], ["sup@x.com"]);
    const r = await svc.evaluate({ listIds: ["l1"], contactIds: [] });
    expect(r.eligibleCount).toBe(0);
    expect(r.exclusions.SUPPRESSED).toBe(1);
  });

  it("dedupes the union of lists + explicit contacts", async () => {
    const svc = makeService([contact("a"), contact("b")], ["a", "b"]);
    const r = await svc.evaluate({ listIds: ["l1"], contactIds: ["b"] });
    expect(r.totalUnique).toBe(2);
    expect(r.duplicatesRemoved).toBe(1);
  });
});

// --- SMS channel (15D) ------------------------------------------------------
describe("CampaignAudienceService.evaluateSms", () => {
  function build(contacts: Array<Record<string, unknown>>, suppressedPhones: string[] = []) {
    const prisma = {
      communicationListMember: { findMany: jest.fn().mockResolvedValue(contacts.map((c) => ({ contactId: c.id }))) },
      communicationContact: { findMany: jest.fn().mockResolvedValue(contacts) },
    } as unknown as import("../../../database/prisma.service").PrismaService;
    const suppressions = {
      flagsFor: jest.fn().mockResolvedValue({ emails: new Set<string>(), phones: new Set(suppressedPhones) }),
    } as unknown as import("../suppressions/suppressions.service").SuppressionsService;
    return new CampaignAudienceService(prisma, suppressions);
  }

  const contact = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    phone: "+1 415 555 0161",
    normalizedPhoneE164: "+14155550161",
    firstName: "Ada",
    lastName: "Reyes",
    organizationName: null,
    status: "ACTIVE",
    preferences: [{ consentStatus: "OPTED_IN" }],
    ...over,
  });

  it("includes only opted-in, non-suppressed, active contacts with a valid number", async () => {
    const svc = build([contact("c1")]);
    const r = await svc.evaluateSms({ listIds: ["l1"], contactIds: [] });
    expect(r.eligibleCount).toBe(1);
    expect(r.eligible[0]).toMatchObject({ contactId: "c1", normalizedPhoneE164: "+14155550161" });
  });

  it("excludes UNKNOWN consent — never treated as opted in for marketing", async () => {
    const svc = build([contact("c1", { preferences: [{ consentStatus: "UNKNOWN" }] })]);
    const r = await svc.evaluateSms({ listIds: ["l1"], contactIds: [] });
    expect(r.eligibleCount).toBe(0);
    expect(r.exclusions.CONSENT_UNKNOWN).toBe(1);
  });

  it("excludes a contact with no SMS preference row at all", async () => {
    const svc = build([contact("c1", { preferences: [] })]);
    expect((await svc.evaluateSms({ listIds: ["l1"], contactIds: [] })).exclusions.CONSENT_UNKNOWN).toBe(1);
  });

  it("excludes OPTED_OUT, suppressed, archived, missing and malformed numbers", async () => {
    const svc = build(
      [
        contact("c1", { preferences: [{ consentStatus: "OPTED_OUT" }] }),
        contact("c2", { normalizedPhoneE164: "+14155550162" }),
        contact("c3", { status: "ARCHIVED" }),
        contact("c4", { phone: null, normalizedPhoneE164: null }),
        contact("c5", { normalizedPhoneE164: "12345" }),
      ],
      ["+14155550162"],
    );
    const r = await svc.evaluateSms({ listIds: ["l1"], contactIds: [] });
    expect(r.eligibleCount).toBe(0);
    expect(r.exclusions).toMatchObject({ OPTED_OUT: 1, SUPPRESSED: 1, CONTACT_ARCHIVED: 1, NO_PHONE: 1, INVALID_PHONE: 1 });
  });

  it("dedupes a contact that appears in several selected lists", async () => {
    const one = contact("c1");
    const prisma = {
      communicationListMember: { findMany: jest.fn().mockResolvedValue([{ contactId: "c1" }, { contactId: "c1" }]) },
      communicationContact: { findMany: jest.fn().mockResolvedValue([one]) },
    } as unknown as import("../../../database/prisma.service").PrismaService;
    const suppressions = { flagsFor: jest.fn().mockResolvedValue({ emails: new Set<string>(), phones: new Set<string>() }) } as unknown as import("../suppressions/suppressions.service").SuppressionsService;
    const r = await new CampaignAudienceService(prisma, suppressions).evaluateSms({ listIds: ["l1", "l2"], contactIds: [] });
    expect(r.totalUnique).toBe(1);
    expect(r.duplicatesRemoved).toBe(1);
    expect(r.eligibleCount).toBe(1);
  });
});
