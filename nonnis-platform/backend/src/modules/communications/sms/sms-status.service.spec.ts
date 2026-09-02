import type { PrismaService } from "../../../database/prisma.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import { SmsStatusService, isForwardTransition, normalizeTwilioStatus } from "./sms-status.service";

describe("normalizeTwilioStatus", () => {
  it("maps documented Twilio SMS statuses to provider-neutral states", () => {
    expect(normalizeTwilioStatus("queued")).toBe("QUEUED");
    expect(normalizeTwilioStatus("accepted")).toBe("ACCEPTED");
    expect(normalizeTwilioStatus("sending")).toBe("ACCEPTED");
    expect(normalizeTwilioStatus("sent")).toBe("SENT");
    expect(normalizeTwilioStatus("delivered")).toBe("DELIVERED");
    expect(normalizeTwilioStatus("undelivered")).toBe("UNDELIVERED");
    expect(normalizeTwilioStatus("failed")).toBe("FAILED");
  });
  it("is case-insensitive and ignores statuses that are not meaningful here", () => {
    expect(normalizeTwilioStatus("DELIVERED")).toBe("DELIVERED");
    expect(normalizeTwilioStatus("scheduled")).toBeNull();
    expect(normalizeTwilioStatus("read")).toBeNull();
  });
});

describe("isForwardTransition (out-of-order callback safety)", () => {
  it("allows normal forward progress", () => {
    expect(isForwardTransition("QUEUED", "ACCEPTED")).toBe(true);
    expect(isForwardTransition("ACCEPTED", "SENT")).toBe(true);
    expect(isForwardTransition("SENT", "DELIVERED")).toBe(true);
  });
  it("never regresses DELIVERED when a late 'sent' callback arrives", () => {
    expect(isForwardTransition("DELIVERED", "SENT")).toBe(false);
    expect(isForwardTransition("DELIVERED", "ACCEPTED")).toBe(false);
    expect(isForwardTransition("DELIVERED", "QUEUED")).toBe(false);
  });
  it("is idempotent for a repeated callback", () => {
    expect(isForwardTransition("DELIVERED", "DELIVERED")).toBe(false);
    expect(isForwardTransition("SENT", "SENT")).toBe(false);
  });
  it("lets an authoritative callback resolve an ambiguous send", () => {
    expect(isForwardTransition("DELIVERY_UNKNOWN", "DELIVERED")).toBe(true);
    expect(isForwardTransition("DELIVERY_UNKNOWN", "FAILED")).toBe(true);
  });
  it("never overwrites a cancelled recipient we deliberately never sent", () => {
    expect(isForwardTransition("CANCELLED", "DELIVERED")).toBe(false);
    expect(isForwardTransition("EXCLUDED", "SENT")).toBe(false);
  });
});

function build(recipient: Record<string, unknown> | null, message: Record<string, unknown> | null = null) {
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const messageUpdate = jest.fn().mockResolvedValue({});
  const prefUpsert = jest.fn().mockResolvedValue({});
  const prisma = {
    communicationSmsCampaignRecipient: { findFirst: jest.fn().mockResolvedValue(recipient), update: recipientUpdate },
    communicationMessage: { findFirst: jest.fn().mockResolvedValue(message), update: messageUpdate },
    communicationContact: { findFirst: jest.fn().mockResolvedValue({ id: "contact-1" }) },
    contactChannelPreference: { upsert: prefUpsert },
  } as unknown as PrismaService;
  const suppressions = { suppressSystem: jest.fn().mockResolvedValue(undefined) } as unknown as SuppressionsService;
  return { svc: new SmsStatusService(prisma, suppressions), recipientUpdate, messageUpdate, prefUpsert, suppressions };
}

const RECIPIENT = { id: "r1", deliveryStatus: "ACCEPTED", phoneSnapshot: "+14155550161", sentAt: null, deliveredAt: null, undeliveredAt: null, failedAt: null, lastErrorCode: null, lastErrorMessageSafe: null };

describe("SmsStatusService.apply", () => {
  it("advances a recipient to DELIVERED", async () => {
    const { svc, recipientUpdate } = build(RECIPIENT);
    const r = await svc.apply({ providerMessageId: "SM1", status: "DELIVERED" });
    expect(r.applied).toBe(true);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "DELIVERED" }) }));
  });

  it("ignores a duplicate/out-of-order callback without regressing state", async () => {
    const { svc, recipientUpdate } = build({ ...RECIPIENT, deliveryStatus: "DELIVERED" });
    const r = await svc.apply({ providerMessageId: "SM1", status: "SENT" });
    expect(r.applied).toBe(false);
    expect(recipientUpdate).not.toHaveBeenCalled();
  });

  it("records UNDELIVERED with a safe diagnostic but does not suppress by default", async () => {
    const { svc, recipientUpdate, suppressions } = build(RECIPIENT);
    await svc.apply({ providerMessageId: "SM1", status: "UNDELIVERED", errorCode: "30003", errorMessageSafe: "Unreachable destination handset" });
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "UNDELIVERED", lastErrorCode: "30003" }) }));
    expect(suppressions.suppressSystem).not.toHaveBeenCalled();
  });

  it("synchronizes CRM opt-out state when the provider reports 21610", async () => {
    const { svc, suppressions, prefUpsert } = build(RECIPIENT);
    await svc.apply({ providerMessageId: "SM1", status: "FAILED", errorCode: "21610" });
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("SMS", "+14155550161", "USER_OPT_OUT", "sms-provider-opt-out");
    expect(prefUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ consentStatus: "OPTED_OUT" }) }));
  });

  it("updates a direct reply message as well as campaign recipients", async () => {
    const { svc, messageUpdate } = build(null, { id: "m1", status: "ACCEPTED", toAddress: "+14155550161", deliveredAt: null, undeliveredAt: null, lastErrorCode: null, lastErrorMessageSafe: null });
    const r = await svc.apply({ providerMessageId: "SM1", status: "DELIVERED" });
    expect(r.applied).toBe(true);
    expect(messageUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELIVERED" }) }));
  });

  it("is a no-op for an unknown provider message id", async () => {
    const { svc, recipientUpdate, messageUpdate } = build(null, null);
    const r = await svc.apply({ providerMessageId: "SM-unknown", status: "DELIVERED" });
    expect(r.applied).toBe(false);
    expect(recipientUpdate).not.toHaveBeenCalled();
    expect(messageUpdate).not.toHaveBeenCalled();
  });
});
