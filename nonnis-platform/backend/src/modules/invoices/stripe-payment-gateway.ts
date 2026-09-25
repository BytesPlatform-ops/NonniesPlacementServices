import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import type { AppConfig } from "../../config/configuration";
import { PrismaService } from "../../database/prisma.service";
import type {
  GatewayCheckout,
  GatewayCheckoutRequest,
  GatewayPaymentEvent,
  GatewaySubscription,
  GatewaySubscriptionRequest,
  PaymentGateway,
} from "./payment-gateway";

/**
 * Decimal money to Stripe's integer minor units.
 *
 * On the Decimal, never via `Number`: 1234.55 × 100 is 123454.999… in binary
 * floating point, and an invoice that is a cent out is a document somebody has
 * to argue about.
 */
export function toMinorUnits(amount: Prisma.Decimal): number {
  return Number(amount.mul(100).toFixed(0));
}

/** Stripe's minor units back to Decimal, for recording what was actually taken. */
export function fromMinorUnits(amount: number | null | undefined): Prisma.Decimal | null {
  return amount === null || amount === undefined ? null : new Prisma.Decimal(amount).div(100);
}

/**
 * The real payment processor behind the invoice system.
 *
 * It implements `PaymentGateway` and nothing else knows it is Stripe: the
 * invoice service, the screens and the database all talk to the interface. That
 * is what made it possible to build and test the whole product before any
 * credentials existed, and it is what keeps a processor change from becoming a
 * schema change.
 *
 * Three rules hold throughout:
 *
 *  - Amounts come from the stored invoice, never from a request.
 *  - Every object carries `invoiceId` (or `subscriptionId`) in metadata, so a
 *    webhook can route an event by what it IS rather than by guessing from
 *    amounts or names.
 *  - Nothing here decides an invoice is paid. It reports; the invoice service,
 *    acting on a verified event, decides.
 */
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  readonly name = "stripe";
  private readonly logger = new Logger("StripeGateway");
  private client: Stripe | null = null;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  get configured(): boolean {
    return !!this.config.get("stripeSecretKey", { infer: true });
  }

  get configurationError(): string | null {
    return this.configured ? null : "Online card payment is not available — no Stripe secret key is configured.";
  }

  get webhooksConfigured(): boolean {
    return !!this.config.get("stripeWebhookSecret", { infer: true });
  }

  private stripe(): Stripe {
    const key = this.config.get("stripeSecretKey", { infer: true });
    if (!key) throw new ServiceUnavailableException(this.configurationError!);
    this.client ??= new Stripe(key);
    return this.client;
  }

  /**
   * The provider's Stripe Customer, created once and reused.
   *
   * Reuse matters: a second customer would split a provider's payment methods
   * and billing history across two records in Stripe. The unique column settles
   * a race — a loser re-reads the winner's id rather than creating another.
   */
  private async customerFor(providerId: string, name: string, email: string | null): Promise<string> {
    const existing = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { stripeCustomerId: true } });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await this.stripe().customers.create(
      {
        name,
        ...(email ? { email } : {}),
        metadata: { providerId },
      },
      { idempotencyKey: `provider-customer-${providerId}` },
    );

    try {
      await this.prisma.provider.update({ where: { id: providerId }, data: { stripeCustomerId: customer.id } });
      return customer.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const won = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { stripeCustomerId: true } });
        if (won?.stripeCustomerId) return won.stripeCustomerId;
      }
      throw err;
    }
  }

  /**
   * A Checkout Session for one Nonnis invoice.
   *
   * The amount is the approved invoice total, sent as a single line so Stripe
   * charges exactly what the invoice says rather than re-deriving it from our
   * line items. The idempotency key is the invoice, so a retried request returns
   * the same session instead of opening a second one.
   */
  async createCheckout(request: GatewayCheckoutRequest): Promise<GatewayCheckout> {
    const customer = await this.customerFor(request.providerId, request.providerName, request.providerEmail);

    const session = await this.stripe().checkout.sessions.create(
      {
        mode: "payment",
        customer,
        client_reference_id: request.invoiceId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: toMinorUnits(request.amount),
              product_data: { name: request.description, description: `Nonni's invoice ${request.invoiceNumber}` },
            },
          },
        ],
        // The routing key. A webhook reads this rather than guessing a domain
        // from amounts or customer names.
        metadata: { invoiceId: request.invoiceId, invoiceNumber: request.invoiceNumber },
        payment_intent_data: { metadata: { invoiceId: request.invoiceId, invoiceNumber: request.invoiceNumber } },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      },
      // Keyed on the invoice so a double-click opens one session, not two. When
      // a previous session has died the caller passes its id as `replaces`,
      // which makes this a different request — otherwise Stripe would hand back
      // the very expired session we are trying to replace.
      { idempotencyKey: `nonnis-invoice-${request.invoiceId}${request.replaces ? `-after-${request.replaces}` : ""}` },
    );

    if (!session.url) throw new ServiceUnavailableException("Stripe did not return a payment page. Please try again.");
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Resume a checkout that is still open.
   *
   * Only an `open` session with a URL can be reused: an expired or completed
   * one would show the payer an error page, and a paid one must never be
   * offered again. Anything unreadable is treated as unusable rather than
   * raised, because the caller's answer is the same either way — make a new one.
   */
  async retrieveCheckout(sessionId: string): Promise<GatewayCheckout | null> {
    try {
      const session = await this.stripe().checkout.sessions.retrieve(sessionId);
      if (session.status !== "open" || !session.url) return null;
      if (session.payment_status === "paid") return null;
      return { sessionId: session.id, url: session.url };
    } catch (err) {
      this.logger.warn(`Could not resume a Stripe checkout: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }

  /**
   * A Stripe Subscription for a provider's recurring plan.
   *
   * The price is created inline at the amount approved for THIS provider —
   * there is no shared catalogue price, because the monthly figure is negotiated
   * per provider. A fixed-length plan is given an explicit `cancel_at`, since
   * Stripe cannot stop after N charges on its own.
   */
  async createSubscription(request: GatewaySubscriptionRequest): Promise<GatewaySubscription> {
    const customer = await this.customerFor(request.providerId, request.providerName, request.providerEmail);

    const cancelAt =
      request.totalPeriods && request.totalPeriods > 0
        ? Math.floor(addMonthsUtc(request.startAt, request.totalPeriods).getTime() / 1000)
        : undefined;

    // A subscription price must reference a real Stripe Product — unlike
    // Checkout, it cannot describe one inline. The product is per subscription
    // and keyed on it, so a retried request reuses the same one.
    const product = await this.stripe().products.create(
      { name: request.description, metadata: { subscriptionId: request.subscriptionId } },
      { idempotencyKey: `nonnis-subscription-product-${request.subscriptionId}` },
    );

    const subscription = await this.stripe().subscriptions.create(
      {
        customer,
        items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: toMinorUnits(request.amount),
              recurring: { interval: "month" },
              product: product.id,
            },
          },
        ],
        ...(cancelAt ? { cancel_at: cancelAt } : {}),
        // Charge automatically; Nonnis synchronizes the result by webhook.
        collection_method: "charge_automatically",
        metadata: { subscriptionId: request.subscriptionId },
      },
      { idempotencyKey: `nonnis-subscription-${request.subscriptionId}` },
    );

    return { subscriptionId: subscription.id, customerId: customer, url: null };
  }

  /**
   * Prove a payload came from Stripe and normalize it.
   *
   * Verified against the RAW body: re-serializing JSON changes the bytes the
   * signature covers. Returns null for anything unverifiable, so a caller can
   * only answer 400 — never process an unproven event.
   *
   * Snapshot (classic) payloads only: this reads `event.data.object`.
   */
  verifyEvent(rawBody: Buffer | string, signature: string | undefined): GatewayPaymentEvent | null {
    const event = this.constructEvent(rawBody, signature);
    if (!event) return null;
    return normalizeEvent(event);
  }

  /** The verified Stripe event itself, for callers that dispatch on type. */
  constructEvent(rawBody: Buffer | string, signature: string | undefined): Stripe.Event | null {
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

/** Advance by whole months, clamping a rollover into the same month. */
export function addMonthsUtc(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

/** A verified Stripe event reduced to what the invoice system acts on. */
export function normalizeEvent(event: Stripe.Event): GatewayPaymentEvent | null {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status !== "paid") return null;
      return {
        kind: "succeeded",
        sessionId: s.id,
        paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
        subscriptionId: null,
        amount: fromMinorUnits(s.amount_total),
        rawStatus: s.payment_status,
      };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      return { kind: "failed", sessionId: s.id, paymentIntentId: null, subscriptionId: null, amount: null, rawStatus: s.status ?? "failed" };
    }
    default:
      return null;
  }
}
