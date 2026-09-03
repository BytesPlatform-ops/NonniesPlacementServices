import type { ConfigService } from "@nestjs/config";
import type { EmailDispatcherService } from "../email/email-dispatcher.service";
import type { SmsDispatcherService } from "../sms/sms-dispatcher.service";
import { DispatchRunController } from "./dispatch-run.controller";

const SECRET = "a-sufficiently-long-dispatch-secret";

function makeRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
}

function build(opts: { secret?: string | undefined; fails?: boolean } = {}) {
  const config = { get: () => ("secret" in opts ? opts.secret : SECRET) } as unknown as ConfigService;
  const reject = () => Promise.reject(new Error("db down"));
  const email = {
    runRepliesOnce: opts.fails ? reject : jest.fn().mockResolvedValue(2),
    runOnce: opts.fails ? reject : jest.fn().mockResolvedValue(5),
  } as unknown as EmailDispatcherService;
  const sms = { runOnce: opts.fails ? reject : jest.fn().mockResolvedValue(1) } as unknown as SmsDispatcherService;
  return { ctrl: new DispatchRunController(config as never, email, sms), email, sms };
}

describe("DispatchRunController", () => {
  it("runs a pass when the scheduler sends a bearer token", async () => {
    // Vercel Cron authenticates this way, which keeps the secret out of both the
    // committed config and the request URL.
    const { ctrl, email, sms } = build();
    const res = makeRes();
    await ctrl.run(undefined, undefined, `Bearer ${SECRET}`, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, replies: 2, campaigns: 5, sms: 1 });
    expect(email.runRepliesOnce).toHaveBeenCalled();
    expect(sms.runOnce).toHaveBeenCalled();
  });

  it("accepts the header and query forms too", async () => {
    for (const call of [
      (c: DispatchRunController, r: unknown) => c.run(undefined, SECRET, undefined, r as never),
      (c: DispatchRunController, r: unknown) => c.run(SECRET, undefined, undefined, r as never),
    ]) {
      const { ctrl } = build();
      const res = makeRes();
      await call(ctrl, res);
      expect(res.statusCode).toBe(200);
    }
  });

  it("rejects a wrong or missing secret without dispatching anything", async () => {
    for (const auth of [undefined, "Bearer wrong", "Bearer "]) {
      const { ctrl, email } = build();
      const res = makeRes();
      await ctrl.run(undefined, undefined, auth, res as never);
      expect(res.statusCode).toBe(401);
      expect(email.runRepliesOnce).not.toHaveBeenCalled();
    }
  });

  it("refuses everything when no secret is configured", async () => {
    // Otherwise an unconfigured deployment would expose an open dispatch trigger.
    const { ctrl } = build({ secret: undefined });
    const res = makeRes();
    await ctrl.run(undefined, undefined, "Bearer anything", res as never);
    expect(res.statusCode).toBe(401);
  });

  it("answers 5xx when a pass fails so the scheduler retries", async () => {
    const { ctrl } = build({ fails: true });
    const res = makeRes();
    await ctrl.run(undefined, undefined, `Bearer ${SECRET}`, res as never);
    expect(res.statusCode).toBe(503);
  });
});
