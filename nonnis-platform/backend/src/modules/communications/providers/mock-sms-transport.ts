import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OutboundSms, SmsSendResult, SmsTransport } from "./sms-transport";

/** Deterministic mock SMS transport for development/tests. Performs ZERO network
 *  calls and returns predictable provider message IDs. */
@Injectable()
export class MockSmsTransport implements SmsTransport {
  readonly name = "mock";

  async send(_message: OutboundSms): Promise<SmsSendResult> {
    return { providerMessageId: `mock-sms-${randomUUID()}`, accepted: true };
  }
}
