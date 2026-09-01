import type { PrismaService } from "../../../database/prisma.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { UnsubscribeService } from "./unsubscribe.service";

function makeService(contact: Record<string, unknown> | null) {
  const upsert = jest.fn().mockResolvedValue({});
  const prisma = {
    communicationContact: { findFirst: jest.fn().mockResolvedValue(contact) },
    contactChannelPreference: { upsert },
  } as unknown as PrismaService;
  const suppressions = { suppressSystem: jest.fn().mockResolvedValue(undefined) } as unknown as SuppressionsService;
  return { svc: new UnsubscribeService(prisma, suppressions), upsert, suppressions };
}

describe("UnsubscribeService", () => {
  it("returns ok:false for an unknown token (graceful, no throw)", async () => {
    const { svc } = makeService(null);
    expect(await svc.unsubscribe("nope")).toEqual({ ok: false });
  });

  it("opts the contact out of EMAIL + suppresses on a valid token", async () => {
    const { svc, upsert, suppressions } = makeService({ id: "c1", normalizedEmail: "p@x.com" });
    const r = await svc.unsubscribe("tok");
    expect(r).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ consentStatus: "OPTED_OUT" }) }));
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("EMAIL", "p@x.com", "USER_OPT_OUT", "public-unsubscribe");
  });

  it("masks the email and reports already-unsubscribed in status (never exposes the id)", async () => {
    const { svc } = makeService({ id: "c1", email: "alice@example.com", preferences: [{ consentStatus: "OPTED_OUT" }] });
    const s = await svc.status("tok");
    expect(s.valid).toBe(true);
    expect(s.alreadyUnsubscribed).toBe(true);
    expect(s.email).toBe("a****@example.com");
    expect(JSON.stringify(s)).not.toContain("c1");
  });
});
