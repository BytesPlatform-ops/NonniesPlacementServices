import type { PrismaService } from "../../../database/prisma.service";
import type { ConfigService } from "@nestjs/config";
import type { EmailTransport } from "../providers/email-transport";
import type { AttachmentStorageService } from "./attachment-storage.service";
import type { DeliveryMaintenanceService } from "../dispatch/delivery-maintenance.service";
import { EmailDispatcherService } from "./email-dispatcher.service";

const CAMPAIGN = { id: "c1", status: "SENDING", htmlSnapshot: "<p>Hi {{firstName}}</p>", textSnapshot: "Hi {{firstName}} {{unsubscribeUrl}}", subjectSnapshot: "Subject", senderEmail: "s@nonnis.test", senderName: "Nonni's" };
const RECIPIENT = { id: "r1", threadToken: "tt-1", campaignId: "c1", contactId: "contact-1", emailSnapshot: "p@x.com", internalMessageId: "im1", firstNameSnapshot: "Ada", lastNameSnapshot: "B", attemptCount: 0 };

function makeDispatcher(opts: { consent?: string; outcome?: unknown } = {}) {
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const tx = {
    communicationConversation: { create: jest.fn().mockResolvedValue({ id: "conv1" }) },
    communicationMessage: { create: jest.fn().mockResolvedValue({ id: "msg1" }) },
    communicationEmailCampaignRecipient: { update: recipientUpdate },
  };
  const prisma = {
    communicationEmailCampaign: { findUnique: jest.fn().mockResolvedValue(CAMPAIGN) },
    communicationContact: { findUnique: jest.fn().mockResolvedValue({ id: "contact-1", status: "ACTIVE", normalizedEmail: "p@x.com", unsubscribeToken: "tok", firstName: "Ada", lastName: "B", organizationName: null, email: "p@x.com", preferences: [{ consentStatus: opts.consent ?? "OPTED_IN" }] }), update: jest.fn() },
    communicationSuppression: { findFirst: jest.fn().mockResolvedValue(null) },
    communicationEmailCampaignRecipient: { update: recipientUpdate },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const config = { get: (n: string) => (n === "communicationsPublicSiteUrl" ? "https://site" : n === "communicationsInboundEmailDomain" ? "reply.mock.local" : n === "brevoSenderEmail" ? "s@nonnis.test" : n === "brevoSenderName" ? "Nonni's" : undefined) } as unknown as ConfigService;
  const transport = { name: "mock", configured: true, sendEmail: jest.fn().mockResolvedValue(opts.outcome ?? { ok: true, providerMessageId: "pm1", acceptedAt: "now" }) } as unknown as EmailTransport;
  const attachments = { downloadBuffer: jest.fn() } as unknown as AttachmentStorageService;
  const maintenance = { runMaintenance: jest.fn().mockResolvedValue({}) } as unknown as DeliveryMaintenanceService;
  const svc = new EmailDispatcherService(prisma, config as never, transport, attachments, maintenance);
  return { svc, recipientUpdate, transport, tx };
}

const run = (svc: EmailDispatcherService) => (svc as unknown as { processRecipient: (r: unknown) => Promise<void> }).processRecipient(RECIPIENT);

describe("EmailDispatcher.processRecipient", () => {
  it("sends and marks SENT + creates an outbound message thread", async () => {
    const { svc, recipientUpdate, transport, tx } = makeDispatcher();
    await run(svc);
    expect(transport.sendEmail).toHaveBeenCalled();
    expect(tx.communicationMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: "OUTBOUND", status: "SENT" }) }));
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "SENT" }) }));
  });

  it("does NOT send when the contact has opted out since queue (send-time recheck)", async () => {
    const { svc, recipientUpdate, transport } = makeDispatcher({ consent: "OPTED_OUT" });
    await run(svc);
    expect(transport.sendEmail).not.toHaveBeenCalled();
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "UNSUBSCRIBED" }) }));
  });

  it("marks DELIVERY_UNKNOWN on an ambiguous timeout (never blind-retry)", async () => {
    const { svc, recipientUpdate } = makeDispatcher({ outcome: { ok: false, classification: "AMBIGUOUS", code: "TIMEOUT", message: "t" } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "DELIVERY_UNKNOWN" }) }));
  });

  it("requeues a temporary failure below the attempt cap", async () => {
    const { svc, recipientUpdate } = makeDispatcher({ outcome: { ok: false, classification: "TEMPORARY", code: "5XX", message: "t" } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "QUEUED", attemptCount: 1 }) }));
  });

  it("fails permanently without retry", async () => {
    const { svc, recipientUpdate } = makeDispatcher({ outcome: { ok: false, classification: "PERMANENT", code: "BOUNCE", message: "t" } });
    await run(svc);
    expect(recipientUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) }));
  });
});

describe("EmailDispatcher Reply-To (threading contract)", () => {
  it("always sends a conversation-specific reply address derived from the thread token", async () => {
    // Without this the recipient's reply goes to the From mailbox and never
    // reaches the CRM, so a campaign send that omits it is a broken send.
    const { svc, transport } = makeDispatcher();
    await run(svc);
    const sent = (transport.sendEmail as jest.Mock).mock.calls[0]![0] as { replyTo?: string; senderEmail?: string };
    expect(sent.replyTo).toBe("reply-tt-1@reply.mock.local");
  });

  it("does not use the sender address as the reply address", async () => {
    const { svc, transport } = makeDispatcher();
    await run(svc);
    const sent = (transport.sendEmail as jest.Mock).mock.calls[0]![0] as { replyTo?: string; senderEmail?: string };
    expect(sent.replyTo).not.toBe(sent.senderEmail);
    expect(sent.senderEmail).toBe("s@nonnis.test"); // From is unchanged
  });
});
