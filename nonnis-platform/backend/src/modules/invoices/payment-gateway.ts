import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { AppConfig } from "../../config/configuration";

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export interface GatewayCheckoutRequest {
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  amount: Prisma.Decimal;
  currency: string;
  /** Where the provider lands afterwards. Neither page may assert payment. */
  successUrl: string;
  cancelUrl: string;
  /** Billing contact, so the gateway can attach the charge to a customer. */
  providerEmail: string | null;
  providerName: string;
  /** Who is being billed, so one Stripe Customer can be reused per provider. */
  providerId: string;
  /** A dead session this one replaces, so the retry is not deduplicated onto it. */
  replaces?: string | null;
}

export interface GatewaySubscriptionRequest extends Omit<GatewayCheckoutRequest, "invoiceId" | "invoiceNumber"> {
  subscriptionId: string;
  interval: "MONTHLY";
  /** Total charges, when the plan is fixed-length. */
  totalPeriods: number | null;
  startAt: Date;
}

export interface GatewayCheckout {
  /** Where to send the payer. */
  url: string;
  /** The gateway's own reference, stored against the invoice. */
  sessionId: string;
}

export interface GatewaySubscription {
  subscriptionId: string;
  customerId: string | null;
  url: string | null;
}

/** What a verified gateway event tells us about one payment. */
export interface GatewayPaymentEvent {
  kind: "succeeded" | "failed" | "refunded";
  sessionId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  amount: Prisma.Decimal | null;
  rawStatus: string | null;
}

/**
 * Everything the invoice system needs from a payment processor — and nothing
 * about which processor it is.
 *
 * The invoice system is deliberately written against this interface rather than
 * against Stripe. Two consequences that matter:
 *
 *  - The product works today with no credentials at all. An unconfigured
 *    gateway answers "not available", every offline route keeps working, and
 *    nothing pretends a payment happened.
 *  - Connecting Stripe later is an implementation swap. No invoice table, no
 *    status transition and no screen has to change.
 *
 * A gateway may only ever REPORT payment. Nothing here can mark an invoice paid;
 * that decision belongs to the invoice service, acting on a verified event.
 */
export interface PaymentGateway {
  readonly name: string;
  /** False when the integration has no credentials. Never throws. */
  readonly configured: boolean;
  /** Safe, secret-free reason it is unavailable, or null when it is ready. */
  readonly configurationError: string | null;
  /** True when an event can be proved genuine. */
  readonly webhooksConfigured: boolean;

  createCheckout(request: GatewayCheckoutRequest): Promise<GatewayCheckout>;
  /**
   * An existing checkout, if it is still usable.
   *
   * Returns null when the session has expired, been paid, or cannot be found,
   * so a caller opens a fresh one rather than sending a payer to a dead page.
   */
  retrieveCheckout(sessionId: string): Promise<GatewayCheckout | null>;
  createSubscription(request: GatewaySubscriptionRequest): Promise<GatewaySubscription>;
  /** Returns null for anything that cannot be proved to come from the gateway. */
  verifyEvent(rawBody: Buffer | string, signature: string | undefined): GatewayPaymentEvent | null;
}

/**
 * The gateway used while no processor is connected.
 *
 * It refuses clearly rather than failing obscurely, and it never fabricates a
 * session, a URL or a payment. Online payment is simply unavailable; Zelle,
 * cash and bank transfer carry on exactly as they do with a gateway present.
 */
@Injectable()
export class UnconfiguredPaymentGateway implements PaymentGateway {
  readonly name = "unconfigured";
  private readonly logger = new Logger("PaymentGateway");

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get configured(): boolean {
    return false;
  }

  get configurationError(): string {
    return this.config.get("stripeSecretKey", { infer: true })
      ? "Online card payment is not switched on yet."
      : "Online card payment is not available yet — no payment processor is connected.";
  }

  get webhooksConfigured(): boolean {
    return false;
  }

  createCheckout(): Promise<GatewayCheckout> {
    throw new ServiceUnavailableException(this.configurationError);
  }

  createSubscription(): Promise<GatewaySubscription> {
    throw new ServiceUnavailableException(this.configurationError);
  }

  async retrieveCheckout(): Promise<GatewayCheckout | null> {
    // Nothing was ever created, so there is nothing to resume.
    return null;
  }

  verifyEvent(): GatewayPaymentEvent | null {
    // Nothing can be verified without a signing secret, so nothing is trusted.
    this.logger.warn("A payment webhook arrived while no processor is connected; ignoring it.");
    return null;
  }
}
