import { BrevoEmailTransport } from "./brevo-email-transport";
import type { OutboundEmailMessage } from "./email-transport";

function makeBrevo(apiKey: string | undefined = "secret-key"): BrevoEmailTransport {
  const config = {
    get: (name: string) => (name === "brevoApiKey" ? apiKey : name === "brevoSenderEmail" ? "sender@nonnis.test" : name === "brevoSenderName" ? "Nonni's" : undefined),
  };
  return new BrevoEmailTransport(config as never);
}

const msg: OutboundEmailMessage = { internalMessageId: "im1", to: "person@x.com", senderEmail: "sender@nonnis.test", subject: "Hi", html: "<p>h</p>", text: "h" };

afterEach(() => {
  jest.restoreAllMocks();
});

describe("BrevoEmailTransport", () => {
  it("reports configured only when key + sender are present", () => {
    expect(makeBrevo("k").configured).toBe(true);
    expect(makeBrevo("").configured).toBe(false);
  });

  it("returns ok + provider message id on 201", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ status: 201, headers: new Headers(), json: async () => ({ messageId: "<brevo-123>" }) } as Response);
    const r = await makeBrevo().sendEmail(msg);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.providerMessageId).toBe("<brevo-123>");
    // API key travels ONLY in the request header, never the outcome.
    expect(JSON.stringify(r)).not.toContain("secret-key");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["api-key"]).toBe("secret-key");
  });

  it("classifies 400 as PERMANENT, 401 as PERMANENT auth, 429 as RATE_LIMIT, 5xx as TEMPORARY", async () => {
    const res = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers), json: async () => ({ message: "err" }) }) as Response;
    jest.spyOn(global, "fetch").mockResolvedValueOnce(res(400));
    expect((await makeBrevo().sendEmail(msg))).toMatchObject({ ok: false, classification: "PERMANENT" });
    jest.spyOn(global, "fetch").mockResolvedValueOnce(res(401));
    expect((await makeBrevo().sendEmail(msg))).toMatchObject({ ok: false, classification: "PERMANENT", code: "AUTH" });
    jest.spyOn(global, "fetch").mockResolvedValueOnce(res(429, { "retry-after": "2" }));
    const rl = await makeBrevo().sendEmail(msg);
    expect(rl).toMatchObject({ ok: false, classification: "RATE_LIMIT", retryAfterMs: 2000 });
    jest.spyOn(global, "fetch").mockResolvedValueOnce(res(503));
    expect((await makeBrevo().sendEmail(msg))).toMatchObject({ ok: false, classification: "TEMPORARY" });
  });

  it("treats a network abort/timeout as AMBIGUOUS (never blind-retry)", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    jest.spyOn(global, "fetch").mockRejectedValueOnce(abort);
    expect((await makeBrevo().sendEmail(msg))).toMatchObject({ ok: false, classification: "AMBIGUOUS", code: "TIMEOUT" });
  });

  it("fails cleanly when not configured", async () => {
    expect((await makeBrevo("").sendEmail(msg))).toMatchObject({ ok: false, code: "NOT_CONFIGURED" });
  });
});

describe("BrevoEmailTransport Reply-To", () => {
  const REPLY = "reply-0123456789abcdef0123456789abcdef@reply.nonnisplacement.com";

  /** Capture the JSON body actually posted to Brevo. */
  async function sentBody(message: OutboundEmailMessage): Promise<Record<string, unknown>> {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ status: 201, headers: new Headers(), json: async () => ({ messageId: "<brevo-1>" }) } as Response);
    await makeBrevo().sendEmail(message);
    return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
  }

  it("sends the reply address in Brevo's replyTo field", async () => {
    const body = await sentBody({ ...msg, replyTo: REPLY });
    expect(body.replyTo).toEqual({ email: REPLY });
  });

  it("ALSO sends an explicit Reply-To header", async () => {
    // Brevo's replyTo field alone was observed to produce delivered mail with no
    // Reply-To header, which silently broke every inbound reply. The explicit
    // header is what guarantees the address is physically on the message.
    const body = await sentBody({ ...msg, replyTo: REPLY });
    expect((body.headers as Record<string, string>)["Reply-To"]).toBe(REPLY);
  });

  it("keeps the reply address even alongside the caller's own headers", async () => {
    const body = await sentBody({
      ...msg,
      replyTo: REPLY,
      headers: { "Message-Id": "<mid@x>", "List-Unsubscribe": "<https://x/u>" },
    });
    const headers = body.headers as Record<string, string>;
    expect(headers["Reply-To"]).toBe(REPLY);
    expect(headers["Message-Id"]).toBe("<mid@x>");
    expect(headers["List-Unsubscribe"]).toBe("<https://x/u>");
  });

  it("never changes the From/sender when a reply address is set", async () => {
    const body = await sentBody({ ...msg, replyTo: REPLY });
    expect(body.sender).toEqual({ email: "sender@nonnis.test", name: undefined });
  });

  it("omits Reply-To entirely for a message that has no reply address", async () => {
    const body = await sentBody(msg);
    expect(body.replyTo).toBeUndefined();
    expect((body.headers as Record<string, string>)["Reply-To"]).toBeUndefined();
  });
});
