import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EmailSendResult, EmailTransport, OutboundEmail } from "./email-transport";

/** Deterministic mock email transport for development/tests. Performs ZERO
 *  network calls and returns predictable provider message IDs. */
@Injectable()
export class MockEmailTransport implements EmailTransport {
  readonly name = "mock";

  async send(_message: OutboundEmail): Promise<EmailSendResult> {
    return { providerMessageId: `mock-email-${randomUUID()}`, accepted: true };
  }
}
