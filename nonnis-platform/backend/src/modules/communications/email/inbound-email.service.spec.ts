import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../database/prisma.service";
import type { EmailInboundAdapter, NormalizedInboundEmail } from "../providers/email-inbound-adapter";
import type { AttachmentStorageService } from "./attachment-storage.service";
import { InboundEmailService } from "./inbound-email.service";

const DOMAIN = "reply.nonnis.com";
const TOKEN = "abcdef0123456789XYtok";
const REPLY = `reply-${TOKEN}@${DOMAIN}`;

interface Harness {
  conversationByToken?: Record<string, unknown> | null;
  messageByMessageId?: Record<string, unknown> | null;
  conversationById?: Record<string, unknown> | null;
  contact?: Record<string, unknown> | null;
  existingMessageProviderId?: Record<string, unknown> | null;
  existingReviewProviderId?: Record<string, unknown> | null;
}

function build(h: Harness) {
  const messageCreate = jest.fn().mockResolvedValue({ id: "msg-new" });
  const conversationUpdate = jest.fn().mockResolvedValue({});
  const reviewCreate = jest.fn().mockResolvedValue({ id: "rev-new" });
  const tx = {
    communicationMessage: { findFirst: jest.fn().mockResolvedValue(null), create: messageCreate },
    communicationConversation: { update: conversationUpdate },
  };
  const prisma = {
    communicationMessage: {
      findUnique: jest.fn().mockResolvedValue(h.existingMessageProviderId ?? null),
      findFirst: jest.fn().mockResolvedValue(h.messageByMessageId ?? null),
    },
    communicationInboundEmailReview: {
      findUnique: jest.fn().mockResolvedValue(h.existingReviewProviderId ?? null),
      create: reviewCreate,
    },
    communicationConversation: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { threadToken?: string; id?: string } }) => Promise.resolve(where.threadToken !== undefined ? (h.conversationByToken ?? null) : (h.conversationById ?? null))),
    },
    communicationContact: { findUnique: jest.fn().mockResolvedValue(h.contact ?? null) },
    communicationMessageAttachment: { create: jest.fn().mockResolvedValue({}) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const config = { get: (k: string) => (k === "communicationsInboundEmailDomain" ? DOMAIN : k === "communicationsInboundMaxAttachments" ? 5 : k === "communicationsInboundMaxAttachmentBytes" ? 10 * 1024 * 1024 : undefined) } as unknown as ConfigService<never, true>;
  const adapter = { name: "mock", configured: true, parse: jest.fn(), fetchAttachment: jest.fn().mockResolvedValue(null) } as unknown as EmailInboundAdapter;
  const attachments = { uploadBuffer: jest.fn() } as unknown as AttachmentStorageService;
  const svc = new InboundEmailService(prisma, config, adapter, attachments);
  return { svc, messageCreate, conversationUpdate, reviewCreate };
}

function email(overrides: Partial<NormalizedInboundEmail> = {}): NormalizedInboundEmail {
  return { from: { address: "jane@example.com" }, destinations: [REPLY], subject: "Re: Hi", text: "hello", attachments: [], ...overrides };
}

const CONVERSATION = { id: "conv-1", contactId: "contact-1", status: "OPEN", subject: "Hi", archivedAt: null, previewText: null, lastInboundAt: null };
const CONTACT_MATCH = { normalizedEmail: "jane@example.com" };
const CONTACT_MISMATCH = { normalizedEmail: "someone-else@example.com" };

describe("InboundEmailService correlation + safety", () => {
  it("links a reply via the opaque thread token when the sender matches", async () => {
    const { svc, messageCreate } = build({ conversationByToken: CONVERSATION, contact: CONTACT_MATCH });
    const r = await svc.ingestOne(email());
    expect(r).toEqual({ status: "linked", conversationId: "conv-1" });
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: "INBOUND", status: "RECEIVED" }) }));
  });

  it("quarantines an unknown token", async () => {
    const { svc, reviewCreate } = build({ conversationByToken: null, contact: CONTACT_MATCH });
    const r = await svc.ingestOne(email());
    expect(r).toEqual({ status: "review", reason: "UNKNOWN_TOKEN" });
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: "UNKNOWN_TOKEN" }) }));
  });

  it("does NOT attach to another person's thread on a sender mismatch (token)", async () => {
    const { svc, messageCreate, reviewCreate } = build({ conversationByToken: CONVERSATION, contact: CONTACT_MISMATCH });
    const r = await svc.ingestOne(email());
    expect(r).toEqual({ status: "review", reason: "THREAD_SENDER_MISMATCH" });
    expect(messageCreate).not.toHaveBeenCalled();
    expect(reviewCreate).toHaveBeenCalled();
  });

  it("resolves via In-Reply-To when there is no token", async () => {
    const { svc } = build({ messageByMessageId: { conversationId: "conv-1" }, conversationById: CONVERSATION, contact: CONTACT_MATCH });
    const r = await svc.ingestOne(email({ destinations: ["plain@gmail.com"], inReplyTo: "<outbound-1@x>" }));
    expect(r).toEqual({ status: "linked", conversationId: "conv-1" });
  });

  it("flags a header match with a sender mismatch distinctly", async () => {
    const { svc } = build({ messageByMessageId: { conversationId: "conv-1" }, conversationById: CONVERSATION, contact: CONTACT_MISMATCH });
    const r = await svc.ingestOne(email({ destinations: ["plain@gmail.com"], inReplyTo: "<outbound-1@x>" }));
    expect(r).toEqual({ status: "review", reason: "HEADER_SENDER_MISMATCH" });
  });

  it("NEVER correlates by subject text alone", async () => {
    const { svc } = build({ contact: CONTACT_MATCH });
    const r = await svc.ingestOne(email({ destinations: ["plain@gmail.com"], subject: "Re: Hi", inReplyTo: undefined, references: undefined }));
    expect(r.status).toBe("review");
  });

  it("is idempotent for a duplicate provider inbound id", async () => {
    const { svc, messageCreate } = build({ existingMessageProviderId: { id: "already" }, conversationByToken: CONVERSATION, contact: CONTACT_MATCH });
    const r = await svc.ingestOne(email({ providerInboundId: "dup-1" }));
    expect(r).toEqual({ status: "duplicate" });
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("reopens an archived conversation and marks it OPEN on new inbound", async () => {
    const { svc, conversationUpdate } = build({ conversationByToken: { ...CONVERSATION, status: "ARCHIVED", archivedAt: new Date() }, contact: CONTACT_MATCH });
    await svc.ingestOne(email());
    expect(conversationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "OPEN", archivedAt: null }) }));
  });

  it("does NOT advance needsReply for an auto-submitted email", async () => {
    const { svc, conversationUpdate } = build({ conversationByToken: CONVERSATION, contact: CONTACT_MATCH });
    await svc.ingestOne(email({ autoSubmitted: true }));
    const data = conversationUpdate.mock.calls[0]![0].data;
    expect(data.lastInboundAt).toBeNull(); // unchanged (conversation.lastInboundAt was null)
  });
});
