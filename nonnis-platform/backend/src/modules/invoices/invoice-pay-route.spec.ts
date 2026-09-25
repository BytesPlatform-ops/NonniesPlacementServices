import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { InvoiceEmailService } from "./invoice-email.service";
import type { PaymentGateway } from "./payment-gateway";
import type { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "./invoices.service";
import { InvoicePaymentsController } from "./invoice-payments.controller";
import { mintPaymentToken } from "./payment-link";

const dec = (v: string) => new Prisma.Decimal(v);
const INVOICE_ID = "63fd861c-fed3-4857-899f-0de3ebef6ee8";
const OTHER_ID = "11111111-2222-3333-4444-555555555555";
const SECRET = "a-long-server-side-secret-value";

const CONFIG = {
  get: (k: string) =>
    k === "invoicePaymentLinkSecret" ? SECRET : k === "communicationsApiUrl" ? "http://localhost:4000" : "http://localhost:3001",
} as unknown as ConstructorParameters<typeof InvoicesService>[3];

const FULL = {
  id: INVOICE_ID,
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

function build(
  over: { full?: Record<string, unknown> | null; existingSession?: string | null; resumable?: { sessionId: string; url: string } | null; configured?: boolean } = {},
) {
  const createCheckout = jest.fn().mockResolvedValue({ sessionId: "cs_new_1", url: "https://checkout.stripe.test/cs_new_1" });
  const retrieveCheckout = jest.fn().mockResolvedValue("resumable" in over ? over.resumable : null);
  const invoiceUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const auditRecord = jest.fn().mockResolvedValue({});

  const prisma = {
    invoice: {
      findUnique: jest.fn().mockImplementation((args: { include?: unknown; select?: Record<string, unknown> }) => {
        if (args?.include) return Promise.resolve("full" in over ? over.full : FULL);
        if (args?.select?.stripeCheckoutSessionId) return Promise.resolve({ stripeCheckoutSessionId: over.existingSession ?? null });
        // the existence probe in the token path
        return Promise.resolve("full" in over ? (over.full ? { id: INVOICE_ID } : null) : { id: INVOICE_ID });
      }),
      updateMany: invoiceUpdateMany,
    },
    provider: { findUnique: jest.fn().mockResolvedValue({ id: "provider-a" }) },
  } as unknown as PrismaService;

  const configured = over.configured ?? true;
  const gateway = {
    name: "stripe",
    configured,
    configurationError: configured ? null : "Online card payment is not available.",
    webhooksConfigured: configured,
    createCheckout,
    retrieveCheckout,
    createSubscription: jest.fn(),
    verifyEvent: jest.fn(),
  } as unknown as PaymentGateway;
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

  const svc = new InvoicesService(prisma as never, { record: auditRecord } as unknown as AuditService, {} as unknown as InvoiceEmailService, CONFIG, gateway, notifications);
  return { svc, notificationsRaise, createCheckout, retrieveCheckout, invoiceUpdateMany, auditRecord, gateway };
}

const token = (id = INVOICE_ID) => mintPaymentToken(CONFIG as never, id)!;

describe("the emailed link opens a payment page for exactly one invoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the token to its invoice and returns a Stripe URL", async () => {
    const { svc } = build();
    await expect(svc.beginCardPaymentByToken(token())).resolves.toEqual({ url: "https://checkout.stripe.test/cs_new_1" });
  });

  it("bills the STORED amount — the link carries no figure to tamper with", async () => {
    const { svc, createCheckout } = build();
    await svc.beginCardPaymentByToken(token());

    const sent = createCheckout.mock.calls[0][0];
    expect(sent.amount.toFixed(2)).toBe("4000.00");
    expect(sent.currency).toBe("USD");
    expect(sent.invoiceId).toBe(INVOICE_ID);
  });

  it("puts the invoice id in metadata, which is what the webhook routes on", async () => {
    const { svc, createCheckout } = build();
    await svc.beginCardPaymentByToken(token());
    expect(createCheckout.mock.calls[0][0]).toMatchObject({ invoiceId: INVOICE_ID, invoiceNumber: "INV-2026-ABC123" });
  });

  it("does not mark the invoice paid, or move it at all", async () => {
    const { svc, invoiceUpdateMany } = build();
    await svc.beginCardPaymentByToken(token());

    const data = invoiceUpdateMany.mock.calls[0][0].data;
    expect(data).toEqual({ stripeCheckoutSessionId: "cs_new_1" });
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("paidAt");
  });

  it("refuses a token this server did not mint", async () => {
    const { svc, createCheckout } = build();
    await expect(svc.beginCardPaymentByToken("not-a-real-token")).rejects.toBeInstanceOf(NotFoundException);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("refuses a token for an invoice that no longer exists", async () => {
    const { svc, createCheckout } = build({ full: null });
    await expect(svc.beginCardPaymentByToken(token(OTHER_ID))).rejects.toBeInstanceOf(NotFoundException);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ["PAID", "already paid"],
    ["CANCELLED", "cancelled"],
    ["DRAFT", "not been approved"],
    ["PENDING_REVIEW", "not been approved"],
  ])("refuses to open a payment page while the invoice is %s", async (status, reason) => {
    const { svc, createCheckout } = build({ full: { ...FULL, status } });
    await expect(svc.beginCardPaymentByToken(token())).rejects.toThrow(new RegExp(reason, "i"));
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("says card payment is unavailable rather than failing obscurely", async () => {
    const { svc } = build({ configured: false });
    await expect(svc.beginCardPaymentByToken(token())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("works for an invoice Nonni's recorded as BANK_TRANSFER", async () => {
    // Nonni's expectation when raising the bill must not remove the payer's
    // choice weeks later.
    const { svc, createCheckout } = build({ full: { ...FULL, paymentMethod: "BANK_TRANSFER" } });
    await svc.beginCardPaymentByToken(token());
    expect(createCheckout).toHaveBeenCalled();
  });
});

describe("a checkout session is reused while it lives, and replaced when it dies", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resumes an open session instead of opening a second one", async () => {
    const { svc, createCheckout, retrieveCheckout } = build({
      existingSession: "cs_open_1",
      resumable: { sessionId: "cs_open_1", url: "https://checkout.stripe.test/cs_open_1" },
    });
    await expect(svc.beginCardPaymentByToken(token())).resolves.toEqual({ url: "https://checkout.stripe.test/cs_open_1" });

    expect(retrieveCheckout).toHaveBeenCalledWith("cs_open_1");
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("creates a fresh session when the stored one has expired", async () => {
    const { svc, createCheckout } = build({ existingSession: "cs_dead_1", resumable: null });
    await expect(svc.beginCardPaymentByToken(token())).resolves.toEqual({ url: "https://checkout.stripe.test/cs_new_1" });
    expect(createCheckout).toHaveBeenCalled();
  });

  it("tells the gateway which dead session it replaces, so the retry is not deduplicated onto it", async () => {
    // Stripe remembers an idempotency key for a day. Without this the
    // replacement request would hand back the very session that just expired.
    const { svc, createCheckout } = build({ existingSession: "cs_dead_1", resumable: null });
    await svc.beginCardPaymentByToken(token());
    expect(createCheckout.mock.calls[0][0].replaces).toBe("cs_dead_1");
  });

  it("records the replacement session against the invoice", async () => {
    const { svc, invoiceUpdateMany } = build({ existingSession: "cs_dead_1", resumable: null });
    await svc.beginCardPaymentByToken(token());
    expect(invoiceUpdateMany.mock.calls[0][0].data).toEqual({ stripeCheckoutSessionId: "cs_new_1" });
    expect(invoiceUpdateMany.mock.calls[0][0].where.status).toEqual({ notIn: ["PAID", "CANCELLED"] });
  });

  it("does not consult the gateway at all when no session was ever stored", async () => {
    const { svc, retrieveCheckout, createCheckout } = build({ existingSession: null });
    await svc.beginCardPaymentByToken(token());
    expect(retrieveCheckout).not.toHaveBeenCalled();
    expect(createCheckout.mock.calls[0][0].replaces).toBeNull();
  });
});

describe("the public route", () => {
  beforeEach(() => jest.clearAllMocks());

  function controller(url = "https://checkout.stripe.test/cs_new_1") {
    const begin = jest.fn().mockResolvedValue({ url });
    const res = { redirect: jest.fn(), setHeader: jest.fn() } as unknown as Response;
    return { ctrl: new InvoicePaymentsController({ beginCardPaymentByToken: begin } as unknown as InvoicesService), begin, res };
  }

  it("redirects the payer to Stripe rather than returning JSON", async () => {
    const { ctrl, res } = controller();
    await ctrl.pay("some-token", res);
    expect(res.redirect).toHaveBeenCalledWith(303, "https://checkout.stripe.test/cs_new_1");
  });

  it("passes the token through untouched — it is the only input", async () => {
    const { ctrl, begin, res } = controller();
    await ctrl.pay("a-particular-token", res);
    expect(begin).toHaveBeenCalledWith("a-particular-token");
    expect(begin).toHaveBeenCalledTimes(1);
  });

  it("forbids caching, so a shared link cannot strand a later payer", async () => {
    const { ctrl, res } = controller();
    await ctrl.pay("t", res);
    expect(res.setHeader).toHaveBeenCalledWith("cache-control", "no-store");
  });

  it("does not redirect when the invoice cannot be paid", async () => {
    const begin = jest.fn().mockRejectedValue(new BadRequestException("This invoice is already paid."));
    const res = { redirect: jest.fn(), setHeader: jest.fn() } as unknown as Response;
    const ctrl = new InvoicePaymentsController({ beginCardPaymentByToken: begin } as unknown as InvoicesService);

    await expect(ctrl.pay("t", res)).rejects.toBeInstanceOf(BadRequestException);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
