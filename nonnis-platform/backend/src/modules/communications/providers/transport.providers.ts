import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "./email-transport";
import { SMS_TRANSPORT, type SmsTransport } from "./sms-transport";
import { MockEmailTransport } from "./mock-email-transport";
import { BrevoEmailTransport } from "./brevo-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";

const logger = new Logger("CommunicationsTransport");

const RESERVED_SMS = new Set(["twilio"]);

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

function resolveSms(name: string, mock: MockSmsTransport): SmsTransport {
  if (name === "mock") return mock;
  if (RESERVED_SMS.has(name)) throw new Error(`SMS provider "${name}" is not implemented yet (arrives in phase 15D). Use "mock" for now.`);
  throw new Error(`Unknown COMMUNICATIONS_SMS_PROVIDER "${name}". Valid values: mock.`);
}

export const transportProviders: Provider[] = [
  MockEmailTransport,
  BrevoEmailTransport,
  MockSmsTransport,
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
    provide: SMS_TRANSPORT,
    inject: [ConfigService, MockSmsTransport],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockSmsTransport): SmsTransport => {
      const transport = resolveSms(config.get("communicationsSmsProvider", { infer: true }), mock);
      logger.log(`SMS transport: ${transport.name}`);
      return transport;
    },
  },
];
