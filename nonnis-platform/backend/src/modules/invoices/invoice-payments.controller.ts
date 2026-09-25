import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/decorators";
import { SkipTransform } from "../../common/decorators/skip-transform.decorator";
import { InvoicesService } from "./invoices.service";

/**
 * The link a provider follows from an invoice email or PDF to pay by card.
 *
 * Public because it has to be: the person opening it is reading an email, not
 * signed into a portal. The token is the whole of the authorisation, and it is
 * the only input — there is no invoice id in the URL to change for somebody
 * else's, and no amount to tamper with. Everything that decides what happens
 * next is read from the stored invoice.
 *
 * It redirects rather than returning JSON, so the link works from a mail
 * client, a PDF reader or a phone's camera with nothing to interpret it.
 *
 * Arriving here is not paying. The invoice is untouched; only a verified Stripe
 * webhook ever marks it PAID.
 */
@Controller("invoice-payments")
export class InvoicePaymentsController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(":token")
  @Public()
  @SkipTransform()
  async pay(@Param("token") token: string, @Res() res: Response): Promise<void> {
    const { url } = await this.invoices.beginCardPaymentByToken(token);
    // 303: the follow-up is a GET of Stripe's page, whatever this request was.
    // No-store so a shared or cached redirect cannot strand a later payer on a
    // session that has since been used.
    res.setHeader("cache-control", "no-store");
    res.redirect(303, url);
  }
}
