import { TwilioSmsTransport } from "./twilio-sms-transport";
import type { OutboundSmsMessage } from "./sms-transport";

const FULL = {
  twilioAccountSid: "AC_test_account",
  twilioApiKeySid: "SK_test_key",
  twilioApiKeySecret: "super-secret-value",
  twilioAuthToken: "auth-token-value",
  twilioMessagingServiceSid: "MG_test_service",
  twilioPhoneNumber: "+15550001000",
};

function makeTwilio(overrides: Partial<typeof FULL> = {}): TwilioSmsTransport {
  const values: Record<string, unknown> = { ...FULL, ...overrides };
  return new TwilioSmsTransport({ get: (name: string) => values[name] } as never);
}

const msg: OutboundSmsMessage = { internalMessageId: "im1", to: "+15551234567", body: "Hello", statusCallbackUrl: "https://crm.example.com/api/v1/webhooks/communications/sms/status" };

const res = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  ({ status, headers: new Headers(headers), json: async () => body }) as Response;

afterEach(() => jest.restoreAllMocks());

describe("TwilioSmsTransport configuration", () => {
  it("is configured with an account SID, credentials and a sender", () => {
    expect(makeTwilio().configured).toBe(true);
    expect(makeTwilio().configurationError).toBeNull();
  });
  it("reports precisely what is missing, without leaking any secret", () => {
    const t = makeTwilio({ twilioAccountSid: undefined, twilioApiKeySid: undefined, twilioApiKeySecret: undefined, twilioAuthToken: undefined, twilioMessagingServiceSid: undefined, twilioPhoneNumber: undefined });
    expect(t.configured).toBe(false);
    expect(t.configurationError).toMatch(/TWILIO_ACCOUNT_SID/);
    expect(t.configurationError).not.toContain("super-secret-value");
  });
  it("accepts Account SID + Auth Token when no API key is present", () => {
    expect(makeTwilio({ twilioApiKeySid: undefined, twilioApiKeySecret: undefined }).configured).toBe(true);
  });
});

describe("TwilioSmsTransport.sendSms", () => {
  it("posts through the Messaging Service and never an arbitrary From", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(res(201, { sid: "SM123", status: "queued", from: "+15550001000", num_segments: "2" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r).toMatchObject({ providerMessageId: "SM123", providerStatus: "queued", fromNumber: "+15550001000", providerSegmentCount: 2 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC_test_account/Messages.json");
    const form = new URLSearchParams(init.body as string);
    expect(form.get("MessagingServiceSid")).toBe("MG_test_service");
    expect(form.get("From")).toBeNull();
    expect(form.get("To")).toBe("+15551234567");
    expect(form.get("StatusCallback")).toContain("/webhooks/communications/sms/status");
  });

  it("authenticates with the API key pair, and the secret never reaches the outcome", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(res(201, { sid: "SM1", status: "queued" }));
    const r = await makeTwilio().sendSms(msg);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const auth = (init.headers as Record<string, string>).authorization;
    expect(Buffer.from(auth.replace("Basic ", ""), "base64").toString()).toBe("SK_test_key:super-secret-value");
    expect(JSON.stringify(r)).not.toContain("super-secret-value");
  });

  it("falls back to the From number when no Messaging Service is configured", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(res(201, { sid: "SM1", status: "queued" }));
    await makeTwilio({ twilioMessagingServiceSid: undefined }).sendSms(msg);
    const form = new URLSearchParams((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(form.get("From")).toBe("+15550001000");
  });

  it("classifies 429 as a rate limit and honours Retry-After", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(res(429, { code: 20429, message: "Too many requests" }, { "retry-after": "3" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r).toMatchObject({ classification: "RATE_LIMIT", retryAfterMs: 3000 });
  });

  it("classifies 5xx as temporary and 401 as a configuration error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(res(503, {}));
    expect((await makeTwilio().sendSms(msg)) as { classification: string }).toMatchObject({ classification: "TEMPORARY" });
    jest.restoreAllMocks();
    jest.spyOn(global, "fetch").mockResolvedValue(res(401, { code: 20003, message: "Authenticate" }));
    expect((await makeTwilio().sendSms(msg)) as { classification: string }).toMatchObject({ classification: "CONFIGURATION" });
  });

  it("classifies Twilio 21610 as a provider opt-out block (recipient replied STOP)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(res(400, { code: 21610, message: "Attempt to send to unsubscribed recipient" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r).toMatchObject({ classification: "PROVIDER_OPT_OUT_BLOCK", code: "21610" });
  });

  it("classifies other 4xx as permanent", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(res(400, { code: 21211, message: "Invalid 'To' number" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok === false && r.classification).toBe("PERMANENT");
  });

  it("treats a network timeout as AMBIGUOUS so a duplicate SMS is never sent", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r).toMatchObject({ classification: "AMBIGUOUS", code: "TIMEOUT" });
  });

  it("treats an accepted response with no SID as ambiguous rather than resending", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(res(201, { status: "queued" }));
    const r = await makeTwilio().sendSms(msg);
    expect(r.ok === false && r.classification).toBe("AMBIGUOUS");
  });

  it("fails as a configuration error rather than sending when unconfigured", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const r = await makeTwilio({ twilioAccountSid: undefined }).sendSms(msg);
    expect(r.ok === false && r.classification).toBe("CONFIGURATION");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
