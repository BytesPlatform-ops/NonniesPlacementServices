import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EmailSendOutcome, EmailTransport, OutboundEmailMessage } from "./email-transport";

/**
 * Deterministic mock email transport for development/tests. Performs ZERO network
 * calls and returns predictable provider message IDs. A recipient whose email
 * local-part contains "bounce" / "fail" / "ratelimit" / "timeout" produces the
 * matching outcome so the full dispatch state machine can be exercised offline.
 */
@Injectable()
export class MockEmailTransport implements EmailTransport {
  readonly name = "mock";
  readonly configured = true;

  async sendEmail(message: OutboundEmailMessage): Promise<EmailSendOutcome> {
    const local = message.to.split("@")[0]?.toLowerCase() ?? "";
    if (local.includes("bounce")) return { ok: false, classification: "PERMANENT", code: "MOCK_BOUNCE", message: "Mock permanent bounce" };
    if (local.includes("ratelimit")) return { ok: false, classification: "RATE_LIMIT", code: "MOCK_429", message: "Mock rate limit", retryAfterMs: 1000 };
    if (local.includes("timeout")) return { ok: false, classification: "AMBIGUOUS", code: "MOCK_TIMEOUT", message: "Mock network timeout" };
    if (local.includes("fail")) return { ok: false, classification: "TEMPORARY", code: "MOCK_5XX", message: "Mock temporary failure" };
    return { ok: true, providerMessageId: `mock-email-${randomUUID()}`, acceptedAt: new Date().toISOString() };
  }
}
