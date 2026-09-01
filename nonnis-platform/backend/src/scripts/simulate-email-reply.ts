/**
 * DEV-ONLY inbound email simulation. Refuses to run when NODE_ENV=production.
 * Feeds a fabricated inbound reply through the SAME normalized pipeline the real
 * provider webhook uses (mock adapter → InboundEmailService), so send → reply → CRM
 * can be exercised end-to-end locally without Brevo/DNS.
 *
 *   npm run communications:simulate-email-reply -- --conversation <id> --text "Thanks!"
 *   npm run communications:simulate-email-reply -- --token <threadToken> --from a@b.com
 *   npm run communications:simulate-email-reply -- --to reply-bogus@reply.mock.local   # unknown token
 *
 * Flags: --conversation, --token, --to, --from, --subject, --text, --html,
 *        --in-reply-to, --references, --provider-inbound-id, --auto
 */
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "../app.module";
import { PrismaService } from "../database/prisma.service";
import type { AppConfig } from "../config/configuration";
import { MockEmailInboundAdapter } from "../modules/communications/providers/mock-email-inbound-adapter";
import { InboundEmailService } from "../modules/communications/email/inbound-email.service";
import { formatReplyAddress } from "../modules/communications/email/reply-address";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    console.error("Refusing to run the inbound simulation in production.");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService) as ConfigService<AppConfig, true>;
  const mockAdapter = app.get(MockEmailInboundAdapter);
  const inbound = app.get(InboundEmailService);

  const conversationId = arg("conversation");
  let token = arg("token");
  let from = arg("from");
  let to = arg("to");

  if (conversationId) {
    const conv = await prisma.communicationConversation.findUnique({ where: { id: conversationId }, include: { contact: { select: { email: true } } } });
    if (!conv) throw new Error(`Conversation ${conversationId} not found`);
    if (!conv.threadToken) throw new Error(`Conversation ${conversationId} has no threadToken yet (send/reply first).`);
    token = token ?? conv.threadToken;
    from = from ?? conv.contact.email ?? undefined;
  }
  if (!to) {
    if (!token) throw new Error("Provide --conversation, --token, or --to.");
    to = formatReplyAddress(config, token);
  }
  if (!from) from = "tester@example.com";

  const body = {
    providerInboundId: arg("provider-inbound-id") ?? `sim-${Date.now()}`,
    from: { address: from, name: "Simulated Sender" },
    to: [to],
    subject: arg("subject") ?? "Re: (simulated)",
    text: arg("text") ?? "This is a simulated inbound reply.",
    html: arg("html"),
    inReplyTo: arg("in-reply-to"),
    references: arg("references"),
    autoSubmitted: flag("auto"),
  };

  const normalized = mockAdapter.parse(body);
  const results = await inbound.ingestMany(normalized);
  console.log("Simulated inbound reply →", JSON.stringify(results));
  await app.close();
}

main().catch((e) => {
  console.error("Simulation failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
