import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import { SubscriptionsService } from "./subscriptions.service";

const dec = (v: string) => new Prisma.Decimal(v);

const OLDEST = { id: "inv-oct", invoiceNumber: "INV-2026-OCT", status: "SENT", totalAmount: dec("500.00") };

function build(
  over: {
    subscription?: Record<string, unknown> | null;
    alreadySeen?: Record<string, unknown> | null;
    target?: Record<string, unknown> | null;
    endedCount?: number;
  } = {},
) {
  const paymentUpsert = jest.fn().mockResolvedValue({});
  const eventCreate = jest.fn().mockResolvedValue({});
  const settle = jest.fn().mockResolvedValue({ count: 1 });
  const auditRecord = jest.fn().mockResolvedValue({});
  const subUpdateMany = jest.fn().mockResolvedValue({ count: over.endedCount ?? 1 });

  const tx = {
    invoice: { updateMany: settle },
    invoicePayment: { upsert: paymentUpsert },
    invoiceEvent: { create: eventCreate },
  };

  const invoiceFindUnique = jest.fn().mockResolvedValue("alreadySeen" in over ? over.alreadySeen : null);
  const invoiceFindFirst = jest.fn().mockResolvedValue("target" in over ? over.target : OLDEST);

  const prisma = {
    providerSubscription: {
      findUnique: jest.fn().mockResolvedValue("subscription" in over ? over.subscription : { id: "sub-1" }),
      updateMany: subUpdateMany,
    },
    invoice: { findUnique: invoiceFindUnique, findFirst: invoiceFindFirst },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;

  const svc = new SubscriptionsService(prisma, { record: auditRecord } as unknown as AuditService);
  return { svc, paymentUpsert, eventCreate, settle, auditRecord, subUpdateMany, invoiceFindFirst };
}

const paid = { stripeSubscriptionId: "sub_stripe_1", stripeInvoiceId: "in_1", paymentIntentId: "pi_1", amount: dec("500.00") };

describe("invoice.paid — a recurring charge settles the month it belongs to", () => {
  beforeEach(() => jest.clearAllMocks());

  it("settles the OLDEST unpaid period, not the newest", async () => {
    // Stripe charges in order; so must we, or a late payment would settle
    // December while October stayed open.
    const { svc, invoiceFindFirst, settle } = build();
    await svc.applyStripeInvoicePaid(paid);

    expect(invoiceFindFirst.mock.calls[0][0].orderBy).toEqual({ periodStart: "asc" });
    expect(invoiceFindFirst.mock.calls[0][0].where.status).toEqual({ notIn: ["PAID", "CANCELLED"] });
    expect(settle.mock.calls[0][0].where.id).toBe("inv-oct");
    expect(settle.mock.calls[0][0].data.status).toBe("PAID");
  });

  it("links the Stripe invoice id, which is what makes a redelivery a no-op", async () => {
    const { svc, settle } = build();
    await svc.applyStripeInvoicePaid(paid);
    expect(settle.mock.calls[0][0].data.stripeInvoiceId).toBe("in_1");
  });

  it("does nothing the second time Stripe delivers the same invoice", async () => {
    const { svc, settle, eventCreate, auditRecord } = build({ alreadySeen: { id: "inv-oct" } });
    await expect(svc.applyStripeInvoicePaid(paid)).resolves.toEqual({ applied: false });

    expect(settle).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it("acknowledges a charge for a plan we do not hold, without inventing one", async () => {
    const { svc, settle } = build({ subscription: null });
    await expect(svc.applyStripeInvoicePaid(paid)).resolves.toEqual({ applied: false });
    expect(settle).not.toHaveBeenCalled();
  });

  it("never invents an invoice when Stripe is ahead of our generation run", async () => {
    const { svc, settle, eventCreate } = build({ target: null });
    await expect(svc.applyStripeInvoicePaid(paid)).resolves.toEqual({ applied: false });
    expect(settle).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("uses the invoice total when Stripe reports no amount", async () => {
    const { svc, paymentUpsert } = build();
    await svc.applyStripeInvoicePaid({ ...paid, amount: null });
    expect(paymentUpsert.mock.calls[0][0].create.amount.toFixed(2)).toBe("500.00");
  });

  it("attributes the settlement to the webhook, never to a person", async () => {
    const { svc, eventCreate, auditRecord } = build();
    await svc.applyStripeInvoicePaid(paid);

    expect(eventCreate.mock.calls[0][0].data.actorRef).toBe("system:stripe-webhook");
    expect(auditRecord.mock.calls[0][0]).toMatchObject({ actorRef: "system:stripe-webhook", metadata: expect.objectContaining({ recurring: true }) });
  });
});

describe("invoice.payment_failed — the month stays owed and stays visible", () => {
  beforeEach(() => jest.clearAllMocks());

  it("records the failure without touching the invoice status", async () => {
    const { svc, paymentUpsert, eventCreate, settle } = build({ target: { id: "inv-oct" } });
    await expect(svc.applyStripeInvoiceFailed({ stripeSubscriptionId: "sub_stripe_1", stripeInvoiceId: "in_1", paymentIntentId: "pi_1" })).resolves.toEqual({
      applied: true,
    });

    expect(paymentUpsert.mock.calls[0][0].create.status).toBe("FAILED");
    expect(eventCreate.mock.calls[0][0].data.type).toBe("payment_failed");
    expect(settle).not.toHaveBeenCalled();
  });

  it("ignores a failure for a plan we do not hold", async () => {
    const { svc, eventCreate } = build({ subscription: null });
    await expect(svc.applyStripeInvoiceFailed({ stripeSubscriptionId: "sub_stripe_1", stripeInvoiceId: null, paymentIntentId: null })).resolves.toEqual({
      applied: false,
    });
    expect(eventCreate).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.deleted", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cancels the Nonnis plan and stops billing it", async () => {
    const { svc, subUpdateMany } = build();
    await expect(svc.applyStripeSubscriptionEnded("sub_stripe_1")).resolves.toEqual({ applied: true });

    const call = subUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ stripeSubscriptionId: "sub_stripe_1", status: { notIn: ["CANCELLED", "COMPLETED"] } });
    expect(call.data.status).toBe("CANCELLED");
    expect(call.data.nextBillingDate).toBeNull();
  });

  it("is a no-op for a plan that already ended", async () => {
    const { svc } = build({ endedCount: 0 });
    await expect(svc.applyStripeSubscriptionEnded("sub_stripe_1")).resolves.toEqual({ applied: false });
  });
});
