import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { SuppressionsService } from "../suppressions/suppressions.service";
import type { NormalizedInboundSms } from "../providers/sms-inbound-adapter";
import type { SmsConversationService } from "./sms-conversation.service";
import { InboundSmsService } from "./inbound-sms.service";
import { classifyKeywordFallback } from "./sms-keywords";

const CONVERSATION = { id: "conv-1", status: "OPEN", archivedAt: null, lastInboundAt: null };

interface Harness {
  contacts?: Array<{ id: string }>;
  existingMessage?: { id: string } | null;
  existingReview?: { id: string } | null;
  conversation?: Record<string, unknown>;
}

function build(h: Harness = {}) {
  const messageCreate = jest.fn().mockResolvedValue({ id: "msg-1" });
  const conversationUpdate = jest.fn().mockResolvedValue({});
  const reviewCreate = jest.fn().mockResolvedValue({ id: "rev-1" });
  const prefUpsert = jest.fn().mockResolvedValue({});
  const tx = { communicationMessage: { create: messageCreate }, communicationConversation: { update: conversationUpdate } };
  const prisma = {
    communicationMessage: { findUnique: jest.fn().mockResolvedValue(h.existingMessage ?? null) },
    communicationInboundEmailReview: { findUnique: jest.fn().mockResolvedValue(h.existingReview ?? null), create: reviewCreate },
    communicationContact: { findMany: jest.fn().mockResolvedValue(h.contacts ?? [{ id: "contact-1" }]) },
    contactChannelPreference: { upsert: prefUpsert },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const conversations = { findOrCreate: jest.fn().mockResolvedValue(h.conversation ?? CONVERSATION) } as unknown as SmsConversationService;
  const suppressions = { suppressSystem: jest.fn().mockResolvedValue(undefined), releaseSystem: jest.fn().mockResolvedValue(true) } as unknown as SuppressionsService;
  const audit = { record: jest.fn().mockResolvedValue({}) } as unknown as AuditService;
  return { svc: new InboundSmsService(prisma, conversations, suppressions, audit), messageCreate, conversationUpdate, reviewCreate, prefUpsert, suppressions, audit };
}

const inbound = (o: Partial<NormalizedInboundSms> = {}): NormalizedInboundSms => ({
  providerMessageId: "SM1",
  fromPhone: "+14155550161",
  toPhone: "+14155550100",
  body: "Hi, yes that works",
  numMedia: 0,
  ...o,
});

describe("classifyKeywordFallback (conservative, documented keywords only)", () => {
  it("matches bare documented keywords case-insensitively", () => {
    expect(classifyKeywordFallback("STOP")).toBe("STOP");
    expect(classifyKeywordFallback(" stop ")).toBe("STOP");
    expect(classifyKeywordFallback("unsubscribe")).toBe("STOP");
    expect(classifyKeywordFallback("Start")).toBe("START");
    expect(classifyKeywordFallback("help")).toBe("HELP");
  });
  it("never classifies a sentence that merely contains a keyword", () => {
    expect(classifyKeywordFallback("please stop sending these")).toBeUndefined();
    expect(classifyKeywordFallback("can you help me")).toBeUndefined();
    expect(classifyKeywordFallback("")).toBeUndefined();
  });
});

describe("InboundSmsService correlation", () => {
  it("links a known number to its SMS conversation", async () => {
    const { svc, messageCreate } = build();
    const r = await svc.ingest(inbound());
    expect(r).toEqual({ status: "linked", conversationId: "conv-1", optOutType: undefined });
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: "SMS", direction: "INBOUND", status: "RECEIVED" }) }));
  });

  it("quarantines an unknown number and NEVER creates a contact", async () => {
    const { svc, reviewCreate, messageCreate } = build({ contacts: [] });
    const r = await svc.ingest(inbound());
    expect(r).toEqual({ status: "review", reason: "UNKNOWN_PHONE" });
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: "SMS", reason: "UNKNOWN_PHONE" }) }));
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("quarantines an ambiguous number that matches more than one contact", async () => {
    const { svc } = build({ contacts: [{ id: "c1" }, { id: "c2" }] });
    expect(await svc.ingest(inbound())).toEqual({ status: "review", reason: "PHONE_CONFLICT" });
  });

  it("quarantines a malformed provider payload", async () => {
    const { svc } = build();
    expect(await svc.ingest(inbound({ fromPhone: "not-a-number", toPhone: "also-bad" }))).toEqual({ status: "review", reason: "INVALID_PROVIDER_PAYLOAD" });
  });

  it("is idempotent for a repeated MessageSid", async () => {
    const { svc, messageCreate } = build({ existingMessage: { id: "already" } });
    expect(await svc.ingest(inbound())).toEqual({ status: "duplicate" });
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("reopens an archived conversation on new inbound", async () => {
    const { svc, conversationUpdate } = build({ conversation: { ...CONVERSATION, status: "ARCHIVED", archivedAt: new Date() } });
    await svc.ingest(inbound());
    expect(conversationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "OPEN", archivedAt: null }) }));
  });

  it("notes inbound media without fetching or storing it", async () => {
    const { svc, messageCreate } = build();
    await svc.ingest(inbound({ numMedia: 2, body: "look" }));
    const body = messageCreate.mock.calls[0]![0].data.textBody as string;
    expect(body).toContain("2 media attachments received");
    expect(body).toContain("not stored");
  });
});

describe("InboundSmsService STOP / START / HELP", () => {
  it("STOP opts the contact out and suppresses the number immediately", async () => {
    const { svc, suppressions, prefUpsert, conversationUpdate } = build();
    const r = await svc.ingest(inbound({ body: "STOP", optOutType: "STOP" }));
    expect(r).toMatchObject({ status: "linked", optOutType: "STOP" });
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("SMS", "+14155550161", "USER_OPT_OUT", "sms-inbound-stop");
    expect(prefUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ consentStatus: "OPTED_OUT" }) }));
    // A keyword is not a conversation needing a staff reply.
    expect(conversationUpdate.mock.calls[0]![0].data.lastInboundAt).toBeNull();
  });

  it("START releases only the USER_OPT_OUT suppression and re-opts in, audibly", async () => {
    const { svc, suppressions, prefUpsert, audit } = build();
    await svc.ingest(inbound({ body: "START", optOutType: "START" }));
    expect(suppressions.releaseSystem).toHaveBeenCalledWith("SMS", "+14155550161", ["USER_OPT_OUT"], "sms-inbound-start");
    expect(prefUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ consentStatus: "OPTED_IN", consentSource: "TWILIO_START" }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "communication.sms.opted_in" }));
  });

  it("HELP is recorded without changing consent", async () => {
    const { svc, suppressions, prefUpsert, messageCreate } = build();
    await svc.ingest(inbound({ body: "HELP", optOutType: "HELP" }));
    expect(suppressions.suppressSystem).not.toHaveBeenCalled();
    expect(prefUpsert).not.toHaveBeenCalled();
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ smsOptOutType: "HELP" }) }));
  });

  it("falls back to the bare keyword when the provider sends no OptOutType", async () => {
    const { svc, suppressions } = build();
    await svc.ingest(inbound({ body: "stop" }));
    expect(suppressions.suppressSystem).toHaveBeenCalledWith("SMS", "+14155550161", "USER_OPT_OUT", "sms-inbound-stop");
  });

  it("treats a normal message that merely mentions stop as a real conversation", async () => {
    const { svc, suppressions, conversationUpdate } = build();
    await svc.ingest(inbound({ body: "Please don't stop the service" }));
    expect(suppressions.suppressSystem).not.toHaveBeenCalled();
    expect(conversationUpdate.mock.calls[0]![0].data.lastInboundAt).not.toBeNull();
  });
});
