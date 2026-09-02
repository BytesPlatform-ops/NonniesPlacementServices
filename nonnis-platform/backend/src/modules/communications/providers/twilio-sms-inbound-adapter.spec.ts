import { createHmac } from "node:crypto";
import { TwilioSmsInboundAdapter } from "./twilio-sms-inbound-adapter";
import { MockSmsInboundAdapter } from "./mock-sms-inbound-adapter";

const AUTH_TOKEN = "test_auth_token_value";
const URL = "https://crm.example.com/api/v1/webhooks/communications/sms/inbound";

function makeAdapter(overrides: Record<string, unknown> = {}): TwilioSmsInboundAdapter {
  const values: Record<string, unknown> = { twilioAuthToken: AUTH_TOKEN, communicationsTwilioWebhookBaseUrl: "https://crm.example.com", ...overrides };
  return new TwilioSmsInboundAdapter({ get: (n: string) => values[n] } as never);
}

/** Build a signature exactly as Twilio documents: URL + sorted key/value pairs, HMAC-SHA1, base64. */
function sign(url: string, params: Record<string, string>, token = AUTH_TOKEN): string {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
}

const INBOUND = {
  MessageSid: "SM0123456789abcdef",
  SmsSid: "SM0123456789abcdef",
  AccountSid: "AC_account",
  MessagingServiceSid: "MG_service",
  From: "+14155550161",
  To: "+14155550100",
  Body: "Yes please, that works",
  NumMedia: "0",
  NumSegments: "1",
};

describe("TwilioSmsInboundAdapter signature validation", () => {
  it("accepts a correctly signed request", () => {
    expect(makeAdapter().verify(URL, INBOUND, sign(URL, INBOUND))).toBe(true);
  });

  it("rejects a tampered parameter (the full parameter set is signed)", () => {
    const signature = sign(URL, INBOUND);
    expect(makeAdapter().verify(URL, { ...INBOUND, Body: "Tampered" }, signature)).toBe(false);
  });

  it("rejects a request signed for a different URL (proxy-rewritten host/path)", () => {
    const signature = sign("https://internal.local/api/v1/webhooks/communications/sms/inbound", INBOUND);
    expect(makeAdapter().verify(URL, INBOUND, signature)).toBe(false);
  });

  it("rejects a signature made with the wrong Auth Token", () => {
    expect(makeAdapter().verify(URL, INBOUND, sign(URL, INBOUND, "someone-elses-token"))).toBe(false);
  });

  it("rejects a missing signature and refuses to verify without an Auth Token", () => {
    expect(makeAdapter().verify(URL, INBOUND, undefined)).toBe(false);
    expect(makeAdapter({ twilioAuthToken: undefined }).verify(URL, INBOUND, sign(URL, INBOUND))).toBe(false);
  });

  it("is only configured when the Auth Token and public webhook URL are both set", () => {
    expect(makeAdapter().configured).toBe(true);
    expect(makeAdapter({ twilioAuthToken: undefined }).configured).toBe(false);
    expect(makeAdapter({ communicationsTwilioWebhookBaseUrl: undefined }).configured).toBe(false);
  });
});

describe("TwilioSmsInboundAdapter payload normalization", () => {
  const adapter = makeAdapter();

  it("normalizes an inbound message", () => {
    expect(adapter.parseInbound(INBOUND)).toEqual({
      providerMessageId: "SM0123456789abcdef",
      fromPhone: "+14155550161",
      toPhone: "+14155550100",
      body: "Yes please, that works",
      optOutType: undefined,
      numMedia: 0,
    });
  });

  it("carries the provider's authoritative OptOutType when Advanced Opt-Out is on", () => {
    expect(adapter.parseInbound({ ...INBOUND, Body: "STOP", OptOutType: "STOP" })?.optOutType).toBe("STOP");
    expect(adapter.parseInbound({ ...INBOUND, OptOutType: "START" })?.optOutType).toBe("START");
    expect(adapter.parseInbound({ ...INBOUND, OptOutType: "HELP" })?.optOutType).toBe("HELP");
    expect(adapter.parseInbound({ ...INBOUND, OptOutType: "NONSENSE" })?.optOutType).toBeUndefined();
  });

  it("reports media count without fetching any media", () => {
    expect(adapter.parseInbound({ ...INBOUND, NumMedia: "2" })?.numMedia).toBe(2);
  });

  it("returns null for a payload missing the required identity fields", () => {
    expect(adapter.parseInbound({ Body: "hi" })).toBeNull();
  });

  it("normalizes a status callback and truncates the provider error text", () => {
    const parsed = adapter.parseStatus({ MessageSid: "SM1", MessageStatus: "delivered", ErrorCode: "", ErrorMessage: "x".repeat(500) });
    expect(parsed).toMatchObject({ providerMessageId: "SM1", providerStatus: "delivered", errorCode: undefined });
    expect(parsed?.errorMessageSafe?.length).toBe(200);
    expect(adapter.parseStatus({ MessageSid: "SM1" })).toBeNull();
  });
});

describe("MockSmsInboundAdapter", () => {
  const dev = new MockSmsInboundAdapter({ get: () => "development" } as never);
  const prod = new MockSmsInboundAdapter({ get: () => "production" } as never);

  it("bypasses verification in development but NEVER in production", () => {
    expect(dev.verify()).toBe(true);
    expect(prod.verify()).toBe(false);
  });

  it("parses the same provider-shaped fields as Twilio", () => {
    expect(dev.parseInbound(INBOUND)?.fromPhone).toBe("+14155550161");
  });
});
