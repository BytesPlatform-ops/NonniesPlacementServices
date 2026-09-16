import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/request-user";
import type { AttachmentStorageService } from "./attachment-storage.service";
import type { SmsTransport } from "../providers/sms-transport";
import { ConversationService } from "./conversation.service";

const USER = { id: "11111111-1111-1111-1111-111111111111" } as RequestUser;
const CONV = "22222222-2222-2222-2222-222222222222";

/** A message row shaped like the columns the serializer actually reads. */
function row(id: string, minutesAgo: number) {
  return {
    id,
    direction: "INBOUND",
    status: "RECEIVED",
    subject: null,
    textBody: `body ${id}`,
    htmlBody: null,
    previewText: `body ${id}`,
    fromAddress: "+14155550161",
    fromName: null,
    toAddress: "+14155550100",
    autoSubmitted: false,
    smsOptOutType: null,
    encoding: null,
    segmentCount: null,
    lastErrorMessageSafe: null,
    sentAt: null,
    receivedAt: null,
    deliveredAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 16, 12, 0) - minutesAgo * 60_000),
    attachments: [],
  };
}

function build(opts: { conversation?: unknown; cursorRow?: unknown; rows?: unknown[] } = {}) {
  const findMany = jest.fn().mockResolvedValue(opts.rows ?? []);
  const prisma = {
    communicationConversation: {
      findUnique: jest.fn().mockResolvedValue("conversation" in opts ? opts.conversation : { id: CONV }),
    },
    communicationMessage: {
      findFirst: jest.fn().mockResolvedValue(opts.cursorRow ?? null),
      findMany,
    },
  } as unknown as PrismaService;

  const svc = new ConversationService(
    prisma,
    { get: () => undefined } as unknown as ConstructorParameters<typeof ConversationService>[1],
    { record: jest.fn() } as unknown as AuditService,
    {} as AttachmentStorageService,
    {} as SmsTransport,
  );
  return { svc, prisma, findMany };
}

describe("ConversationService.messages — cursor pagination", () => {
  it("returns the newest page in reading order, oldest first", async () => {
    // The database is queried newest-first; the client must receive the page the
    // way a thread reads.
    const { svc } = build({ rows: [row("c", 1), row("b", 2), row("a", 3)] });
    const out = await svc.messages(USER, CONV, { limit: 3 });
    expect(out.items.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("reports hasMore from a lookahead row and never returns it", async () => {
    const { svc, findMany } = build({ rows: [row("d", 1), row("c", 2), row("b", 3)] });
    const out = await svc.messages(USER, CONV, { limit: 2 });
    expect(findMany.mock.calls[0]![0].take).toBe(3); // limit + 1
    expect(out.items.map((m) => m.id)).toEqual(["c", "d"]);
    expect(out.hasMore).toBe(true);
  });

  it("reports hasMore false when the page is not full", async () => {
    const { svc } = build({ rows: [row("b", 1)] });
    expect((await svc.messages(USER, CONV, { limit: 5 })).hasMore).toBe(false);
  });

  it("pages strictly before the cursor, breaking ties on id so nothing repeats", async () => {
    const at = new Date(Date.UTC(2026, 8, 16, 11, 0));
    const { svc, findMany } = build({ cursorRow: { createdAt: at, id: "m-5" }, rows: [] });
    await svc.messages(USER, CONV, { before: "m-5" });
    expect(findMany.mock.calls[0]![0].where.OR).toEqual([
      { createdAt: { lt: at } },
      { createdAt: at, id: { lt: "m-5" } },
    ]);
  });

  it("scopes the query to the conversation so a cursor cannot widen it", async () => {
    const { svc, findMany } = build({ rows: [] });
    await svc.messages(USER, CONV, {});
    expect(findMany.mock.calls[0]![0].where.conversationId).toBe(CONV);
  });

  it("rejects a cursor belonging to another conversation", async () => {
    // findFirst is scoped to this conversation, so a foreign id resolves to nothing.
    const { svc } = build({ cursorRow: null });
    await expect(svc.messages(USER, CONV, { before: "33333333-3333-3333-3333-333333333333" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("404s on a conversation that does not exist", async () => {
    const { svc } = build({ conversation: null });
    await expect(svc.messages(USER, CONV, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("clamps an oversized page request", async () => {
    const { svc, findMany } = build({ rows: [] });
    await svc.messages(USER, CONV, { limit: 100000 });
    expect(findMany.mock.calls[0]![0].take).toBe(101); // 100 max + lookahead
  });

  it("floors a nonsensical page request at one row rather than querying nothing", async () => {
    // The DTO already rejects limit < 1; this is the defence behind it.
    const { svc, findMany } = build({ rows: [] });
    await svc.messages(USER, CONV, { limit: 0 });
    expect(findMany.mock.calls[0]![0].take).toBe(2); // 1 + lookahead
  });

  it("uses the default page size when no limit is given", async () => {
    const { svc, findMany } = build({ rows: [] });
    await svc.messages(USER, CONV, {});
    expect(findMany.mock.calls[0]![0].take).toBe(51); // default 50 + lookahead
  });
});
