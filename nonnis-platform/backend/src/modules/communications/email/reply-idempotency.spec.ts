import { Prisma } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { AttachmentStorageService } from "./attachment-storage.service";
import type { SmsTransport } from "../providers/sms-transport";
import { ConversationService } from "./conversation.service";
import type { RequestUser } from "../../auth/request-user";

const user = { id: "user-1" } as unknown as RequestUser;
const EXISTING = { id: "msg-existing", direction: "OUTBOUND", status: "QUEUED", attachments: [], createdAt: new Date(), autoSubmitted: false };

function build(opts: { existingByKey?: Record<string, unknown> | null; createThrowsDuplicate?: boolean } = {}) {
  const create = opts.createThrowsDuplicate
    ? jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }))
    : jest.fn().mockResolvedValue({ ...EXISTING, id: "msg-new" });
  const tx = {
    communicationMessage: { create },
    communicationConversation: { update: jest.fn().mockResolvedValue({}) },
    communicationConversationReadState: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    communicationConversation: {
      findUnique: jest.fn().mockResolvedValue({ id: "conv-1", channel: "SMS", status: "OPEN", archivedAt: null, businessNumber: "+14155550100", contact: { phone: "+14155550161", normalizedPhoneE164: "+14155550161" } }),
    },
    communicationMessage: { findUnique: jest.fn().mockResolvedValue(opts.existingByKey ?? null) },
    communicationSuppression: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const config = { get: (n: string) => (n === "communicationsSmsProvider" ? "mock" : undefined) } as unknown as ConfigService<never, true>;
  const audit = { record: jest.fn().mockResolvedValue({}) } as unknown as AuditService;
  const attachments = {} as unknown as AttachmentStorageService;
  const smsTransport = { name: "mock", configured: true, configurationError: null } as unknown as SmsTransport;
  return { svc: new ConversationService(prisma, config, audit, attachments, smsTransport), create, prisma };
}

describe("direct reply idempotency", () => {
  it("returns the original message instead of queueing a second one", async () => {
    const { svc, create } = build({ existingByKey: EXISTING });
    const r = await svc.replyToConversation(user, "conv-1", "Thanks!", [], "client-key-1");
    expect(r.message.id).toBe("msg-existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("queues normally when the key has not been seen", async () => {
    const { svc, create } = build({ existingByKey: null });
    const r = await svc.replyToConversation(user, "conv-1", "Thanks!", [], "client-key-2");
    expect(r.message.id).toBe("msg-new");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("scopes the key to its conversation so keys cannot collide across threads", async () => {
    const { svc, prisma, create } = build({ existingByKey: null });
    await svc.replyToConversation(user, "conv-1", "Thanks!", [], "shared-key");
    expect(prisma.communicationMessage.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "conv-1:shared-key" } }));
    expect(create.mock.calls[0]![0].data.idempotencyKey).toBe("conv-1:shared-key");
  });

  it("resolves a true race: the loser of the unique constraint returns the winner's message", async () => {
    const { svc } = build({ existingByKey: null, createThrowsDuplicate: true });
    // The pre-check missed it, the insert collided; the second lookup finds the winner.
    (svc as unknown as { prisma: { communicationMessage: { findUnique: jest.Mock } } }).prisma.communicationMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(EXISTING);
    const r = await svc.replyToConversation(user, "conv-1", "Thanks!", [], "racing-key");
    expect(r.message.id).toBe("msg-existing");
  });

  it("still queues when no key is supplied (no key, no dedupe)", async () => {
    const { svc, create, prisma } = build({ existingByKey: null });
    await svc.replyToConversation(user, "conv-1", "Thanks!", []);
    expect(prisma.communicationMessage.findUnique).not.toHaveBeenCalled();
    expect(create.mock.calls[0]![0].data.idempotencyKey).toBeNull();
  });
});
