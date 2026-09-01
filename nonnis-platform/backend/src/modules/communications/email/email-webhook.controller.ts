import { Body, Controller, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { Public } from "../../auth/decorators";
import { SkipTransform } from "../../../common/decorators/skip-transform.decorator";
import { EmailEventsService } from "./email-events.service";
import { verifyWebhookSecret } from "./email-config";

/**
 * Provider delivery-event webhook (NOT inbound email content — that is 15C).
 * Guarded by a shared secret (Brevo transactional webhooks are not cryptographically
 * signed), idempotent, and normalizes events before applying them.
 */
@Controller("communications/email")
export class EmailWebhookController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly events: EmailEventsService,
  ) {}

  @Post("webhook")
  @Public()
  @SkipTransform()
  async webhook(@Query("secret") secret: string | undefined, @Body() body: unknown, @Res() res: Response): Promise<void> {
    if (!verifyWebhookSecret(this.config, secret)) {
      res.status(401).json({ ok: false });
      return;
    }
    const normalized = this.events.buildFromBrevo(body);
    for (const e of normalized) await this.events.apply(e);
    res.status(200).json({ ok: true, processed: normalized.length });
  }
}
