import { MockEmailTransport } from "./mock-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";
import { BrevoEmailTransport } from "./brevo-email-transport";
import { MockEmailInboundAdapter } from "./mock-email-inbound-adapter";
import { BrevoEmailInboundAdapter } from "./brevo-email-inbound-adapter";
import { resolveEmailTransport, resolveInboundAdapter } from "./transport.providers";
import type { OutboundEmailMessage } from "./email-transport";

const msg = (to: string): OutboundEmailMessage => ({ internalMessageId: "m1", to, senderEmail: "s@nonnis.test", subject: "s", html: "<p>h</p>", text: "h" });

describe("mock email transport", () => {
  it("is always configured and returns a deterministic id with zero network", async () => {
    const t = new MockEmailTransport();
    expect(t.name).toBe("mock");
    expect(t.configured).toBe(true);
    const r = await t.sendEmail(msg("ok@x.com"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.providerMessageId).toMatch(/^mock-email-[0-9a-f-]{36}$/);
  });
  it("simulates bounce / rate-limit / timeout / failure by recipient local-part", async () => {
    const t = new MockEmailTransport();
    expect((await t.sendEmail(msg("bounce@x.com"))).ok).toBe(false);
    const rl = await t.sendEmail(msg("ratelimit@x.com"));
    expect(rl.ok === false && rl.classification).toBe("RATE_LIMIT");
    const to = await t.sendEmail(msg("timeout@x.com"));
    expect(to.ok === false && to.classification).toBe("AMBIGUOUS");
    const f = await t.sendEmail(msg("fail@x.com"));
    expect(f.ok === false && f.classification).toBe("TEMPORARY");
  });
});

describe("mock sms transport", () => {
  it("returns a deterministic id", async () => {
    const r = await new MockSmsTransport().send({ to: "+15550000000", body: "hi" });
    expect(r.providerMessageId).toMatch(/^mock-sms-[0-9a-f-]{36}$/);
  });
});

describe("resolveEmailTransport (fail-safe selection)", () => {
  const mock = new MockEmailTransport();
  const cfg = (v: unknown) => ({ get: () => v }) as never;
  const brevoConfigured = { name: "brevo", configured: true } as unknown as BrevoEmailTransport;
  const brevoUnconfigured = { name: "brevo", configured: false } as unknown as BrevoEmailTransport;

  it("selects mock by default", () => {
    expect(resolveEmailTransport("mock", mock, brevoUnconfigured)).toBe(mock);
  });
  it("selects brevo when configured", () => {
    expect(resolveEmailTransport("brevo", mock, brevoConfigured)).toBe(brevoConfigured);
  });
  it("fails safely when brevo is selected but not configured (never falls back to mock)", () => {
    expect(() => resolveEmailTransport("brevo", mock, brevoUnconfigured)).toThrow(/missing/i);
  });
  it("fails for an unknown provider", () => {
    expect(() => resolveEmailTransport("bogus", mock, brevoConfigured)).toThrow(/Unknown/i);
  });
  void cfg;
});

describe("resolveInboundAdapter (fail-safe selection)", () => {
  const mock = new MockEmailInboundAdapter();
  const brevoConfigured = { name: "brevo", configured: true } as unknown as BrevoEmailInboundAdapter;
  const brevoUnconfigured = { name: "brevo", configured: false } as unknown as BrevoEmailInboundAdapter;

  it("selects the mock inbound adapter by default", () => {
    expect(resolveInboundAdapter("mock", mock, brevoUnconfigured)).toBe(mock);
  });
  it("selects brevo inbound when configured", () => {
    expect(resolveInboundAdapter("brevo", mock, brevoConfigured)).toBe(brevoConfigured);
  });
  it("fails safely when brevo inbound is selected but not configured", () => {
    expect(() => resolveInboundAdapter("brevo", mock, brevoUnconfigured)).toThrow(/missing/i);
  });
  it("fails for an unknown inbound provider", () => {
    expect(() => resolveInboundAdapter("bogus", mock, brevoConfigured)).toThrow(/Unknown/i);
  });
});

describe("MockEmailInboundAdapter.parse", () => {
  it("parses a mock inbound body (single or array) and inlines attachments", async () => {
    const adapter = new MockEmailInboundAdapter();
    const [n] = adapter.parse({ from: { address: "a@b.com", name: "A" }, to: ["reply-tok@reply.mock.local"], subject: "Re: hi", text: "hello", messageId: "<m1>", attachments: [{ fileName: "f.pdf", mimeType: "application/pdf", contentBase64: Buffer.from("pdf").toString("base64") }] });
    expect(n.from.address).toBe("a@b.com");
    expect(n.destinations).toContain("reply-tok@reply.mock.local");
    expect(n.attachments[0]?.fileName).toBe("f.pdf");
    const buf = await adapter.fetchAttachment(n.attachments[0]!, 1024);
    expect(buf?.toString()).toBe("pdf");
  });
});
