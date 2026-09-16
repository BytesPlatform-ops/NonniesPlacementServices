import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import { evaluateChannelEligibility } from "../eligibility";
import { CONSENT_SOURCE_ONBOARDING, UserContactService } from "./user-contact.service";

const USER = { id: "user-1", email: "jordan@example.com" } as RequestUser;

interface Harness {
  /** The contact already linked to this account, if any. */
  existing?: { id: string; normalizedPhoneE164: string | null; consent?: "UNKNOWN" | "OPTED_IN" | "OPTED_OUT" } | null;
  /** A contact holding the submitted number that is NOT this account's. */
  clash?: { id: string; userId: string | null } | null;
  /** An unlinked contact already in the book under the same email. */
  byEmail?: { id: string; userId: string | null } | null;
  /** Make the create collide, as a concurrent first-time submission would. */
  createRaces?: boolean;
}

function build(h: Harness = {}) {
  const contactCreate = jest.fn();
  const contactUpdate = jest.fn().mockResolvedValue({});
  const prefUpsert = jest.fn().mockResolvedValue({});
  const auditRecord = jest.fn().mockResolvedValue({});

  if (h.createRaces) {
    contactCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }));
  } else {
    contactCreate.mockResolvedValue({ id: "contact-new" });
  }

  // findUnique({ where: { userId } }) is called before the transaction and again
  // at the end to build the response; findUnique({ where: { normalizedEmail } })
  // and the race re-read happen inside it.
  const readAfter = {
    phone: "+1 415 555 0100",
    normalizedPhoneE164: "+14155550100",
    preferences: [{ consentStatus: "OPTED_IN", consentSource: CONSENT_SOURCE_ONBOARDING, consentAt: new Date(), optOutAt: null }],
  };
  let userLookups = 0;
  const contactFindUnique = jest.fn().mockImplementation((args: { where: Record<string, unknown>; select?: unknown }) => {
    if ("userId" in args.where) {
      userLookups += 1;
      // First call: the pre-transaction read. Later calls: the race re-read and
      // the response read, which must see a row.
      if (userLookups === 1) {
        return Promise.resolve(
          h.existing
            ? { id: h.existing.id, normalizedPhoneE164: h.existing.normalizedPhoneE164, preferences: [{ consentStatus: h.existing.consent ?? "UNKNOWN" }] }
            : null,
        );
      }
      return Promise.resolve(h.createRaces ? { id: "contact-won", ...readAfter } : { id: "contact-new", ...readAfter });
    }
    return Promise.resolve(h.byEmail ?? null);
  });

  const tx = {
    communicationContact: { findUnique: contactFindUnique, create: contactCreate, update: contactUpdate },
    contactChannelPreference: { upsert: prefUpsert },
  };
  const prisma = {
    communicationContact: { findUnique: contactFindUnique, findFirst: jest.fn().mockResolvedValue(h.clash ?? null), update: contactUpdate },
    user: { findUnique: jest.fn().mockResolvedValue({ email: USER.email, firstName: "Jordan", lastName: "Rivera" }) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const svc = new UserContactService(prisma, { record: auditRecord } as unknown as AuditService);
  return { svc, contactCreate, contactUpdate, prefUpsert, auditRecord };
}

/** The real campaign policy, so these assertions mean what they claim. */
function eligible(consentStatus: "UNKNOWN" | "OPTED_IN" | "OPTED_OUT", hasPhone = true) {
  return evaluateChannelEligibility({
    channel: "SMS",
    archived: false,
    hasAddress: hasPhone,
    addressValid: hasPhone,
    consentStatus,
    suppressed: false,
  }).eligible;
}

describe("UserContactService — onboarding", () => {
  it("creates a contact linked to the account and opts in when consent is given", async () => {
    const { svc, contactCreate, prefUpsert } = build();
    const out = await svc.savePreferences(USER, { phone: "(415) 555-0100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });

    const created = contactCreate.mock.calls[0]![0].data;
    expect(created.userId).toBe("user-1");
    expect(created.source).toBe("SEEKER_ONBOARDING");
    expect(created.normalizedPhoneE164).toBe("+14155550100"); // normalized to E.164
    expect(prefUpsert.mock.calls[0]![0].create.consentStatus).toBe("OPTED_IN");
    expect(prefUpsert.mock.calls[0]![0].create.consentSource).toBe(CONSENT_SOURCE_ONBOARDING);
    expect(out.smsEnabled).toBe(true);
  });

  it("stores the number but leaves consent UNKNOWN when the question is skipped", async () => {
    // Entering a phone number is not agreeing to be texted.
    const { svc, contactCreate, prefUpsert } = build();
    await svc.savePreferences(USER, { phone: "+14155550100", source: CONSENT_SOURCE_ONBOARDING });

    expect(contactCreate.mock.calls[0]![0].data.normalizedPhoneE164).toBe("+14155550100");
    expect(prefUpsert.mock.calls[0]![0].create.consentStatus).toBe("UNKNOWN");
    expect(prefUpsert.mock.calls[0]![0].create.consentSource).toBeNull();
    expect(eligible("UNKNOWN")).toBe(false);
  });

  it("records an explicit decline as OPTED_OUT, not as UNKNOWN", async () => {
    const { svc, prefUpsert } = build();
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: false, source: CONSENT_SOURCE_ONBOARDING });
    expect(prefUpsert.mock.calls[0]![0].create.consentStatus).toBe("OPTED_OUT");
    expect(eligible("OPTED_OUT")).toBe(false);
  });

  it("rejects a number that is not a valid phone number", async () => {
    const { svc } = build();
    await expect(svc.savePreferences(USER, { phone: "not a phone", source: CONSENT_SOURCE_ONBOARDING })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("UserContactService — idempotency and identity", () => {
  it("submitting the same details twice does not create a second contact", async () => {
    const { svc, contactCreate, contactUpdate } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(contactCreate).not.toHaveBeenCalled();
    expect(contactUpdate).toHaveBeenCalled();
  });

  it("does not move the opt-in timestamp when consent is unchanged", async () => {
    const { svc, prefUpsert } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(prefUpsert.mock.calls[0]![0].update.consentAt).toBeUndefined();
  });

  it("adopts an existing unlinked contact with the same email instead of duplicating the person", async () => {
    const { svc, contactCreate, contactUpdate } = build({ byEmail: { id: "contact-crm", userId: null } });
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(contactCreate).not.toHaveBeenCalled();
    expect(contactUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contact-crm" }, data: { userId: "user-1" } }));
  });

  it("resolves a concurrent first-time submission onto the winning row", async () => {
    // Two requests race; the unique account link settles it and the loser must
    // adopt the winner rather than fail or duplicate.
    const { svc, contactCreate } = build({ createRaces: true });
    const out = await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(contactCreate).toHaveBeenCalledTimes(1);
    expect(out.smsEnabled).toBe(true);
  });

  it("refuses a number already on file for a different person", async () => {
    // Taking it over would hand this account someone else's conversation history.
    const { svc } = build({ clash: { id: "contact-other", userId: "user-2" } });
    await expect(svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("UserContactService — phone changes reset consent", () => {
  it("resets consent to UNKNOWN when the number changes without a fresh answer", async () => {
    // Consent describes permission to text ONE number.
    const { svc, prefUpsert, auditRecord } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+12065550199", source: CONSENT_SOURCE_ONBOARDING });

    expect(prefUpsert.mock.calls[0]![0].update.consentStatus).toBe("UNKNOWN");
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ action: "communication.contact.phone_changed" }));
  });

  it("honours a fresh opt-in given at the same time as the new number", async () => {
    const { svc, prefUpsert } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+12065550199", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(prefUpsert.mock.calls[0]![0].update.consentStatus).toBe("OPTED_IN");
  });

  it("never writes a phone number into the audit trail", async () => {
    const { svc, auditRecord } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+12065550199", source: CONSENT_SOURCE_ONBOARDING });
    const serialized = JSON.stringify(auditRecord.mock.calls);
    expect(serialized).not.toContain("2065550199");
    expect(serialized).not.toContain("4155550100");
  });

  it("audits the consent transition with both the previous and new state", async () => {
    const { svc, auditRecord } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "UNKNOWN" } });
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "communication.consent.updated",
        metadata: expect.objectContaining({ previous: "UNKNOWN", next: "OPTED_IN", source: CONSENT_SOURCE_ONBOARDING }),
      }),
    );
  });

  it("writes no consent audit entry when nothing about consent changed", async () => {
    const { svc, auditRecord } = build({ existing: { id: "contact-1", normalizedPhoneE164: "+14155550100", consent: "OPTED_IN" } });
    await svc.savePreferences(USER, { phone: "+14155550100", smsConsent: true, source: CONSENT_SOURCE_ONBOARDING });
    expect(auditRecord.mock.calls.filter((c) => c[0].action === "communication.consent.updated")).toHaveLength(0);
  });
});

describe("campaign eligibility follows the consent the seeker actually gave", () => {
  it("only an explicit opt-in with a phone number is eligible", () => {
    expect(eligible("OPTED_IN")).toBe(true);
    expect(eligible("UNKNOWN")).toBe(false);
    expect(eligible("OPTED_OUT")).toBe(false);
    expect(eligible("OPTED_IN", false)).toBe(false); // opted in, but no number
  });
});
