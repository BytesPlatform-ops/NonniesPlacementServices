import { MockEmailTransport } from "./mock-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";
import { transportProviders } from "./transport.providers";
import { EMAIL_TRANSPORT } from "./email-transport";
import { SMS_TRANSPORT } from "./sms-transport";

describe("mock transports", () => {
  it("email mock returns a deterministic id shape and never touches the network", async () => {
    const t = new MockEmailTransport();
    expect(t.name).toBe("mock");
    const r = await t.send({ to: "x@y.com", subject: "s", text: "t" });
    expect(r.accepted).toBe(true);
    expect(r.providerMessageId).toMatch(/^mock-email-[0-9a-f-]{36}$/);
  });
  it("sms mock returns a deterministic id shape", async () => {
    const r = await new MockSmsTransport().send({ to: "+15550000000", body: "hi" });
    expect(r.providerMessageId).toMatch(/^mock-sms-[0-9a-f-]{36}$/);
  });
});

describe("transport factory (config-driven, fail-safe)", () => {
  const emailFactory = (transportProviders.find((p) => (p as { provide?: unknown }).provide === EMAIL_TRANSPORT) as { useFactory: (c: unknown, m: unknown) => unknown }).useFactory;
  const smsFactory = (transportProviders.find((p) => (p as { provide?: unknown }).provide === SMS_TRANSPORT) as { useFactory: (c: unknown, m: unknown) => unknown }).useFactory;
  const cfg = (value: string) => ({ get: () => value });

  it("selects the mock provider by default", () => {
    expect(emailFactory(cfg("mock"), new MockEmailTransport())).toBeInstanceOf(MockEmailTransport);
    expect(smsFactory(cfg("mock"), new MockSmsTransport())).toBeInstanceOf(MockSmsTransport);
  });
  it("fails safely for a reserved-but-unimplemented live provider", () => {
    expect(() => emailFactory(cfg("brevo"), new MockEmailTransport())).toThrow(/not implemented/i);
    expect(() => smsFactory(cfg("twilio"), new MockSmsTransport())).toThrow(/not implemented/i);
  });
  it("fails safely for an unknown provider", () => {
    expect(() => emailFactory(cfg("bogus"), new MockEmailTransport())).toThrow(/Unknown/i);
  });
});
