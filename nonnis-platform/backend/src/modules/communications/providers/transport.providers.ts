import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "./email-transport";
import { SMS_TRANSPORT, type SmsTransport } from "./sms-transport";
import { INBOUND_EMAIL_ADAPTER, type EmailInboundAdapter } from "./email-inbound-adapter";
import { MockEmailTransport } from "./mock-email-transport";
import { BrevoEmailTransport } from "./brevo-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";
import { TwilioSmsTransport } from "./twilio-sms-transport";
import { MockEmailInboundAdapter } from "./mock-email-inbound-adapter";
import { BrevoEmailInboundAdapter } from "./brevo-email-inbound-adapter";
import { SMS_INBOUND_ADAPTER, type SmsInboundAdapter } from "./sms-inbound-adapter";
import { MockSmsInboundAdapter } from "./mock-sms-inbound-adapter";
import { TwilioSmsInboundAdapter } from "./twilio-sms-inbound-adapter";

const logger = new Logger("CommunicationsTransport");


/**
 * Resolve the configured email transport. Selecting "brevo" without complete
 * credentials FAILS SAFELY (a clear error) — it never silently falls back to the
 * mock, which would mislead users into thinking real mail was sent.
 */
export function resolveEmailTransport(name: string, mock: MockEmailTransport, brevo: BrevoEmailTransport): EmailTransport {
  if (name === "mock") return mock;
  if (name === "brevo") {
    if (!brevo.configured) {
      throw new Error("COMMUNICATIONS_EMAIL_PROVIDER=brevo but BREVO_API_KEY / BREVO_SENDER_EMAIL are missing. Configure them or use mock.");
    }
    return brevo;
  }
  throw new Error(`Unknown COMMUNICATIONS_EMAIL_PROVIDER "${name}". Valid values: mock, brevo.`);
}

/**
 * Resolve the configured inbound email adapter. "brevo" without inbound config
 * (domain + secret) FAILS SAFELY so an operator never believes inbound replies are
 * wired when they are not. Mock is always available for local development/tests.
 */
export function resolveInboundAdapter(name: string, mock: MockEmailInboundAdapter, brevo: BrevoEmailInboundAdapter): EmailInboundAdapter {
  if (name === "mock") return mock;
  if (name === "brevo") {
    if (!brevo.configured) {
      throw new Error("COMMUNICATIONS_INBOUND_EMAIL_PROVIDER=brevo but COMMUNICATIONS_INBOUND_EMAIL_DOMAIN / COMMUNICATIONS_INBOUND_EMAIL_SECRET are missing. Configure them or use mock.");
    }
    return brevo;
  }
  throw new Error(`Unknown COMMUNICATIONS_INBOUND_EMAIL_PROVIDER "${name}". Valid values: mock, brevo.`);
}

/**
 * Resolve the configured SMS transport. Selecting "twilio" without complete
 * credentials FAILS SAFELY — it never silently falls back to the mock, which would
 * mislead operators into believing real SMS was sent.
 */
export function resolveSmsTransport(name: string, mock: MockSmsTransport, twilio: TwilioSmsTransport): SmsTransport {
  if (name === "mock") return mock;
  if (name === "twilio") {
    if (!twilio.configured) throw new Error(`COMMUNICATIONS_SMS_PROVIDER=twilio but the provider is not fully configured. ${twilio.configurationError ?? ""}`.trim());
    return twilio;
  }
  throw new Error(`Unknown COMMUNICATIONS_SMS_PROVIDER "${name}". Valid values: mock, twilio.`);
}

/**
 * Resolve the inbound SMS adapter. It follows the SMS transport selection so
 * webhooks are always verified by the same provider that sends. "twilio" without
 * an Auth Token + public webhook base URL fails safely rather than accepting
 * unverified requests.
 */
export function resolveSmsInboundAdapter(name: string, mock: MockSmsInboundAdapter, twilio: TwilioSmsInboundAdapter): SmsInboundAdapter {
  if (name === "mock") return mock;
  if (name === "twilio") {
    if (!twilio.configured) throw new Error("COMMUNICATIONS_SMS_PROVIDER=twilio but TWILIO_AUTH_TOKEN / COMMUNICATIONS_TWILIO_WEBHOOK_BASE_URL are missing — inbound SMS webhooks could not be verified.");
    return twilio;
  }
  throw new Error(`Unknown COMMUNICATIONS_SMS_PROVIDER "${name}". Valid values: mock, twilio.`);
}

export const transportProviders: Provider[] = [
  MockEmailTransport,
  BrevoEmailTransport,
  MockSmsTransport,
  TwilioSmsTransport,
  MockEmailInboundAdapter,
  BrevoEmailInboundAdapter,
  MockSmsInboundAdapter,
  TwilioSmsInboundAdapter,
  {
    provide: EMAIL_TRANSPORT,
    inject: [ConfigService, MockEmailTransport, BrevoEmailTransport],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockEmailTransport, brevo: BrevoEmailTransport): EmailTransport => {
      const transport = resolveEmailTransport(config.get("communicationsEmailProvider", { infer: true }), mock, brevo);
      logger.log(`Email transport: ${transport.name} (configured=${transport.configured})`);
      return transport;
    },
  },
  {
    provide: INBOUND_EMAIL_ADAPTER,
    inject: [ConfigService, MockEmailInboundAdapter, BrevoEmailInboundAdapter],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockEmailInboundAdapter, brevo: BrevoEmailInboundAdapter): EmailInboundAdapter => {
      const adapter = resolveInboundAdapter(config.get("communicationsInboundEmailProvider", { infer: true }), mock, brevo);
      logger.log(`Inbound email adapter: ${adapter.name} (configured=${adapter.configured})`);
      return adapter;
    },
  },
  {
    provide: SMS_INBOUND_ADAPTER,
    inject: [ConfigService, MockSmsInboundAdapter, TwilioSmsInboundAdapter],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockSmsInboundAdapter, twilio: TwilioSmsInboundAdapter): SmsInboundAdapter => {
      const adapter = resolveSmsInboundAdapter(config.get("communicationsSmsProvider", { infer: true }), mock, twilio);
      logger.log(`Inbound SMS adapter: ${adapter.name} (configured=${adapter.configured})`);
      return adapter;
    },
  },
  {
    provide: SMS_TRANSPORT,
    inject: [ConfigService, MockSmsTransport, TwilioSmsTransport],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockSmsTransport, twilio: TwilioSmsTransport): SmsTransport => {
      const transport = resolveSmsTransport(config.get("communicationsSmsProvider", { infer: true }), mock, twilio);
      logger.log(`SMS transport: ${transport.name} (configured=${transport.configured})`);
      return transport;
    },
  },
];
