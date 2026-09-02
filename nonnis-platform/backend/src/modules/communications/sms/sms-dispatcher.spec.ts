import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../database/prisma.service";
import type { SmsTransport } from "../providers/sms-transport";
import type { SmsConversationService } from "./sms-conversation.service";
import type { SmsStatusService } from "./sms-status.service";
import type { DeliveryMaintenanceService } from "../dispatch/delivery-maintenance.service";
import { SmsDispatcherService } from "./sms-dispatcher.service";

const RECIPIENT = {
  id: "r1",
  campaignId: "c1",
  contactId: "contact-1",
  phoneSnapshot: "+14155550161",
  bodySnapshot: "Hi Ada, your placement update is ready.",
  encodingSnapshot: "GSM7" as const,
  estimatedSegmentCount: 1,
  internalMessageId: "im1",
  attemptCount: 0,
};

interface Opts {
  consent?: string;
  suppressed?: boolean;
  outcome?: unknown;
  campaignStatus?: string;
}

function build(opts: Opts = {}) {
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const tx = {
    communicationMessage: { create: jest.fn().mockResolvedValue({ id: "msg-1" }) },
    communicationSmsCampaignRecipient: { update: recipientUpdate },
    communicationConversation: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    communicationSmsCampaign: { findUnique: jest.fn().mockResolvedValue({ id: "c1", status: opts.campaignStatus ?? "SENDING" }) },
    communicationContact: {
      findUnique: jest.fn().mockResolvedValue({ status: "ACTIVE", normalizedPhoneE164: "+14155550161", preferences: [{ consentStatus: opts.consent ?? "OPTED_IN" }] }),
    },
    communicationSuppression: { findFirst: jest.fn().mockResolvedValue(opts.suppressed ? { id: "s1" } : null) },
    communicationSmsCampaignRecipient: { update: recipientUpdate },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const config = { get: (n: string) => (n === "smsDispatchBatchSize" ? 20 : n === "smsDispatchConcurrency" ? 3 : undefined) } as unknown as ConfigService;
  const transport = {
    name: "mock",
    configured: true,
    configurationError: null,
    sendSms: jest.fn().mockResolvedValue(opts.outcome ?? { ok: true, providerMessageId: "SM1", providerStatus: "queued", fromNumber: "+14155550100", acceptedAt: "now", providerSegmentCount: 1 }),
  } as unknown as SmsTransport;
  const conversations = { findOrCreate: jest.fn().mockResolvedValue({ id: "conv-1", businessNumber: null }) } as unknown as SmsConversationService;
  const status = { applyProviderOptOut: jest.fn().mockResolvedValue(undefined) } as unknown as SmsStatusService;
  const maintenance = { runMaintenance: jest.fn().mockResolvedValue({}) } as unknown as DeliveryMaintenanceService;
  const svc = new SmsDispatcherService(prisma, config as never, transport, conversations, status, maintenance);
  return { svc, recipientUpdate, transport, tx, status, conversations };
}

const run = (svc: SmsDispatcherService) => (svc as unknown as { processRecipient: (r: unknown) => Promise<void> }).processRecipient(RECIPIENT);

describe("SmsDispatcher.processRecipient", () => {
  it("sends and records ACCEPTED plus an outbound SMS message in the conversation", async () => {
    const { svc, recipientUpdate, transport, tx, conversations } = build();
    await run(svc);
    expect(transport.sendSms).toHaveBeenCalled();
    expect(conversations.findOrCreate).toHaveBeenCalledWith("contact-1", "+14155550100", { originSmsCampaignId: "c1" });
    expect(tx.communicationMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: "SMS", direction: "OUTBOUND", status: "ACCEPTED" }) }));
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "ACCEPTED", providerMessageId: "SM1", actualFromNumber: "+14155550100" }) }));
  });

  it("does NOT send when the recipient texted STOP after the campaign was queued", async () => {
    // The critical race: queued 1,000 recipients, #950 opts out before their batch.
    const { svc, recipientUpdate, transport } = build({ consent: "OPTED_OUT" });
    await run(svc);
    expect(transport.sendSms).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "CANCELLED", exclusionReason: "OPTED_OUT" }) }));
  });

  it("does NOT send when the number became suppressed after queueing", async () => {
    const { svc, recipientUpdate, transport } = build({ suppressed: true });
    await run(svc);
    expect(transport.sendSms).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "CANCELLED", exclusionReason: "SUPPRESSED" }) }));
  });

  it("cancels remaining work when the campaign was cancelled", async () => {
    const { svc, recipientUpdate, transport } = build({ campaignStatus: "CANCELLED" });
    await run(svc);
    expect(transport.sendSms).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "CANCELLED", exclusionReason: "CAMPAIGN_CANCELLED" }) }));
  });

  it("marks DELIVERY_UNKNOWN on an ambiguous timeout (never a duplicate SMS)", async () => {
    const { svc, recipientUpdate } = build({ outcome: { ok: false, classification: "AMBIGUOUS", code: "TIMEOUT", message: "t" } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "DELIVERY_UNKNOWN" }) }));
  });

  it("requeues a rate-limited send with backoff, below the attempt cap", async () => {
    const { svc, recipientUpdate } = build({ outcome: { ok: false, classification: "RATE_LIMIT", code: "429", message: "t", retryAfterMs: 2000 } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "QUEUED", attemptCount: 1 }) }));
  });

  it("fails permanently without retry, and never retries a configuration error", async () => {
    const { svc, recipientUpdate } = build({ outcome: { ok: false, classification: "PERMANENT", code: "21211", message: "bad number" } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) }));

    const cfg = build({ outcome: { ok: false, classification: "CONFIGURATION", code: "AUTH", message: "not configured" } });
    await run(cfg.svc);
    expect(cfg.recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) }));
  });

  it("synchronizes CRM opt-out state when the provider blocks an opted-out recipient", async () => {
    const { svc, recipientUpdate, status } = build({ outcome: { ok: false, classification: "PROVIDER_OPT_OUT_BLOCK", code: "21610", message: "opted out" } });
    await run(svc);
    expect(status.applyProviderOptOut).toHaveBeenCalledWith("+14155550161");
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) }));
  });
});
