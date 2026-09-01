import type { ConfigService } from "@nestjs/config";
import { BrevoEmailInboundAdapter } from "./brevo-email-inbound-adapter";

const config = {
  get: (k: string) => (k === "communicationsInboundEmailDomain" ? "reply.nonnis.com" : k === "communicationsInboundEmailSecret" ? "s3cret" : undefined),
} as unknown as ConfigService<never, true>;

const REPLY = "reply-abcdef0123456789XY@reply.nonnis.com";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        From: { Address: "jane@example.com", Name: "Jane Doe" },
        To: [{ Address: REPLY }],
        Cc: [],
        Recipients: [REPLY],
        Subject: "Re: Placement question",
        RawTextBody: "Here is my reply.",
        RawHtmlBody: "<p>Here is my reply.</p>",
        MessageId: "<inbound-1@example.com>",
        InReplyTo: "<outbound-9@reply.nonnis.com>",
        Headers: { References: "<root@x> <outbound-9@reply.nonnis.com>", "Auto-Submitted": "no" },
        SentAtDate: "Wed, 02 Sep 2026 12:00:00 +0000",
        Uuid: ["provider-uuid-1"],
        Attachments: [{ Name: "doc.pdf", ContentType: "application/pdf", ContentLength: 2048, ContentID: "cid1", DownloadToken: "dtok1" }],
        ...overrides,
      },
    ],
  };
}

describe("BrevoEmailInboundAdapter.parse", () => {
  const adapter = new BrevoEmailInboundAdapter(config);

  it("normalizes a Brevo inbound item", () => {
    const [n] = adapter.parse(payload());
    expect(n.from).toEqual({ address: "jane@example.com", name: "Jane Doe" });
    expect(n.destinations).toContain(REPLY);
    expect(n.subject).toBe("Re: Placement question");
    expect(n.text).toBe("Here is my reply.");
    expect(n.html).toBe("<p>Here is my reply.</p>");
    expect(n.internetMessageId).toBe("<inbound-1@example.com>");
    expect(n.inReplyTo).toBe("<outbound-9@reply.nonnis.com>");
    expect(n.references).toBe("<root@x> <outbound-9@reply.nonnis.com>");
    expect(n.providerInboundId).toBe("provider-uuid-1");
    expect(n.receivedAt?.getUTCFullYear()).toBe(2026);
    expect(n.attachments[0]).toMatchObject({ fileName: "doc.pdf", mimeType: "application/pdf", providerAttachmentId: "dtok1", contentId: "cid1" });
    expect(n.autoSubmitted).toBe(false);
  });

  it("detects an auto-responder via the Auto-Submitted header", () => {
    const [n] = adapter.parse(payload({ Headers: { "Auto-Submitted": "auto-replied" } }));
    expect(n.autoSubmitted).toBe(true);
  });

  it("detects auto mail via Precedence: bulk", () => {
    const [n] = adapter.parse(payload({ Headers: { Precedence: "bulk" } }));
    expect(n.autoSubmitted).toBe(true);
  });

  it("skips items with no sender", () => {
    expect(adapter.parse({ items: [{ Subject: "x" }] })).toHaveLength(0);
  });

  it("accepts a bare array body too", () => {
    expect(adapter.parse(payload().items)).toHaveLength(1);
  });
});
