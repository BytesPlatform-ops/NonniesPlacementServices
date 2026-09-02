import type { ConfigService } from "@nestjs/config";
import type { SmsTransport } from "../providers/sms-transport";
import { inboundWebhookUrl, smsReadiness, statusCallbackUrl } from "./sms-config";

const cfg = (values: Record<string, unknown>) => ({ get: (n: string) => values[n] }) as unknown as ConfigService<never, true>;
const transport = (configured: boolean, error: string | null = null) => ({ name: configured ? "twilio" : "twilio", configured, configurationError: error }) as unknown as SmsTransport;

const LIVE = {
  communicationsSmsProvider: "twilio",
  twilioMessagingServiceSid: "MG_service",
  twilioPhoneNumber: "+14155550100",
  twilioA2pApproved: true,
  twilioAuthToken: "token",
  communicationsTwilioWebhookBaseUrl: "https://crm.example.com",
};

describe("smsReadiness", () => {
  it("allows campaigns and replies in mock mode with no credentials at all", () => {
    const r = smsReadiness(cfg({ communicationsSmsProvider: "mock" }), transport(true));
    expect(r).toMatchObject({ mockMode: true, campaignSendingAllowed: true, directReplyAllowed: true, campaignBlockedReason: null });
  });

  it("allows live campaigns only when configured, sender-ready and A2P-acknowledged", () => {
    const r = smsReadiness(cfg(LIVE), transport(true));
    expect(r).toMatchObject({ mockMode: false, campaignSendingAllowed: true, a2pApproved: true, messagingServiceConfigured: true, webhooksConfigured: true });
  });

  it("blocks live campaigns when the operator has not acknowledged A2P registration", () => {
    const r = smsReadiness(cfg({ ...LIVE, twilioA2pApproved: false }), transport(true));
    expect(r.campaignSendingAllowed).toBe(false);
    expect(r.campaignBlockedReason).toMatch(/A2P/i);
    // 1:1 conversational replies are NOT gated on the bulk-campaign A2P flag.
    expect(r.directReplyAllowed).toBe(true);
  });

  it("blocks both campaigns and replies when the provider is not fully configured", () => {
    const r = smsReadiness(cfg(LIVE), transport(false, "Missing: TWILIO_ACCOUNT_SID."));
    expect(r.campaignSendingAllowed).toBe(false);
    expect(r.directReplyAllowed).toBe(false);
    expect(r.directReplyBlockedReason).toMatch(/TWILIO_ACCOUNT_SID/);
  });

  it("blocks live campaigns with no Messaging Service and no sending number", () => {
    const r = smsReadiness(cfg({ ...LIVE, twilioMessagingServiceSid: undefined, twilioPhoneNumber: undefined }), transport(true));
    expect(r.campaignBlockedReason).toMatch(/Messaging Service|sending number/i);
  });

  it("reports webhooks unconfigured without a public URL or Auth Token", () => {
    expect(smsReadiness(cfg({ ...LIVE, communicationsTwilioWebhookBaseUrl: undefined }), transport(true)).webhooksConfigured).toBe(false);
    expect(smsReadiness(cfg({ ...LIVE, twilioAuthToken: undefined }), transport(true)).webhooksConfigured).toBe(false);
  });

  it("never exposes a credential value in the readiness payload", () => {
    const r = smsReadiness(cfg({ ...LIVE, twilioAuthToken: "super-secret-token" }), transport(true));
    expect(JSON.stringify(r)).not.toContain("super-secret-token");
  });
});

describe("webhook URLs", () => {
  it("builds the exact public callback URLs Twilio will sign", () => {
    expect(statusCallbackUrl(cfg(LIVE))).toBe("https://crm.example.com/api/v1/webhooks/communications/sms/status");
    expect(inboundWebhookUrl(cfg(LIVE))).toBe("https://crm.example.com/api/v1/webhooks/communications/sms/inbound");
  });
  it("returns undefined when no public base URL is configured", () => {
    expect(statusCallbackUrl(cfg({}))).toBeUndefined();
  });
});
