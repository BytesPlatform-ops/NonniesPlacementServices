import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../database/prisma.service";
import type { EmailTransport } from "../providers/email-transport";
import type { EmailInboundAdapter } from "../providers/email-inbound-adapter";
import type { SmsTransport } from "../providers/sms-transport";
import type { SmsInboundAdapter } from "../providers/sms-inbound-adapter";
import { CommunicationsStatusService } from "./communications-status.service";

const SECRETS = {
  brevoApiKey: "brevo-secret-key-value",
  twilioAuthToken: "twilio-auth-token-value",
  twilioApiKeySecret: "twilio-api-secret-value",
  communicationsWebhookSecret: "delivery-webhook-secret",
  communicationsInboundEmailSecret: "inbound-webhook-secret",
  supabaseServiceRoleKey: "supabase-service-role-key",
};

function build(overrides: Record<string, unknown> = {}, opts: { emailConfigured?: boolean; smsConfigured?: boolean } = {}) {
  const values: Record<string, unknown> = {
    communicationsEmailProvider: "mock",
    communicationsSmsProvider: "mock",
    communicationsInboundEmailProvider: "mock",
    communicationsInboundEmailDomain: "reply.mock.local",
    brevoSenderEmail: undefined,
    brevoSenderName: undefined,
    emailDispatchEnabled: true,
    smsDispatchEnabled: true,
    twilioA2pApproved: false,
    ...SECRETS,
    ...overrides,
  };
  const config = { get: (n: string) => values[n] } as unknown as ConfigService<never, true>;
  const emailTransport = { name: values.communicationsEmailProvider as string, configured: opts.emailConfigured ?? true, sendEmail: jest.fn() } as unknown as EmailTransport;
  const emailInbound = { name: values.communicationsInboundEmailProvider as string, configured: true } as unknown as EmailInboundAdapter;
  const smsTransport = { name: values.communicationsSmsProvider as string, configured: opts.smsConfigured ?? true, configurationError: opts.smsConfigured === false ? "Missing: TWILIO_ACCOUNT_SID." : null } as unknown as SmsTransport;
  const smsInbound = { name: "mock", configured: true } as unknown as SmsInboundAdapter;
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    $transaction: jest.fn().mockResolvedValue(new Array(16).fill(0)),
    communicationEmailCampaignRecipient: { count },
    communicationSmsCampaignRecipient: { count },
    communicationMessage: { count },
    communicationInboundEmailReview: { count },
  } as unknown as PrismaService;
  return new CommunicationsStatusService(prisma, config, emailTransport, emailInbound, smsTransport, smsInbound);
}

describe("communications configuration", () => {
  it("reports MOCK for both channels with no credentials at all", () => {
    const c = build().configuration();
    expect(c.email).toMatchObject({ readiness: "MOCK", mockMode: true });
    expect(c.sms).toMatchObject({ readiness: "MOCK", mockMode: true });
    expect(c.email.missing).toEqual([]);
  });

  it("NEVER returns a secret value for any provider combination", () => {
    for (const combo of [
      {},
      { communicationsEmailProvider: "brevo", communicationsInboundEmailProvider: "brevo", brevoSenderEmail: "s@nonnis.com" },
      { communicationsSmsProvider: "twilio", twilioA2pApproved: true, twilioMessagingServiceSid: "MG1", communicationsTwilioWebhookBaseUrl: "https://crm.example.com" },
      { communicationsEmailProvider: "brevo", communicationsSmsProvider: "twilio" },
    ]) {
      const serialized = JSON.stringify(build(combo).configuration());
      for (const secret of Object.values(SECRETS)) {
        expect(serialized).not.toContain(secret);
      }
    }
  });

  it("lists exactly what live email is missing", () => {
    const c = build({ communicationsEmailProvider: "brevo", brevoApiKey: undefined, brevoSenderEmail: undefined }).configuration();
    expect(c.email.readiness).toBe("INCOMPLETE");
    expect(c.email.missing).toEqual(expect.arrayContaining(["BREVO_API_KEY", "BREVO_SENDER_EMAIL"]));
  });

  it("reports email LIVE_READY only when sending AND inbound are both configured", () => {
    const ready = build({
      communicationsEmailProvider: "brevo",
      communicationsInboundEmailProvider: "brevo",
      communicationsInboundEmailDomain: "reply.nonnis.com",
      brevoSenderEmail: "hello@nonnis.com",
    }).configuration();
    expect(ready.email.readiness).toBe("LIVE_READY");

    const noInbound = build({ communicationsEmailProvider: "brevo", brevoSenderEmail: "hello@nonnis.com" }).configuration();
    expect(noInbound.email.readiness).toBe("INCOMPLETE");
    expect(noInbound.email.missing.join(" ")).toMatch(/inbound/i);
  });

  it("blocks live SMS until A2P is acknowledged, and reports it as missing", () => {
    const c = build({ communicationsSmsProvider: "twilio", twilioMessagingServiceSid: "MG1", communicationsTwilioWebhookBaseUrl: "https://crm.example.com" }).configuration();
    expect(c.sms.readiness).toBe("INCOMPLETE");
    expect(c.sms.missing.join(" ")).toMatch(/A2P/i);
    expect(c.sms.details.campaignSendingAllowed).toBe(false);
  });

  it("reports SMS LIVE_READY when everything including A2P is present", () => {
    const c = build({
      communicationsSmsProvider: "twilio",
      twilioMessagingServiceSid: "MG1",
      communicationsTwilioWebhookBaseUrl: "https://crm.example.com",
      twilioA2pApproved: true,
    }).configuration();
    expect(c.sms).toMatchObject({ readiness: "LIVE_READY", missing: [] });
  });

  it("supports mixed mode — live email with mock SMS", () => {
    const c = build({
      communicationsEmailProvider: "brevo",
      communicationsInboundEmailProvider: "brevo",
      communicationsInboundEmailDomain: "reply.nonnis.com",
      brevoSenderEmail: "hello@nonnis.com",
    }).configuration();
    expect(c.email.readiness).toBe("LIVE_READY");
    expect(c.sms.readiness).toBe("MOCK");
  });

  it("surfaces an unconfigured live SMS transport instead of pretending it works", () => {
    const c = build({ communicationsSmsProvider: "twilio" }, { smsConfigured: false }).configuration();
    expect(c.sms.readiness).toBe("INCOMPLETE");
    expect(c.sms.missing.join(" ")).toMatch(/TWILIO_ACCOUNT_SID/);
  });
});

describe("communications health", () => {
  it("returns operational counts without calling any provider", async () => {
    const svc = build();
    const health = await svc.health();
    expect(health.email).toMatchObject({ provider: "mock", dispatcherEnabled: true });
    expect(health).toHaveProperty("replies.staleClaims");
    expect(health).toHaveProperty("inboundReviewPending");
  });
});
