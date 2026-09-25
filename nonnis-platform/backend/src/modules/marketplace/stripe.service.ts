import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import type { AppConfig } from "../../config/configuration";

/** Order fields a Checkout Session is built from. All server-side. */
export interface CheckoutOrder {
  id: string;
  orderNumber: string;
  listingTitle: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  currency: string;
}

export interface StripeCheckout {
  sessionId: string;
  url: string;
}

/**
 * Thin, typed wrapper around Stripe Checkout.
 *
 * Deliberately small. It owns three things and nothing else: whether Stripe is
 * configured, how an order becomes a Checkout Session, and how a webhook payload
 * is proved to have come from Stripe. Order state lives in the orders service,
 * where the rest of the lifecycle already lives.
 *
 * No card data passes through this process, let alone into the database —
 * Checkout collects the instrument on Stripe's own pages and we keep only the
 * session and payment-intent identifiers it hands back.
 */
@Injectable()
export class MarketplaceStripeService {
  private readonly logger = new Logger("MarketplaceStripe");
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** True when card payment can actually be offered. */
  get configured(): boolean {
    return !!this.config.get("stripeSecretKey", { infer: true });
  }

  /** True when a Stripe event can be proved genuine. */
  get webhookConfigured(): boolean {
    return !!this.config.get("stripeWebhookSecret", { infer: true });
  }

  private stripe(): Stripe {
    const key = this.config.get("stripeSecretKey", { infer: true });
    if (!key) {
      // Fails loudly rather than silently pretending a payment was taken.
      throw new ServiceUnavailableException("Card payment is not available right now. Please choose another payment method.");
    }
    this.client ??= new Stripe(key);
    return this.client;
  }

  /**
   * Create a Checkout Session for one order.
   *
   * The amount is derived here from the order row the caller loaded from the
   * database — never from anything a client sent. Money is converted from the
   * stored Decimal to Stripe's integer minor units without ever becoming a
   * float, so no rounding can creep in between our total and the charge.
   *
   * `client_reference_id` and metadata carry our order id so the webhook can
   * find it, and the session's idempotency key is the order itself: retrying a
   * failed request cannot produce two sessions for one order.
   */
  async createCheckoutSession(order: CheckoutOrder, urls: { successUrl: string; cancelUrl: string }): Promise<StripeCheckout> {
    const currency = order.currency.toLowerCase();
    const unitAmount = toMinorUnits(order.unitPrice);

    const session = await this.stripe().checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.id,
        line_items: [
          {
            quantity: order.quantity,
            price_data: {
              currency,
              unit_amount: unitAmount,
              product_data: {
                name: order.listingTitle,
                description: `Nonni's order ${order.orderNumber}`,
              },
            },
          },
        ],
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        // Mirrored onto the PaymentIntent so a refund found in the Stripe
        // dashboard still names the order it belongs to.
        payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.orderNumber } },
        success_url: urls.successUrl,
        cancel_url: urls.cancelUrl,
      },
      { idempotencyKey: `marketplace-order-${order.id}` },
    );

    if (!session.url) {
      // Without a redirect target there is nothing the family can do with this.
      throw new ServiceUnavailableException("Stripe did not return a payment page. Please try again.");
    }
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Prove a webhook payload came from Stripe.
   *
   * Verification is against the RAW request body: any re-serialization changes
   * the bytes and the signature no longer matches. Returns null on any failure,
   * so a caller can only ever answer 400 — never process an unverified event.
   */
  verifyEvent(rawBody: Buffer | string, signature: string | undefined): Stripe.Event | null {
    const secret = this.config.get("stripeWebhookSecret", { infer: true });
    if (!secret || !signature) return null;
    try {
      return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      // Never log the payload or the signature itself.
      this.logger.warn(`Rejected a Stripe webhook: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }
}

/**
 * Decimal money to Stripe's integer minor units.
 *
 * Done on the Decimal, never via `Number`, so a total like 1234.55 cannot become
 * 123454 through binary floating point. Prices are stored at 2 decimal places,
 * which is what every currency this marketplace uses expects.
 */
export function toMinorUnits(amount: Prisma.Decimal): number {
  return Number(amount.mul(100).toFixed(0));
}
