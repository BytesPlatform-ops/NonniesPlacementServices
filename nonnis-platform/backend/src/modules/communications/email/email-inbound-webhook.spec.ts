import { Prisma } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import type { EmailInboundAdapter } from "../providers/email-inbound-adapter";
import type { InboundEmailService } from "./inbound-email.service";
import { EmailInboundWebhookController } from "./email-inbound-webhook.controller";

const SECRET = "a-sufficiently-long-inbound-secret";

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function build(ingestMany: jest.Mock) {
  const config = {
    get: (k: string) => (k === "communicationsInboundEmailSecret" ? SECRET : k === "communicationsInboundMaxBodyBytes" ? 1_000_000 : undefined),
  } as unknown as ConfigService;
  const adapter = { parse: jest.fn().mockReturnValue([{}]) } as unknown as EmailInboundAdapter;
  const inbound = { ingestMany } as unknown as InboundEmailService;
  return new EmailInboundWebhookController(config as never, adapter, inbound);
}

describe("EmailInboundWebhookController failure handling", () => {
  it("asks the provider to retry when the database is momentarily unavailable", async () => {
    // Acknowledging this would tell Brevo the reply was handled; it would never
    // be redelivered, and a real customer reply would be lost to a blip.
    const ingestMany = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Timed out fetching a new connection from the connection pool", { code: "P2024", clientVersion: "6.0.0" }),
    );
    const res = makeRes();
    await build(ingestMany).receive(SECRET, undefined, { items: [] }, res as never);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, retry: true });
  });

  it("acknowledges a permanently unprocessable payload so the provider stops retrying", async () => {
    const ingestMany = jest.fn().mockRejectedValue(new TypeError("Cannot read properties of undefined"));
    const res = makeRes();
    await build(ingestMany).receive(SECRET, undefined, { items: [] }, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, processed: 0 });
  });

  it("reports what it linked on success", async () => {
    const ingestMany = jest.fn().mockResolvedValue([{ status: "linked" }, { status: "review" }, { status: "duplicate" }]);
    const res = makeRes();
    await build(ingestMany).receive(SECRET, undefined, { items: [] }, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, processed: 3, linked: 1, review: 1, duplicate: 1 });
  });

  it("rejects a wrong secret without touching the database", async () => {
    const ingestMany = jest.fn();
    const res = makeRes();
    await build(ingestMany).receive("wrong-secret", undefined, { items: [] }, res as never);
    expect(res.statusCode).toBe(401);
    expect(ingestMany).not.toHaveBeenCalled();
  });
});
