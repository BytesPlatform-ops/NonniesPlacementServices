import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../../common/rbac";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import type { InvoiceEmailService } from "./invoice-email.service";
import type { PaymentGateway } from "./payment-gateway";
import type { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "./invoices.service";
import { ZELLE_RECIPIENT } from "./zelle";

const dec = (v: string) => new Prisma.Decimal(v);

function actor(permissions: string[] = [PERMISSIONS.INVOICES_READ_OWN]): RequestUser {
  return { id: "user-1", email: "billing@sunrise.test", activeOrganizationId: "org-a", activePermissions: new Set(permissions) } as unknown as RequestUser;
}

const FULL = {
  id: "inv-1",
  invoiceNumber: "INV-2026-ABC123",
  provider: { id: "provider-a", displayName: "Sunrise", email: "billing@sunrise.test" },
  caseId: null,
  orderId: null,
  status: "SENT",
  billingType: "ONE_TIME",
  paymentMethod: "BANK_TRANSFER",
  issueDate: new Date("2026-09-01T00:00:00Z"),
  dueDate: null,
  currency: "USD",
  subtotal: dec("4000.00"),
  taxRate: dec("0"),
  taxAmount: dec("0.00"),
  totalAmount: dec("4000.00"),
  amountPaid: dec("0.00"),
  notes: null,
  stripeCheckoutSessionId: null,
  stripeSubscriptionId: null,
  recurringInterval: null,
  recurringPeriods: null,
  recurringStartAt: null,
  recurringEndsAt: null,
  sentAt: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  items: [],
  payments: [],
  events: [],
};

const SLIM = { id: "inv-1", invoiceNumber: "INV-2026-ABC123", status: "SENT", totalAmount: dec("4000.00"), amountPaid: dec("0.00") };

function build(
  over: {
    full?: Record<string, unknown> | null;
    slim?: Record<string, unknown> | null;
    findFirst?: Record<string, unknown> | null;
    settledCount?: number;
    configured?: boolean;
  } = {},
) {
  const paymentUpsert = jest.fn().mockResolvedValue({});
  const eventCreate = jest.fn().mockResolvedValue({});
  const settle = jest.fn().mockResolvedValue({ count: over.settledCount ?? 1 });
  const invoiceUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const auditRecord = jest.fn().mockResolvedValue({});

  const tx = {
    invoice: { updateMany: settle },
    invoicePayment: { upsert: paymentUpsert },
    invoiceEvent: { create: eventCreate },
  };

  const prisma = {
    invoice: {
      // get() includes relations; the Stripe handlers select a slim row.
      findUnique: jest.fn().mockImplementation((args: { include?: unknown }) => {
        if (args?.include) return Promise.resolve("full" in over ? over.full : FULL);
        return Promise.resolve("slim" in over ? over.slim : SLIM);
      }),
      findFirst: jest.fn().mockResolvedValue("findFirst" in over ? over.findFirst : FULL),
      updateMany: invoiceUpdateMany,
    },
    provider: { findUnique: jest.fn().mockResolvedValue({ id: "provider-a" }) },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;

  const createCheckout = jest.fn().mockResolvedValue({ sessionId: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" });
  const configured = over.configured ?? true;
  const gateway = {
    name: "stripe",
    configured,
    configurationError: configured ? null : "Online card payment is not available — no Stripe secret key is configured.",
    webhooksConfigured: configured,
    createCheckout,
    createSubscription: jest.fn(),
    verifyEvent: jest.fn(),
  } as unknown as PaymentGateway;

  // Key-aware: a config that answers every question with a URL would make
  // "bank details" look configured when nothing was configured.
  const config = {
    get: (k: string) => (k === "frontendUrl" ? "http://localhost:3001" : undefined),
  } as unknown as ConstructorParameters<typeof InvoicesService>[3];
  // The provider is told in-app that a bill has arrived; the double records the
  // call so the tests can assert who was told, without a notifications stack.
  const notificationsRaise = jest.fn().mockResolvedValue({});
  const notifications = {
    raise: notificationsRaise,
    for: {
      providerUsers: jest.fn().mockResolvedValue(["provider-user-1"]),
      providerOrganizationId: jest.fn().mockResolvedValue("org-a"),
    },
  } as unknown as NotificationsService;
  const svc = new InvoicesService(prisma, { record: auditRecord } as unknown as AuditService, {} as unknown as InvoiceEmailService, config, gateway, notifications);
  return { svc, notificationsRaise, prisma, gateway, createCheckout, paymentUpsert, eventCreate, settle, invoiceUpdateMany, auditRecord };
}

describe("createStripeCheckout — the browser cannot influence what is billed", () => {
  beforeEach(() => jest.clearAllMocks());

  it("charges the stored amount, in the invoice's own currency", async () => {
    const { svc, createCheckout } = build();
    await svc.createStripeCheckout(actor(), "inv-1");

    const sent = createCheckout.mock.calls[0][0];
    expect(sent.amount.toFixed(2)).toBe("4000.00");
    expect(sent.currency).toBe("USD");
    expect(sent.providerId).toBe("provider-a");
  });

  it("carries the invoice id as metadata, which is what the webhook routes on", async () => {
    const { svc, createCheckout } = build();
    await svc.createStripeCheckout(actor(), "inv-1");

    expect(createCheckout.mock.calls[0][0]).toMatchObject({ invoiceId: "inv-1", invoiceNumber: "INV-2026-ABC123" });
  });

  it("records the session against the invoice but does NOT move its status", async () => {
    // Returning from Stripe proves nothing. Only a verified webhook settles.
    const { svc, invoiceUpdateMany } = build();
    await svc.createStripeCheckout(actor(), "inv-1");

    const data = invoiceUpdateMany.mock.calls[0][0].data;
    expect(data).toEqual({ stripeCheckoutSessionId: "cs_test_1" });
    expect(data).not.toHaveProperty("status");
    expect(invoiceUpdateMany.mock.calls[0][0].where.status).toEqual({ notIn: ["PAID", "CANCELLED"] });
  });

  it("does not stamp a payment method onto the invoice just because a card page opened", async () => {
    // How the provider pays is their choice, made after the invoice arrives.
    // Opening the card page is not that choice, and a provider who then pays by
    // bank transfer must not find the record already saying otherwise.
    const { svc, invoiceUpdateMany } = build();
    await svc.createStripeCheckout(actor(), "inv-1");
    expect(invoiceUpdateMany.mock.calls[0][0].data).not.toHaveProperty("paymentMethod");
  });

  it("neither return URL asserts that payment happened", async () => {
    const { svc, createCheckout } = build();
    await svc.createStripeCheckout(actor(), "inv-1");

    const { successUrl, cancelUrl } = createCheckout.mock.calls[0][0];
    expect(successUrl).toContain("payment=processing");
    expect(cancelUrl).toContain("payment=cancelled");
    expect(successUrl).not.toMatch(/paid|success/i);
  });

  it.each([
    ["DRAFT", "not been approved"],
    ["PENDING_REVIEW", "not been approved"],
    ["PAID", "already paid"],
    ["CANCELLED", "cancelled"],
  ])("refuses to open a payment page for a %s invoice", async (status, reason) => {
    const { svc, createCheckout } = build({ full: { ...FULL, status } });
    await expect(svc.createStripeCheckout(actor(), "inv-1")).rejects.toThrow(new RegExp(reason, "i"));
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("says so plainly when no processor is connected", async () => {
    const { svc } = build({ configured: false });
    await expect(svc.createStripeCheckout(actor(), "inv-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("404s another provider's invoice instead of confirming it exists", async () => {
    const { svc } = build({ findFirst: null });
    await expect(svc.getOwn(actor(), "inv-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("applyStripePaid — settling from a verified event", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marks the invoice paid and records the payment against the PaymentIntent", async () => {
    const { svc, paymentUpsert, settle, eventCreate } = build();
    const out = await svc.applyStripePaid({ invoiceId: "inv-1", paymentIntentId: "pi_1", amount: dec("4000.00") });

    expect(out).toEqual({ applied: true });
    expect(paymentUpsert.mock.calls[0][0].where).toEqual({ stripePaymentIntentId: "pi_1" });
    expect(settle.mock.calls[0][0].data.status).toBe("PAID");
    expect(eventCreate.mock.calls[0][0].data.actorRef).toBe("system:stripe-webhook");
  });

  it("only settles an invoice that is not already PAID or CANCELLED", async () => {
    const { svc, settle } = build();
    await svc.applyStripePaid({ invoiceId: "inv-1", paymentIntentId: "pi_1", amount: dec("4000.00") });
    expect(settle.mock.calls[0][0].where.status).toEqual({ notIn: ["PAID", "CANCELLED"] });
  });

  it("absorbs a duplicate delivery without recording a second settlement", async () => {
    // Stripe delivers at least once. The second delivery finds nothing to
    // update, so no event and no audit entry is written for it.
    const { svc, settle, eventCreate, auditRecord } = build({ settledCount: 0 });
    const out = await svc.applyStripePaid({ invoiceId: "inv-1", paymentIntentId: "pi_1", amount: dec("4000.00") });

    expect(out).toEqual({ applied: false });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(eventCreate).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it("falls back to the outstanding balance when Stripe sends no amount", async () => {
    const { svc, paymentUpsert } = build({ slim: { ...SLIM, amountPaid: dec("1000.00") } });
    await svc.applyStripePaid({ invoiceId: "inv-1", paymentIntentId: "pi_1", amount: null });

    expect(paymentUpsert.mock.calls[0][0].create.amount.toFixed(2)).toBe("3000.00");
  });

  it("stores the Stripe invoice id when the payment came from a subscription period", async () => {
    const { svc, settle } = build();
    await svc.applyStripePaid({ invoiceId: "inv-1", paymentIntentId: "pi_1", amount: dec("4000.00"), stripeInvoiceId: "in_1" });
    expect(settle.mock.calls[0][0].data.stripeInvoiceId).toBe("in_1");
  });

  it("ignores a payment for an invoice that does not exist rather than throwing at Stripe", async () => {
    const { svc, settle } = build({ slim: null });
    await expect(svc.applyStripePaid({ invoiceId: "gone", paymentIntentId: "pi_1", amount: dec("1.00") })).resolves.toEqual({ applied: false });
    expect(settle).not.toHaveBeenCalled();
  });
});

describe("applyStripeFailed — a declined card is not a closed bill", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the invoice payable and records the failed attempt", async () => {
    const { svc, paymentUpsert, eventCreate, settle } = build({ slim: { id: "inv-1", status: "SENT", invoiceNumber: "INV-1" } });
    const out = await svc.applyStripeFailed({ invoiceId: "inv-1", paymentIntentId: "pi_1", rawStatus: "expired" });

    expect(out).toEqual({ applied: true });
    expect(paymentUpsert.mock.calls[0][0].create.status).toBe("FAILED");
    expect(paymentUpsert.mock.calls[0][0].create.amount.toFixed(2)).toBe("0.00");
    expect(eventCreate.mock.calls[0][0].data.type).toBe("payment_failed");
    // The invoice status is untouched — it is still owed.
    expect(settle).not.toHaveBeenCalled();
  });

  it("never reopens an invoice that is already paid", async () => {
    const { svc, eventCreate } = build({ slim: { id: "inv-1", status: "PAID", invoiceNumber: "INV-1" } });
    await expect(svc.applyStripeFailed({ invoiceId: "inv-1", paymentIntentId: "pi_1", rawStatus: "expired" })).resolves.toEqual({ applied: false });
    expect(eventCreate).not.toHaveBeenCalled();
  });
});

describe("paymentOptions — the provider chooses, not the invoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers card and Zelle together when Stripe is connected", () => {
    const { svc } = build();
    const opts = svc.paymentOptions();
    expect(opts.card).toBe(true);
    expect(opts.cardUnavailableReason).toBeNull();
    expect(opts.zelle).toBe(true);
    expect(opts.zelleRecipient).toBe("Nonni's Placement Services LLC");
    expect(opts.zelleQrUrl).toBe("http://localhost:3001/51094.jpg");
  });

  it("keeps Zelle available when no processor is connected", () => {
    // Somebody can always be shown where to send money.
    const { svc } = build({ configured: false });
    const opts = svc.paymentOptions();
    expect(opts.card).toBe(false);
    expect(opts.zelle).toBe(true);
    expect(opts.cardUnavailableReason).toMatch(/not available/i);
  });

  it("takes no argument, so no invoice can narrow what a provider may do", () => {
    // The guarantee is structural: there is nothing to pass, so
    // invoice.paymentMethod cannot reach this decision even by accident.
    const { svc } = build();
    expect(svc.paymentOptions.length).toBe(0);
  });

  it("names one Zelle recipient, so three surfaces cannot disagree", () => {
    // Money going to the wrong account is the failure this guards.
    const { svc } = build();
    expect(svc.paymentOptions().zelleRecipient).toBe(ZELLE_RECIPIENT);
  });
});
