import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import type Stripe from "stripe";
import type { MarketplaceOrdersService } from "./orders.service";
import type { MarketplaceStripeService } from "./stripe.service";
import type { InvoicesService } from "../invoices/invoices.service";
import type { SubscriptionsService } from "../invoices/subscriptions.service";
import { MarketplaceStripeWebhookController } from "./stripe-webhook.controller";

function build(event: Stripe.Event | null) {
  const orderPaid = jest.fn().mockResolvedValue({ applied: true });
  const orderFailed = jest.fn().mockResolvedValue({ applied: true });
  const invoicePaid = jest.fn().mockResolvedValue({ applied: true });
  const invoiceFailed = jest.fn().mockResolvedValue({ applied: true });
  const subPaid = jest.fn().mockResolvedValue({ applied: true });
  const subFailed = jest.fn().mockResolvedValue({ applied: true });
  const subEnded = jest.fn().mockResolvedValue({ applied: true });

  const ctrl = new MarketplaceStripeWebhookController(
    { verifyEvent: jest.fn().mockReturnValue(event) } as unknown as MarketplaceStripeService,
    { applyStripePaid: orderPaid, applyStripeFailed: orderFailed } as unknown as MarketplaceOrdersService,
    { applyStripePaid: invoicePaid, applyStripeFailed: invoiceFailed } as unknown as InvoicesService,
    {
      applyStripeInvoicePaid: subPaid,
      applyStripeInvoiceFailed: subFailed,
      applyStripeSubscriptionEnded: subEnded,
    } as unknown as SubscriptionsService,
  );
  return { ctrl, orderPaid, orderFailed, invoicePaid, invoiceFailed, subPaid, subFailed, subEnded };
}

const req = { body: Buffer.from("{}") } as unknown as Request;
const run = (c: MarketplaceStripeWebhookController) => c.handle(req, "sig");

const session = (over: Record<string, unknown> = {}) =>
  ({ id: "cs_1", payment_status: "paid", payment_intent: "pi_1", amount_total: 50000, metadata: {}, ...over }) as unknown as Stripe.Checkout.Session;

const event = (type: string, object: unknown): Stripe.Event => ({ type, data: { object } }) as unknown as Stripe.Event;

describe("the shared Stripe webhook routes by METADATA, never by guesswork", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends a session carrying invoiceId to the invoice flow", async () => {
    const { ctrl, invoicePaid, orderPaid } = build(event("checkout.session.completed", session({ metadata: { invoiceId: "inv-1" } })));
    await run(ctrl);

    expect(invoicePaid).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv-1", paymentIntentId: "pi_1" }));
    expect(orderPaid).not.toHaveBeenCalled();
  });

  it("sends a session WITHOUT invoiceId to the marketplace flow, exactly as before", async () => {
    // The existing behaviour has to survive untouched.
    const { ctrl, orderPaid, invoicePaid } = build(event("checkout.session.completed", session({ metadata: { orderId: "order-1" } })));
    await run(ctrl);

    expect(orderPaid).toHaveBeenCalledWith({ sessionId: "cs_1", paymentIntentId: "pi_1", stripeStatus: "paid" });
    expect(invoicePaid).not.toHaveBeenCalled();
  });

  it("treats a session with no metadata at all as marketplace, preserving old sessions", async () => {
    const { ctrl, orderPaid } = build(event("checkout.session.completed", session({ metadata: null })));
    await run(ctrl);
    expect(orderPaid).toHaveBeenCalled();
  });

  it("never settles anything for a completed session whose payment is still pending", async () => {
    const { ctrl, orderPaid, invoicePaid } = build(event("checkout.session.completed", session({ payment_status: "unpaid", metadata: { invoiceId: "inv-1" } })));
    await run(ctrl);
    expect(orderPaid).not.toHaveBeenCalled();
    expect(invoicePaid).not.toHaveBeenCalled();
  });

  it("routes a failed session by the same rule", async () => {
    const { ctrl, invoiceFailed, orderFailed } = build(event("checkout.session.async_payment_failed", session({ status: "expired", metadata: { invoiceId: "inv-1" } })));
    await run(ctrl);
    expect(invoiceFailed).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv-1" }));
    expect(orderFailed).not.toHaveBeenCalled();
  });

  it("routes an expired marketplace session to the order flow", async () => {
    const { ctrl, orderFailed } = build(event("checkout.session.expired", session({ status: "expired", metadata: {} })));
    await run(ctrl);
    expect(orderFailed).toHaveBeenCalledWith({ sessionId: "cs_1", stripeStatus: "expired" });
  });
});

describe("recurring subscription events", () => {
  beforeEach(() => jest.clearAllMocks());

  const stripeInvoice = (over: Record<string, unknown> = {}) =>
    ({ id: "in_1", subscription: "sub_stripe_1", payment_intent: "pi_9", amount_paid: 50000, ...over }) as unknown as Stripe.Invoice;

  it("settles the matching Nonnis period on invoice.paid", async () => {
    const { ctrl, subPaid } = build(event("invoice.paid", stripeInvoice()));
    await run(ctrl);
    expect(subPaid).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: "sub_stripe_1", stripeInvoiceId: "in_1", paymentIntentId: "pi_9" }),
    );
  });

  it("reads an expanded subscription object as well as an id", async () => {
    const { ctrl, subPaid } = build(event("invoice.paid", stripeInvoice({ subscription: { id: "sub_stripe_2" } })));
    await run(ctrl);
    expect(subPaid.mock.calls[0][0].stripeSubscriptionId).toBe("sub_stripe_2");
  });

  it("ignores a one-off Stripe invoice that belongs to no subscription", async () => {
    const { ctrl, subPaid } = build(event("invoice.paid", stripeInvoice({ subscription: null })));
    await run(ctrl);
    expect(subPaid).not.toHaveBeenCalled();
  });

  it("records a failure without settling anything", async () => {
    const { ctrl, subFailed, subPaid } = build(event("invoice.payment_failed", stripeInvoice()));
    await run(ctrl);
    expect(subFailed).toHaveBeenCalledWith(expect.objectContaining({ stripeSubscriptionId: "sub_stripe_1" }));
    expect(subPaid).not.toHaveBeenCalled();
  });

  it("synchronizes a deleted subscription", async () => {
    const { ctrl, subEnded } = build(event("customer.subscription.deleted", { id: "sub_stripe_1" }));
    await run(ctrl);
    expect(subEnded).toHaveBeenCalledWith("sub_stripe_1");
  });
});

describe("signature and unknown events", () => {
  beforeEach(() => jest.clearAllMocks());

  it("refuses an unverifiable payload with 400 and touches nothing", async () => {
    const { ctrl, orderPaid, invoicePaid } = build(null);
    await expect(run(ctrl)).rejects.toBeInstanceOf(BadRequestException);
    expect(orderPaid).not.toHaveBeenCalled();
    expect(invoicePaid).not.toHaveBeenCalled();
  });

  it("acknowledges an unrelated Stripe event instead of erroring", async () => {
    const { ctrl, orderPaid, invoicePaid, subPaid } = build(event("customer.created", { id: "cus_1" }));
    await expect(run(ctrl)).resolves.toEqual({ received: true });
    expect(orderPaid).not.toHaveBeenCalled();
    expect(invoicePaid).not.toHaveBeenCalled();
    expect(subPaid).not.toHaveBeenCalled();
  });

  it("absorbs a duplicate delivery by handing it to the same idempotent handler", async () => {
    // Stripe delivers at least once; the handlers are what dedupe, and the
    // controller must not add a second opinion.
    const { ctrl, invoicePaid } = build(event("checkout.session.completed", session({ metadata: { invoiceId: "inv-1" } })));
    await run(ctrl);
    await run(ctrl);
    expect(invoicePaid).toHaveBeenCalledTimes(2);
    expect(invoicePaid.mock.calls[0][0]).toEqual(invoicePaid.mock.calls[1][0]);
  });
});
