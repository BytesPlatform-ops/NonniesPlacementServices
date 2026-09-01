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
