import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { EMAIL_TRANSPORT, type EmailTransport } from "./email-transport";
import { SMS_TRANSPORT, type SmsTransport } from "./sms-transport";
import { MockEmailTransport } from "./mock-email-transport";
import { MockSmsTransport } from "./mock-sms-transport";

const logger = new Logger("CommunicationsTransport");

/** Live providers reserved for future phases — recognized but not yet implemented. */
const RESERVED_EMAIL = new Set(["brevo"]);
const RESERVED_SMS = new Set(["twilio"]);

function resolveEmail(name: string, mock: MockEmailTransport): EmailTransport {
  if (name === "mock") return mock;
  if (RESERVED_EMAIL.has(name)) {
    // Fail safely: never silently fall back to sending nothing, and never claim a
    // live provider is wired up before its phase (15B) is implemented.
    throw new Error(`Email provider "${name}" is not implemented yet (arrives in phase 15B). Use "mock" for now.`);
  }
  throw new Error(`Unknown COMMUNICATIONS_EMAIL_PROVIDER "${name}". Valid values: mock.`);
}

function resolveSms(name: string, mock: MockSmsTransport): SmsTransport {
  if (name === "mock") return mock;
  if (RESERVED_SMS.has(name)) {
    throw new Error(`SMS provider "${name}" is not implemented yet (arrives in phase 15D). Use "mock" for now.`);
  }
  throw new Error(`Unknown COMMUNICATIONS_SMS_PROVIDER "${name}". Valid values: mock.`);
}

/** DI providers that select the transport implementation from config (default mock). */
export const transportProviders: Provider[] = [
  MockEmailTransport,
  MockSmsTransport,
  {
    provide: EMAIL_TRANSPORT,
    inject: [ConfigService, MockEmailTransport],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockEmailTransport): EmailTransport => {
      const name = config.get("communicationsEmailProvider", { infer: true });
      const transport = resolveEmail(name, mock);
      logger.log(`Email transport: ${transport.name}`);
      return transport;
    },
  },
  {
    provide: SMS_TRANSPORT,
    inject: [ConfigService, MockSmsTransport],
    useFactory: (config: ConfigService<AppConfig, true>, mock: MockSmsTransport): SmsTransport => {
      const name = config.get("communicationsSmsProvider", { infer: true });
      const transport = resolveSms(name, mock);
      logger.log(`SMS transport: ${transport.name}`);
      return transport;
    },
  },
];
