import { MockEmailTransport } from "./mock-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";
import { BrevoEmailTransport } from "./brevo-email-transport";
import { resolveEmailTransport } from "./transport.providers";
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
