import { Body, Controller, Headers, Inject, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { Public } from "../../auth/decorators";
import { SkipTransform } from "../../../common/decorators/skip-transform.decorator";
import { INBOUND_EMAIL_ADAPTER, type EmailInboundAdapter } from "../providers/email-inbound-adapter";
import { InboundEmailService } from "./inbound-email.service";
import { verifyInboundSecret } from "./email-config";

/**
 * Provider INBOUND-content webhook (separate from the delivery-event webhook). Brevo
 * inbound parsing POSTs actual incoming emails here. It is provider-authenticated by a
 * high-entropy secret (query `?secret=` or `x-inbound-secret` header — Brevo inbound is
 * not signed), body-size bounded, and idempotent. It never uses Supabase user auth.
 * A retried event returns a safe acknowledgement without creating duplicates.
 */
@Controller("webhooks/communications/email")
export class EmailInboundWebhookController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(INBOUND_EMAIL_ADAPTER) private readonly adapter: EmailInboundAdapter,
    private readonly inbound: InboundEmailService,
  ) {}

  @Post("inbound")
  @Public()
  @SkipTransform()
  async receive(@Query("secret") secret: string | undefined, @Headers("x-inbound-secret") headerSecret: string | undefined, @Body() body: unknown, @Res() res: Response): Promise<void> {
    if (!verifyInboundSecret(this.config, secret ?? headerSecret)) {
      // Do not reveal token existence/details — a flat 401.
      res.status(401).json({ ok: false });
      return;
    }
    const maxBytes = this.config.get("communicationsInboundMaxBodyBytes", { infer: true });
    if (Buffer.byteLength(JSON.stringify(body ?? "")) > maxBytes) {
      res.status(413).json({ ok: false, error: "payload too large" });
      return;
    }
    try {
      const normalized = this.adapter.parse(body);
      const results = await this.inbound.ingestMany(normalized);
      const linked = results.filter((r) => r.status === "linked").length;
      const review = results.filter((r) => r.status === "review").length;
      const duplicate = results.filter((r) => r.status === "duplicate").length;
      res.status(200).json({ ok: true, processed: results.length, linked, review, duplicate });
    } catch {
      // Never leak internals; acknowledge parse issues without a 500 storm from retries.
      res.status(200).json({ ok: true, processed: 0 });
    }
  }
}
