import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import type Stripe from "stripe";
import { Public } from "../auth/decorators";
import { SkipTransform } from "../../common/decorators/skip-transform.decorator";
import { isTransientInfrastructureError } from "../communications/transient-error";
import { MarketplaceOrdersService } from "./orders.service";
import { MarketplaceStripeService } from "./stripe.service";
import { InvoicesService } from "../invoices/invoices.service";
import { SubscriptionsService } from "../invoices/subscriptions.service";
import { fromMinorUnits } from "../invoices/stripe-payment-gateway";

/**
 * Stripe's view of what actually happened to a card payment.
 *
 * This endpoint — not the browser returning to a success URL — is the only thing
 * that may mark a marketplace order paid. Anyone can open a success URL; only
 * Stripe can sign an event.
 *
 * It is public because Stripe holds no session, and provider-authenticated
 * instead: the signature is checked against the RAW body before anything is
 * parsed or written, and a payload that fails gets 400 and nothing else.
 */
@Controller("webhooks/marketplace/stripe")
export class MarketplaceStripeWebhookController {
  private readonly logger = new Logger("MarketplaceStripeWebhook");

  constructor(
    private readonly stripe: MarketplaceStripeService,
    private readonly orders: MarketplaceOrdersService,
    private readonly invoices: InvoicesService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Post()
  @Public()
  @SkipTransform()
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: Request, @Headers("stripe-signature") signature: string | undefined): Promise<{ received: true }> {
    // `req.body` is a Buffer here: main.ts mounts a raw parser on this path,
    // because re-serializing JSON changes the bytes the signature covers.
    const raw = req.body as Buffer;
    const event = this.stripe.verifyEvent(raw, signature);
    if (!event) {
      // 400, not 5xx: an unverifiable payload will never become verifiable, so
      // Stripe should surface it in the dashboard rather than retry forever.
      throw new BadRequestException("Invalid Stripe signature.");
    }

    try {
      await this.dispatch(event);
    } catch (err) {
      // A database blip must not be acknowledged: a 2xx tells Stripe the event
      // was handled and it is never redelivered, which would lose a real
      // payment. Answering 5xx lets Stripe's own retries recover it.
      if (isTransientInfrastructureError(err)) {
        this.logger.error(`Stripe event ${event.type} temporarily unprocessable; asking Stripe to retry.`);
        throw err;
      }
      this.logger.error(`Stripe event ${event.type} failed permanently: ${err instanceof Error ? err.message : "unknown"}`);
    }
    return { received: true };
  }

  /**
   * Route an event to the domain it belongs to.
   *
   * Two things pay through Stripe and they are unrelated: a family buying a
   * marketplace listing, and a provider settling a Nonni's invoice. The domain
   * is decided by METADATA we set when creating the object — `orderId` or
   * `invoiceId` — never by amounts, customer names or any other field that could
   * coincide. An object with neither is somebody else's event and is ignored.
   *
   * Everything unrecognised is acknowledged rather than errored: an endpoint
   * subscribed to more than it handles should stay quiet, not make Stripe retry.
   */
  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        // `completed` also fires for sessions whose payment is still pending
        // (delayed methods), so the payment status is what actually decides.
        if (session.payment_status !== "paid") return;
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

        const invoiceId = session.metadata?.invoiceId;
        if (invoiceId) {
          await this.invoices.applyStripePaid({
            invoiceId,
            paymentIntentId,
            amount: fromMinorUnits(session.amount_total),
          });
          return;
        }
        // No invoice metadata: the marketplace path, exactly as before.
        await this.orders.applyStripePaid({ sessionId: session.id, paymentIntentId, stripeStatus: session.payment_status });
        return;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        if (invoiceId) {
          // Annotates only. The invoice stays unpaid and payable.
          await this.invoices.applyStripeFailed({ invoiceId, paymentIntentId: null, rawStatus: session.status ?? "failed" });
          return;
        }
        await this.orders.applyStripeFailed({ sessionId: session.id, stripeStatus: session.status ?? "failed" });
        return;
      }

      // ---- recurring provider subscriptions -----------------------------------
      case "invoice.paid": {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdOf(stripeInvoice);
        if (!subscriptionId) return;
        await this.subscriptions.applyStripeInvoicePaid({
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: stripeInvoice.id ?? null,
          paymentIntentId: paymentIntentIdOf(stripeInvoice),
          amount: fromMinorUnits(stripeInvoice.amount_paid),
        });
        return;
      }

      case "invoice.payment_failed": {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdOf(stripeInvoice);
        if (!subscriptionId) return;
        await this.subscriptions.applyStripeInvoiceFailed({
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: stripeInvoice.id ?? null,
          paymentIntentId: paymentIntentIdOf(stripeInvoice),
        });
        return;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await this.subscriptions.applyStripeSubscriptionEnded(subscription.id);
        return;
      }

      default:
        return;
    }
  }
}

/** The subscription a Stripe invoice belongs to, across payload shapes. */
function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
  if (typeof raw === "string") return raw;
  return raw?.id ?? null;
}

/** The PaymentIntent that settled a Stripe invoice, across payload shapes. */
function paymentIntentIdOf(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { payment_intent?: string | { id?: string } | null }).payment_intent;
  if (typeof raw === "string") return raw;
  return raw?.id ?? null;
}
