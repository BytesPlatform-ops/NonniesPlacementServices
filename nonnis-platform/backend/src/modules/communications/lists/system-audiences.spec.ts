import type { PrismaService } from "../../../database/prisma.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { CampaignAudienceService } from "../email/campaign-audience.service";
import { SYSTEM_AUDIENCE_KEYS, isSystemAudienceKey, systemAudience } from "./system-audiences";

const CURATED = "11111111-1111-1111-1111-111111111111";
const DERIVED = "22222222-2222-2222-2222-222222222222";

function build(opts: { lists?: Array<{ id: string; systemKey: string | null }>; memberRows?: string[]; predicateRows?: string[] } = {}) {
  const listFindMany = jest.fn().mockResolvedValue(opts.lists ?? []);
  const memberFindMany = jest.fn().mockResolvedValue((opts.memberRows ?? []).map((contactId) => ({ contactId })));
  const contactFindMany = jest.fn().mockResolvedValue((opts.predicateRows ?? []).map((id) => ({ id })));

  const prisma = {
    communicationList: { findMany: listFindMany },
    communicationListMember: { findMany: memberFindMany },
    communicationContact: { findMany: contactFindMany },
  } as unknown as PrismaService;

  const svc = new CampaignAudienceService(prisma, { flagsFor: jest.fn() } as unknown as SuppressionsService);
  return { svc, listFindMany, memberFindMany, contactFindMany };
}

describe("system audience definitions", () => {
  it("recognises only declared keys", () => {
    expect(isSystemAudienceKey(SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN)).toBe(true);
    for (const bad of [null, undefined, "", "SMS_OPTED_OUT", "ALL_CONTACTS"]) {
      expect(isSystemAudienceKey(bad)).toBe(false);
      expect(systemAudience(bad)).toBeNull();
    }
  });

  it("selects membership on explicit opt-in only", () => {
    // UNKNOWN must never be treated as consent, so the predicate names the value.
    const where = systemAudience(SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN)!.where;
    expect(where).toEqual({ preferences: { some: { channel: "SMS", consentStatus: "OPTED_IN" } } });
  });

  it("carries no send-eligibility rules, which belong to the shared policy", () => {
    // Suppression / archived / phone validity stay in evaluateChannelEligibility so
    // the Review screen can still show audience members against eligible ones.
    const json = JSON.stringify(systemAudience(SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN)!.where);
    for (const leaked of ["ARCHIVED", "suppress", "normalizedPhoneE164"]) {
      expect(json).not.toContain(leaked);
    }
  });
});

describe("CampaignAudienceService.resolveContactIds — curated vs derived", () => {
  it("reads membership rows for a curated list", async () => {
    const { svc, memberFindMany, contactFindMany } = build({
      lists: [{ id: CURATED, systemKey: null }],
      memberRows: ["c-1", "c-2"],
    });
    const out = await svc.resolveContactIds({ listIds: [CURATED], contactIds: [] });
    expect(out.unique).toEqual(["c-1", "c-2"]);
    expect(memberFindMany).toHaveBeenCalled();
    expect(contactFindMany).not.toHaveBeenCalled();
  });

  it("runs the predicate for a derived audience and never reads membership rows", async () => {
    const { svc, memberFindMany, contactFindMany } = build({
      lists: [{ id: DERIVED, systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN }],
      predicateRows: ["c-9"],
    });
    const out = await svc.resolveContactIds({ listIds: [DERIVED], contactIds: [] });
    expect(out.unique).toEqual(["c-9"]);
    expect(memberFindMany).not.toHaveBeenCalled();
    expect(contactFindMany).toHaveBeenCalledWith({
      where: { preferences: { some: { channel: "SMS", consentStatus: "OPTED_IN" } } },
      select: { id: true },
    });
  });

  it("combines both kinds in one selection and dedupes the overlap", async () => {
    const { svc } = build({
      lists: [
        { id: CURATED, systemKey: null },
        { id: DERIVED, systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN },
      ],
      memberRows: ["shared", "curated-only"],
      predicateRows: ["shared", "derived-only"],
    });
    const out = await svc.resolveContactIds({ listIds: [CURATED, DERIVED], contactIds: [] });
    expect(out.unique.sort()).toEqual(["curated-only", "derived-only", "shared"]);
    expect(out.rawCount).toBe(4); // the duplicate is reported, then removed
  });

  it("ignores a systemKey the code no longer defines rather than sending to everyone", async () => {
    // A stale row must resolve to nothing, never to an unfiltered contact set.
    const { svc, contactFindMany } = build({ lists: [{ id: DERIVED, systemKey: "RETIRED_AUDIENCE" }] });
    const out = await svc.resolveContactIds({ listIds: [DERIVED], contactIds: [] });
    expect(out.unique).toEqual([]);
    expect(contactFindMany).not.toHaveBeenCalled();
  });

  it("still honours explicitly chosen contactIds alongside a derived audience", async () => {
    const { svc } = build({
      lists: [{ id: DERIVED, systemKey: SYSTEM_AUDIENCE_KEYS.SMS_OPTED_IN }],
      predicateRows: ["c-1"],
    });
    const out = await svc.resolveContactIds({ listIds: [DERIVED], contactIds: ["c-2"] });
    expect(out.unique.sort()).toEqual(["c-1", "c-2"]);
  });

  it("queries nothing when no list is selected", async () => {
    const { svc, listFindMany } = build();
    const out = await svc.resolveContactIds({ listIds: [], contactIds: ["c-1"] });
    expect(out.unique).toEqual(["c-1"]);
    expect(listFindMany).not.toHaveBeenCalled();
  });
});
