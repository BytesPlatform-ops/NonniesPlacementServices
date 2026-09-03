import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { EmailEventsService, normalizeBrevoEvent, parseEventTimestamp } from "./email-events.service";

function makeService(recipient: Record<string, unknown> | null, opts: { eventCreateThrows?: boolean } = {}) {
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const prefUpsert = jest.fn().mockResolvedValue({});
  const eventCreate = opts.eventCreateThrows
    ? jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }))
    : jest.fn().mockResolvedValue({});
  const prisma = {
    communicationEmailCampaignRecipient: { findFirst: jest.fn().mockResolvedValue(recipient), update: recipientUpdate },
    communicationMessage: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    communicationConversation: { findUnique: jest.fn().mockResolvedValue(recipient ? { contactId: "contact-1" } : null) },
    communicationEmailEvent: { create: eventCreate },
    communicationContact: { findUnique: jest.fn().mockResolvedValue(recipient ? { id: "contact-1", normalizedEmail: "p@x.com" } : null) },
    contactChannelPreference: { upsert: prefUpsert },
  } as unknown as PrismaService;
  const suppressions = { suppressSystem: jest.fn().mockResolvedValue(undefined) } as unknown as SuppressionsService;
  return { svc: new EmailEventsService(prisma, suppressions), recipientUpdate, prefUpsert, suppressions, eventCreate };
}

const recipient = { id: "r1", contactId: "contact-1", emailSnapshot: "p@x.com" };

describe("normalizeBrevoEvent", () => {
  it("maps Brevo names to provider-neutral types", () => {
    expect(normalizeBrevoEvent("delivered")).toBe("DELIVERED");
    expect(normalizeBrevoEvent("hard_bounce")).toBe("BOUNCED_HARD");
    expect(normalizeBrevoEvent("soft_bounce")).toBe("BOUNCED_SOFT");
    expect(normalizeBrevoEvent("spam")).toBe("COMPLAINT");
    expect(normalizeBrevoEvent("unsubscribed")).toBe("UNSUBSCRIBED");
    expect(normalizeBrevoEvent("nonsense")).toBeNull();
  });
});

describe("EmailEventsService.apply", () => {
  it("hard bounce → recipient BOUNCED + email suppression", async () => {
    const { svc, recipientUpdate, suppressions } = makeService(recipient);
    await svc.apply({ providerMessageId: "pm1", type: "BOUNCED_HARD", dedupKey: "k1" });
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "BOUNCED" }) }));
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("EMAIL", "p@x.com", "HARD_BOUNCE", "delivery-webhook");
  });

  it("unsubscribe → recipient UNSUBSCRIBED + suppression + consent opt-out", async () => {
    const { svc, recipientUpdate, prefUpsert, suppressions } = makeService(recipient);
    await svc.apply({ providerMessageId: "pm1", type: "UNSUBSCRIBED", dedupKey: "k2" });
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "UNSUBSCRIBED" }) }));
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("EMAIL", "p@x.com", "USER_OPT_OUT", "delivery-webhook");
    expect(prefUpsert).toHaveBeenCalled();
  });

  it("complaint → suppression + consent opt-out (no permanent status flip)", async () => {
    const { svc, suppressions, prefUpsert } = makeService(recipient);
    await svc.apply({ providerMessageId: "pm1", type: "COMPLAINT", dedupKey: "k3" });
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("EMAIL", "p@x.com", "SPAM_COMPLAINT", "delivery-webhook");
    expect(prefUpsert).toHaveBeenCalled();
  });

  it("soft bounce does not suppress", async () => {
    const { svc, suppressions } = makeService(recipient);
    await svc.apply({ providerMessageId: "pm1", type: "BOUNCED_SOFT", dedupKey: "k4" });
    expect(suppressions.suppressSystem).not.toHaveBeenCalled();
  });

  it("is idempotent for a duplicate webhook (dedup key)", async () => {
    const { svc, recipientUpdate } = makeService(recipient, { eventCreateThrows: true });
    const r = await svc.apply({ providerMessageId: "pm1", type: "DELIVERED", dedupKey: "dup" });
    expect(r.applied).toBe(false);
    expect(recipientUpdate).not.toHaveBeenCalled();
  });

  it("builds normalized events from a Brevo body", () => {
    const { svc } = makeService(recipient);
    const events = svc.buildFromBrevo([{ event: "delivered", "message-id": "<abc>", date: "2026-09-02T00:00:00Z" }, { event: "junk", "message-id": "<abc>" }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ providerMessageId: "<abc>", type: "DELIVERED" });
  });
});

describe("provider event timestamps", () => {
  it("prefers the unambiguous epoch over Brevo's timezone-less date string", () => {
    // Both fields describe the same event. `date` carries no offset and is in
    // the Brevo account's timezone, so trusting it shifts the instant by the
    // account offset — which is how a delivery once landed hours before its send.
    const [event] = new EmailEventsService(
      {} as never,
      {} as never,
    ).buildFromBrevo({
      event: "delivered",
      "message-id": "<pm-1@smtp-relay.mailin.fr>",
      date: "2026-09-03 14:12:14",
      ts_event: 1788469934, // 2026-09-03T21:12:14Z
    });
    expect(event!.occurredAt?.toISOString()).toBe("2026-09-03T21:12:14.000Z");
  });

  it("reads a bare date string as UTC so the result does not depend on the server timezone", () => {
    expect(parseEventTimestamp("2026-09-03 14:12:14")?.toISOString()).toBe("2026-09-03T14:12:14.000Z");
  });

  it("respects an explicit offset when the provider sends one", () => {
    expect(parseEventTimestamp("2026-09-03T14:12:14+05:00")?.toISOString()).toBe("2026-09-03T09:12:14.000Z");
  });

  it("treats numbers as epoch seconds, and large numbers as milliseconds", () => {
    expect(parseEventTimestamp(1788469934)?.toISOString()).toBe("2026-09-03T21:12:14.000Z");
    expect(parseEventTimestamp(1788469934000)?.toISOString()).toBe("2026-09-03T21:12:14.000Z");
    expect(parseEventTimestamp("1788469934")?.toISOString()).toBe("2026-09-03T21:12:14.000Z");
  });

  it("returns undefined for missing or unparseable values rather than an invalid date", () => {
    for (const bad of [undefined, null, "", "not-a-date"]) {
      expect(parseEventTimestamp(bad)).toBeUndefined();
    }
  });
});
