/**
 * DEV-ONLY SMS simulation. Refuses to run when NODE_ENV=production.
 * Feeds fabricated provider payloads through the SAME normalized pipeline the real
 * Twilio webhooks use (adapter → InboundSmsService / SmsStatusService), so
 * send → reply → STOP/START → delivery status can be exercised locally with no
 * Twilio account. There is deliberately NO production simulation endpoint.
 *
 *   npm run communications:simulate-sms -- inbound --from +14155550161 --body "Yes please"
 *   npm run communications:simulate-sms -- inbound --from +14155550161 --body STOP --opt-out STOP
 *   npm run communications:simulate-sms -- inbound --from +14155550161 --body START --opt-out START
 *   npm run communications:simulate-sms -- status --sid SM123 --status delivered
 *   npm run communications:simulate-sms -- status --sid SM123 --status failed --error-code 21610
 */
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "../app.module";
import { PrismaService } from "../database/prisma.service";
import type { AppConfig } from "../config/configuration";
import { MockSmsInboundAdapter } from "../modules/communications/providers/mock-sms-inbound-adapter";
import { MOCK_SMS_FROM_NUMBER } from "../modules/communications/providers/mock-sms-transport";
import { InboundSmsService } from "../modules/communications/sms/inbound-sms.service";
import { SmsStatusService, normalizeTwilioStatus } from "../modules/communications/sms/sms-status.service";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    console.error("Refusing to run the SMS simulation in production.");
    process.exit(1);
  }
  const mode = process.argv.find((a) => a === "inbound" || a === "status");
  if (!mode) throw new Error('Specify a mode: "inbound" or "status".');

  // The dispatcher would race manual assertions; drive it explicitly instead.
  process.env.SMS_DISPATCH_ENABLED = process.env.SMS_DISPATCH_ENABLED ?? "true";
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService) as ConfigService<AppConfig, true>;
  const adapter = app.get(MockSmsInboundAdapter);

  if (mode === "inbound") {
    const from = arg("from");
    if (!from) throw new Error("Provide --from <E.164 number>.");
    const to = arg("to") ?? config.get("twilioPhoneNumber", { infer: true }) ?? MOCK_SMS_FROM_NUMBER;
    const params: Record<string, string> = {
      MessageSid: arg("sid") ?? `SMsim${Date.now()}`,
      AccountSid: "ACsimulated",
      From: from,
      To: to,
      Body: arg("body") ?? "Simulated inbound SMS",
      NumMedia: arg("num-media") ?? "0",
      NumSegments: "1",
    };
    const optOut = arg("opt-out");
    if (optOut) params.OptOutType = optOut.toUpperCase();

    const normalized = adapter.parseInbound(params);
    if (!normalized) throw new Error("Could not parse the simulated payload.");
    const result = await app.get(InboundSmsService).ingest(normalized);
    console.log("Simulated inbound SMS →", JSON.stringify(result));
  } else {
    let sid = arg("sid");
    const conversationId = arg("conversation");
    if (!sid && conversationId) {
      const last = await prisma.communicationMessage.findFirst({ where: { conversationId, direction: "OUTBOUND", providerMessageId: { not: null } }, orderBy: { createdAt: "desc" }, select: { providerMessageId: true } });
      sid = last?.providerMessageId ?? undefined;
    }
    if (!sid) throw new Error("Provide --sid <MessageSid> (or --conversation <id>).");
    const raw = arg("status") ?? "delivered";
    const mapped = normalizeTwilioStatus(raw);
    if (!mapped) throw new Error(`Unsupported status "${raw}".`);
    const result = await app.get(SmsStatusService).apply({ providerMessageId: sid, status: mapped, errorCode: arg("error-code"), errorMessageSafe: arg("error-message") });
    console.log(`Simulated status callback ${raw} →`, JSON.stringify(result));
  }

  await app.close();
}

main().catch((e) => {
  console.error("Simulation failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
