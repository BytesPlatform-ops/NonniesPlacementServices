import type { AppConfig } from "./configuration";
import { assertProductionConfig, collectProductionConfigProblems } from "./validate-config";

/** A production config with every mock-provider path selected and all core values valid. */
function prodConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "production",
    databaseUrl: "postgresql://u:p@db.internal:5432/nonnis",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-key",
    frontendUrl: "https://crm.nonnisplacement.com",
    communicationsPublicSiteUrl: "https://nonnisplacement.com",
    communicationsApiUrl: "https://api.nonnisplacement.com",
    formIngestToken: "a-sufficiently-long-ingest-token",
    communicationsUnsubscribeSecret: "a-sufficiently-long-unsub-secret",
    communicationsEmailProvider: "mock",
    communicationsSmsProvider: "mock",
    communicationsInboundEmailProvider: "mock",
    communicationsInboundEmailDomain: "reply.mock.local",
    ...overrides,
  } as unknown as AppConfig;
}

describe("production config validation", () => {
  it("does nothing outside production", () => {
    expect(collectProductionConfigProblems({ nodeEnv: "development" } as AppConfig)).toEqual([]);
    expect(collectProductionConfigProblems({ nodeEnv: "test" } as AppConfig)).toEqual([]);
  });

  it("accepts a fully configured production environment", () => {
    expect(collectProductionConfigProblems(prodConfig())).toEqual([]);
    expect(() => assertProductionConfig(prodConfig())).not.toThrow();
  });

  it("rejects localhost public URLs that would ship broken unsubscribe links", () => {
    const problems = collectProductionConfigProblems(prodConfig({ communicationsPublicSiteUrl: "http://localhost:3000" }));
    expect(problems.join(" ")).toMatch(/COMMUNICATIONS_PUBLIC_SITE_URL.*local development address/);
  });

  it("rejects a localhost FRONTEND_URL that would break CORS for the deployed CRM", () => {
    const problems = collectProductionConfigProblems(prodConfig({ frontendUrl: "http://localhost:3001" }));
    expect(problems.join(" ")).toMatch(/FRONTEND_URL/);
  });

  it("requires https for public URLs", () => {
    const problems = collectProductionConfigProblems(prodConfig({ communicationsApiUrl: "http://api.nonnisplacement.com" }));
    expect(problems.join(" ")).toMatch(/COMMUNICATIONS_API_URL must use https/);
  });

  it("rejects missing and low-entropy shared secrets", () => {
    expect(collectProductionConfigProblems(prodConfig({ formIngestToken: undefined })).join(" ")).toMatch(/FORM_INGEST_TOKEN is required/);
    expect(collectProductionConfigProblems(prodConfig({ communicationsUnsubscribeSecret: "short" })).join(" ")).toMatch(/shorter than 16/);
  });

  it("requires core infrastructure values", () => {
    const problems = collectProductionConfigProblems(prodConfig({ databaseUrl: undefined, supabaseServiceRoleKey: undefined }));
    expect(problems.join(" ")).toMatch(/DATABASE_URL is required/);
    expect(problems.join(" ")).toMatch(/SUPABASE_SERVICE_ROLE_KEY is required/);
  });

  it("only enforces provider credentials when a live provider is selected", () => {
    expect(collectProductionConfigProblems(prodConfig())).toEqual([]);
    const live = collectProductionConfigProblems(prodConfig({ communicationsEmailProvider: "brevo" }));
    expect(live.join(" ")).toMatch(/BREVO_API_KEY/);
    expect(live.join(" ")).toMatch(/COMMUNICATIONS_WEBHOOK_SECRET/);
  });

  it("rejects the mock reply domain when live inbound email is enabled", () => {
    const problems = collectProductionConfigProblems(
      prodConfig({ communicationsInboundEmailProvider: "brevo", communicationsInboundEmailSecret: "a-long-enough-inbound-secret" }),
    );
    expect(problems.join(" ")).toMatch(/COMMUNICATIONS_INBOUND_EMAIL_DOMAIN is still the mock reply domain/);
  });

  it("requires Twilio credentials, a sender, a webhook base URL and A2P ack for live SMS", () => {
    const problems = collectProductionConfigProblems(prodConfig({ communicationsSmsProvider: "twilio" }));
    const joined = problems.join(" ");
    expect(joined).toMatch(/TWILIO_ACCOUNT_SID/);
    expect(joined).toMatch(/TWILIO_API_KEY_SID/);
    expect(joined).toMatch(/TWILIO_AUTH_TOKEN/);
    expect(joined).toMatch(/TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER/);
    expect(joined).toMatch(/COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL/);
    expect(joined).toMatch(/TWILIO_A2P_APPROVED/);
  });

  it("aggregates every problem into one error and never logs values", () => {
    const bad = prodConfig({ databaseUrl: undefined, formIngestToken: "sekret-value-here", communicationsPublicSiteUrl: "http://localhost:3000" });
    let message = "";
    try {
      assertProductionConfig(bad);
    } catch (err) {
      message = err instanceof Error ? err.message : "";
    }
    expect(message).toMatch(/Refusing to start: 2 production configuration problem\(s\)/);
    expect(message).not.toContain("sekret-value-here");
    expect(message).not.toContain("localhost:3000");
  });
});
