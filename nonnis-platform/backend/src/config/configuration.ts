/**
 * Centralized, typed environment configuration. Loaded once via @nestjs/config.
 * Validation is intentionally non-throwing so the app can build and be tested
 * without external services; missing critical values are surfaced as warnings
 * and fail loudly only when the dependent operation is attempted.
 *
 * SECURITY: the Supabase service-role key is a backend-only secret. It is never
 * exposed to the frontend and never logged.
 */
export interface AppConfig {
  port: number;
  frontendUrl: string;
  databaseUrl: string | undefined;
  nodeEnv: string;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  /** Shared secret for the server-to-server website form ingestion endpoint. */
  formIngestToken: string | undefined;
  /** Transactional email (referral notifications). Optional — absent = no send. */
  smtpHost: string | undefined;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  mailFrom: string | undefined;
  /** Communications transport selection. Defaults to the mock providers so
   *  development/tests never require live Brevo/Twilio credentials. */
  communicationsEmailProvider: string;
  communicationsSmsProvider: string;
  /** Brevo transactional-email adapter config (only required when provider=brevo). */
  brevoApiKey: string | undefined;
  brevoSenderEmail: string | undefined;
  brevoSenderName: string | undefined;
  /** Public marketing site base URL for the friendly unsubscribe page. */
  communicationsPublicSiteUrl: string;
  /** Backend public base URL for one-click List-Unsubscribe headers. */
  communicationsApiUrl: string;
  /** HMAC secret backing the public unsubscribe token (stored-token fallback if unset). */
  communicationsUnsubscribeSecret: string | undefined;
  /** Shared secret guarding the provider delivery-event webhook. */
  communicationsWebhookSecret: string | undefined;
  /** Email dispatcher tuning. */
  emailDispatchEnabled: boolean;
  emailDispatchBatchSize: number;
  emailDispatchConcurrency: number;
  emailDispatchPollMs: number;
  /** Inbound email (15C) — replies routed back into the CRM via provider webhook. */
  communicationsInboundEmailProvider: string;
  /** Dedicated inbound reply (sub)domain, e.g. reply.nonnis.com. Mock uses a safe default. */
  communicationsInboundEmailDomain: string;
  /** High-entropy secret guarding the inbound webhook (Brevo inbound is not signed). */
  communicationsInboundEmailSecret: string | undefined;
  communicationsInboundMaxBodyBytes: number;
  communicationsInboundMaxAttachmentBytes: number;
  communicationsInboundMaxAttachments: number;
  /** SMS / Twilio (15D). Everything defaults to mock — no live credentials needed. */
  twilioAccountSid: string | undefined;
  /** Preferred send credentials (API Key SID + Secret). */
  twilioApiKeySid: string | undefined;
  twilioApiKeySecret: string | undefined;
  /** Account Auth Token — required ONLY for X-Twilio-Signature validation. Server-only. */
  twilioAuthToken: string | undefined;
  twilioMessagingServiceSid: string | undefined;
  twilioPhoneNumber: string | undefined;
  /** Public base URL Twilio calls back on (must match the externally requested URL). */
  communicationsTwilioWebhookBaseUrl: string | undefined;
  /** Explicit operator acknowledgement of A2P 10DLC registration — NOT verified with Twilio. */
  twilioA2pApproved: boolean;
  smsDispatchEnabled: boolean;
  smsDispatchBatchSize: number;
  smsDispatchConcurrency: number;
  smsDispatchPollMs: number;
}

export function loadConfiguration(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);

  return {
    port: Number.isNaN(port) ? 4000 : port,
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV ?? "development",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    formIngestToken: process.env.FORM_INGEST_TOKEN,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number.parseInt(process.env.SMTP_PORT ?? "465", 10) || 465,
    smtpSecure: String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    mailFrom: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    communicationsEmailProvider: (process.env.COMMUNICATIONS_EMAIL_PROVIDER ?? "mock").toLowerCase(),
    communicationsSmsProvider: (process.env.COMMUNICATIONS_SMS_PROVIDER ?? "mock").toLowerCase(),
    brevoApiKey: process.env.BREVO_API_KEY,
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
    brevoSenderName: process.env.BREVO_SENDER_NAME,
    communicationsPublicSiteUrl: (process.env.COMMUNICATIONS_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    communicationsApiUrl: (process.env.COMMUNICATIONS_API_URL ?? "http://localhost:4000").replace(/\/$/, ""),
    communicationsUnsubscribeSecret: process.env.COMMUNICATIONS_UNSUBSCRIBE_SECRET,
    communicationsWebhookSecret: process.env.COMMUNICATIONS_WEBHOOK_SECRET,
    emailDispatchEnabled: String(process.env.EMAIL_DISPATCH_ENABLED ?? "true").toLowerCase() === "true",
    emailDispatchBatchSize: Number.parseInt(process.env.EMAIL_DISPATCH_BATCH_SIZE ?? "25", 10) || 25,
    emailDispatchConcurrency: Number.parseInt(process.env.EMAIL_DISPATCH_CONCURRENCY ?? "5", 10) || 5,
    emailDispatchPollMs: Number.parseInt(process.env.EMAIL_DISPATCH_POLL_MS ?? "3000", 10) || 3000,
    communicationsInboundEmailProvider: (process.env.COMMUNICATIONS_INBOUND_EMAIL_PROVIDER ?? "mock").toLowerCase(),
    communicationsInboundEmailDomain: (process.env.COMMUNICATIONS_INBOUND_EMAIL_DOMAIN ?? "reply.mock.local").replace(/^@/, "").toLowerCase(),
    communicationsInboundEmailSecret: process.env.COMMUNICATIONS_INBOUND_EMAIL_SECRET,
    communicationsInboundMaxBodyBytes: Number.parseInt(process.env.COMMUNICATIONS_INBOUND_MAX_BODY_BYTES ?? "524288", 10) || 524288,
    communicationsInboundMaxAttachmentBytes: Number.parseInt(process.env.COMMUNICATIONS_INBOUND_MAX_ATTACHMENT_BYTES ?? "10485760", 10) || 10485760,
    communicationsInboundMaxAttachments: Number.parseInt(process.env.COMMUNICATIONS_INBOUND_MAX_ATTACHMENTS ?? "5", 10) || 5,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioApiKeySid: process.env.TWILIO_API_KEY_SID,
    twilioApiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    communicationsTwilioWebhookBaseUrl: process.env.COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, ""),
    twilioA2pApproved: String(process.env.TWILIO_A2P_APPROVED ?? "false").toLowerCase() === "true",
    smsDispatchEnabled: String(process.env.SMS_DISPATCH_ENABLED ?? "true").toLowerCase() === "true",
    smsDispatchBatchSize: Number.parseInt(process.env.SMS_DISPATCH_BATCH_SIZE ?? "20", 10) || 20,
    smsDispatchConcurrency: Number.parseInt(process.env.SMS_DISPATCH_CONCURRENCY ?? "3", 10) || 3,
    smsDispatchPollMs: Number.parseInt(process.env.SMS_DISPATCH_POLL_MS ?? "3000", 10) || 3000,
  };
}
