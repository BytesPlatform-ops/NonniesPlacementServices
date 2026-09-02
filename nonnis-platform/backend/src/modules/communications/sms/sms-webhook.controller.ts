import { Body, Controller, Headers, Inject, Logger, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration";
import { Public } from "../../auth/decorators";
import { SkipTransform } from "../../../common/decorators/skip-transform.decorator";
import { SMS_INBOUND_ADAPTER, type SmsInboundAdapter } from "../providers/sms-inbound-adapter";
import { InboundSmsService } from "./inbound-sms.service";
import { SmsStatusService, normalizeTwilioStatus } from "./sms-status.service";
import { inboundWebhookUrl, statusCallbackUrl } from "./sms-config";

/**
 * Twilio SMS webhooks. Two SEPARATE endpoints:
 *   POST /inbound — actual customer message content (two-way SMS)
 *   POST /status  — outbound delivery status callbacks
 *
 * Both are provider-authenticated with X-Twilio-Signature via the official Twilio
 * validator BEFORE any parsing or persistence, using the COMPLETE unmodified
 * parameter set and the exact externally-requested URL (taken from the configured
 * public base URL, never from a proxy-rewritten request URL).
 *
 * Neither endpoint ever returns TwiML: the CRM does not auto-reply, and Twilio has
 * already sent its own STOP/START/HELP acknowledgement. Work is kept short so the
 * webhook acknowledges promptly.
 */
@Controller("webhooks/communications/sms")
export class SmsWebhookController {
  private readonly logger = new Logger("SmsWebhook");

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(SMS_INBOUND_ADAPTER) private readonly adapter: SmsInboundAdapter,
    private readonly inbound: InboundSmsService,
    private readonly status: SmsStatusService,
  ) {}

  /** Flatten the parsed form body to the exact string params the provider signed. */
  private params(body: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (body && typeof body === "object") {
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (typeof v === "string") out[k] = v;
      }
    }
    return out;
  }

  @Post("inbound")
  @Public()
  @SkipTransform()
  async receiveInbound(@Headers("x-twilio-signature") signature: string | undefined, @Body() body: unknown, @Res() res: Response): Promise<void> {
    const params = this.params(body);
    if (!this.adapter.verify(inboundWebhookUrl(this.config) ?? "", params, signature)) {
      res.status(403).send();
      return;
    }
    const normalized = this.adapter.parseInbound(params);
    if (!normalized) {
      // Acknowledge malformed provider payloads rather than inviting retry storms.
      res.status(204).send();
      return;
    }
    try {
      await this.inbound.ingest(normalized);
    } catch (err) {
      // Never echo message content or provider payloads into logs.
      this.logger.error(`Inbound SMS processing failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    res.status(204).send(); // no TwiML — the CRM never auto-replies
  }

  @Post("status")
  @Public()
  @SkipTransform()
  async receiveStatus(@Headers("x-twilio-signature") signature: string | undefined, @Body() body: unknown, @Res() res: Response): Promise<void> {
    const params = this.params(body);
    if (!this.adapter.verify(statusCallbackUrl(this.config) ?? "", params, signature)) {
      res.status(403).send();
      return;
    }
    const parsed = this.adapter.parseStatus(params);
    const mapped = parsed ? normalizeTwilioStatus(parsed.providerStatus) : null;
    if (parsed && mapped) {
      try {
        await this.status.apply({ providerMessageId: parsed.providerMessageId, status: mapped, errorCode: parsed.errorCode, errorMessageSafe: parsed.errorMessageSafe });
      } catch (err) {
        this.logger.error(`SMS status callback failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    res.status(204).send();
  }
}
