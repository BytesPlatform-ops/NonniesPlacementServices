import { Controller, Headers, Logger, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../../../config/configuration";
import { Public } from "../../auth/decorators";
import { SkipTransform } from "../../../common/decorators/skip-transform.decorator";
import { EmailDispatcherService } from "../email/email-dispatcher.service";
import { SmsDispatcherService } from "../sms/sms-dispatcher.service";

/**
 * Scheduler-driven dispatch pass.
 *
 * The dispatchers are timers, and a timer only runs while the process is alive.
 * That is true of a long-running server and false of a serverless host, where
 * the instance is frozen the moment a request ends — leaving queued mail, lease
 * recovery and retries to never happen.
 *
 * This endpoint performs exactly one pass of the work the timer would have done,
 * so a scheduler (Vercel Cron, or any external pinger) can drive delivery on a
 * host that has no background process. It is safe to call concurrently: claims
 * use FOR UPDATE SKIP LOCKED, so overlapping runs never send the same row twice.
 *
 * It is not user-authenticated — a scheduler has no session — so it is guarded
 * by the same shared secret as the provider webhooks and compared in constant
 * time. It returns 401 without revealing whether a secret is configured.
 */
@Controller("internal/dispatch")
export class DispatchRunController {
  private readonly logger = new Logger("DispatchRun");

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly email: EmailDispatcherService,
    private readonly sms: SmsDispatcherService,
  ) {}

  private authorized(provided: string | undefined): boolean {
    const expected = this.config.get("communicationsWebhookSecret", { infer: true });
    if (!expected || !provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  @Post("run")
  @Public()
  @SkipTransform()
  async run(
    @Query("secret") secret: string | undefined,
    @Headers("x-dispatch-secret") headerSecret: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.authorized(secret ?? headerSecret)) {
      res.status(401).json({ ok: false });
      return;
    }
    try {
      // Email first: replies are the most latency-sensitive thing in the queue.
      const [replies, campaigns, smsSent] = [await this.email.runRepliesOnce(), await this.email.runOnce(), await this.sms.runOnce()];
      res.status(200).json({ ok: true, replies, campaigns, sms: smsSent });
    } catch (err) {
      // 5xx so the scheduler's own retry picks it up rather than skipping a cycle.
      this.logger.error(`Dispatch pass failed: ${err instanceof Error ? err.message : "unknown"}`);
      res.status(503).json({ ok: false });
    }
  }
}
