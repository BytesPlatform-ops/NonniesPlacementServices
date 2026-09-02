import type { AppConfig } from "./configuration";

/**
 * Fail-fast production configuration validation.
 *
 * Every value in `loadConfiguration()` tolerates being unset so that local
 * development, tests and CI boot with zero setup. That convenience is dangerous
 * in production: a missing variable silently falls back to a localhost or mock
 * default, which does not crash — it ships wrong behaviour. The worst cases are
 * user-visible and compliance-relevant (unsubscribe links pointing at
 * `http://localhost:3000`, Reply-To addresses at `reply.mock.local`, CORS
 * pinned to `http://localhost:3001` so the deployed CRM cannot call the API).
 *
 * This check runs once at boot. Outside production it does nothing. In
 * production it collects EVERY problem and throws a single error naming the
 * offending variables — never their values, so nothing secret reaches logs.
 */

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/i;
const MIN_SECRET_LENGTH = 16;

type Problem = string;

function requirePresent(problems: Problem[], name: string, value: string | undefined): void {
  if (!value || value.trim() === "") problems.push(`${name} is required in production but is not set.`);
}

function requireSecret(problems: Problem[], name: string, value: string | undefined): void {
  if (!value || value.trim() === "") {
    problems.push(`${name} is required in production but is not set.`);
  } else if (value.trim().length < MIN_SECRET_LENGTH) {
    problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters — use a high-entropy value.`);
  }
}

function requirePublicUrl(problems: Problem[], name: string, value: string | undefined): void {
  if (!value || value.trim() === "") {
    problems.push(`${name} is required in production but is not set.`);
    return;
  }
  if (LOCAL_HOST.test(value)) {
    problems.push(`${name} still points at a local development address — set the real public URL.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") problems.push(`${name} must use https in production.`);
  } catch {
    problems.push(`${name} is not a valid absolute URL.`);
  }
}

/** Returns the list of production configuration problems (empty when healthy). */
export function collectProductionConfigProblems(config: AppConfig): Problem[] {
  if (config.nodeEnv !== "production") return [];
  const problems: Problem[] = [];

  // Core infrastructure.
  requirePresent(problems, "DATABASE_URL", config.databaseUrl);
  requirePresent(problems, "SUPABASE_URL", config.supabaseUrl);
  requirePresent(problems, "SUPABASE_ANON_KEY", config.supabaseAnonKey);
  requirePresent(problems, "SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceRoleKey);

  // Public URLs that end up in emails, links and CORS. A localhost value here is
  // silently broken rather than loudly broken, so it must be rejected at boot.
  requirePublicUrl(problems, "FRONTEND_URL", config.frontendUrl);
  requirePublicUrl(problems, "COMMUNICATIONS_PUBLIC_SITE_URL", config.communicationsPublicSiteUrl);
  requirePublicUrl(problems, "COMMUNICATIONS_API_URL", config.communicationsApiUrl);

  // Shared secrets.
  requireSecret(problems, "FORM_INGEST_TOKEN", config.formIngestToken);
  requireSecret(problems, "COMMUNICATIONS_UNSUBSCRIBE_SECRET", config.communicationsUnsubscribeSecret);

  // Outbound email: only enforced when a live provider is selected.
  if (config.communicationsEmailProvider !== "mock") {
    requirePresent(problems, "BREVO_API_KEY", config.brevoApiKey);
    requirePresent(problems, "BREVO_SENDER_EMAIL", config.brevoSenderEmail);
    requireSecret(problems, "COMMUNICATIONS_WEBHOOK_SECRET", config.communicationsWebhookSecret);
  }

  // Inbound email: a live adapter must have a real reply domain and a secret.
  if (config.communicationsInboundEmailProvider !== "mock") {
    requireSecret(problems, "COMMUNICATIONS_INBOUND_EMAIL_SECRET", config.communicationsInboundEmailSecret);
    const domain = config.communicationsInboundEmailDomain;
    if (!domain || domain === "reply.mock.local" || domain.endsWith(".local")) {
      problems.push("COMMUNICATIONS_INBOUND_EMAIL_DOMAIN is still the mock reply domain — set the real inbound domain.");
    }
  }

  // Outbound SMS: only enforced when a live provider is selected.
  if (config.communicationsSmsProvider !== "mock") {
    requirePresent(problems, "TWILIO_ACCOUNT_SID", config.twilioAccountSid);
    if (!config.twilioApiKeySid || !config.twilioApiKeySecret) {
      problems.push("TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are required for live SMS sending.");
    }
    // Signature validation of inbound/status webhooks needs the account auth token.
    requirePresent(problems, "TWILIO_AUTH_TOKEN", config.twilioAuthToken);
    if (!config.twilioMessagingServiceSid && !config.twilioPhoneNumber) {
      problems.push("Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER must be set for live SMS sending.");
    }
    requirePublicUrl(problems, "COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL", config.communicationsTwilioWebhookBaseUrl);
    if (!config.twilioA2pApproved) {
      problems.push("TWILIO_A2P_APPROVED is not set — confirm A2P 10DLC registration before enabling live SMS.");
    }
  }

  return problems;
}

/** Throws a single aggregated error when production configuration is unsafe. */
export function assertProductionConfig(config: AppConfig): void {
  const problems = collectProductionConfigProblems(config);
  if (problems.length === 0) return;
  throw new Error(
    `Refusing to start: ${problems.length} production configuration problem(s).\n` +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\nSee docs/PRODUCTION_RUNBOOK.md. (Values are never logged.)",
  );
}
