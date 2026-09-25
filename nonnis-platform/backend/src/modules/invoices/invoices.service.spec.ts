import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";
import type { InvoiceEmailService } from "./invoice-email.service";
import type { PaymentGateway } from "./payment-gateway";
import type { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService, generateInvoiceNumber } from "./invoices.service";

const dec = (v: string) => new Prisma.Decimal(v);

function actor(permissions: string[], organizationId: string | null = "org-a"): RequestUser {
  return {
    id: "user-1",
    email: "admin@example.com",
    activeOrganizationId: organizationId,
    activePermissions: new Set(permissions),
  } as unknown as RequestUser;
}

const INVOICE_ROW = {
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

function build(over: { invoice?: Record<string, unknown> | null; provider?: unknown; findFirst?: Record<string, unknown> | null } = {}) {
  const paymentCreate = jest.fn().mockResolvedValue({});
  const eventCreate = jest.fn().mockResolvedValue({});
  const invoiceUpdate = jest.fn().mockResolvedValue(INVOICE_ROW);
  const auditRecord = jest.fn().mockResolvedValue({});

  const tx = {
    invoice: { update: invoiceUpdate, updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(INVOICE_ROW) },
    invoiceItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    invoicePayment: { create: paymentCreate },
    invoiceEvent: { create: eventCreate },
  };
  const prisma = {
    invoice: {
      findUnique: jest.fn().mockImplementation((args: { include?: unknown }) =>
        // get() asks for the full row; the transition helper asks for a slim one.
        Promise.resolve(args?.include ? { ...INVOICE_ROW, ...(("invoice" in over ? over.invoice : null) ?? {}) } : "invoice" in over ? over.invoice : INVOICE_ROW),
      ),
      findFirst: jest.fn().mockResolvedValue("findFirst" in over ? over.findFirst : INVOICE_ROW),
      create: jest.fn().mockResolvedValue(INVOICE_ROW),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    provider: { findUnique: jest.fn().mockResolvedValue("provider" in over ? over.provider : { id: "provider-a" }) },
    // markSent records whether the courtesy email went, outside the transition.
    invoiceEvent: { create: eventCreate },
    $transaction: jest.fn().mockImplementation((arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.resolve([[], 0]))),
  } as unknown as PrismaService;

  const emailSend = jest.fn().mockResolvedValue({ sent: true });
  const email = { send: emailSend } as unknown as InvoiceEmailService;
  const gateway = {
    name: "test",
    configured: true,
    configurationError: null,
    webhooksConfigured: true,
    createCheckout: jest.fn().mockResolvedValue({ sessionId: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" }),
    createSubscription: jest.fn(),
    verifyEvent: jest.fn(),
  } as unknown as PaymentGateway;
  const config = { get: () => "http://localhost:3001" } as unknown as ConstructorParameters<typeof InvoicesService>[3];
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
  const svc = new InvoicesService(prisma, { record: auditRecord } as unknown as AuditService, email, config, gateway, notifications);
  return { svc, notificationsRaise, prisma, paymentCreate, eventCreate, invoiceUpdate, auditRecord, tx, emailSend, gateway };
}

describe("generateInvoiceNumber", () => {
  it("is year-stamped and human-readable", () => {
    expect(generateInvoiceNumber(new Date("2026-05-05T00:00:00Z"))).toMatch(/^INV-2026-[0-9A-F]{6}$/);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateInvoiceNumber()));
    expect(seen.size).toBe(200);
  });
});

describe("create — the server decides every number", () => {
  beforeEach(() => jest.clearAllMocks());

  it("computes line totals and the grand total from the items", async () => {
    const { svc, prisma } = build();
    await svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), {
      providerId: "provider-a",
      items: [
        { name: "Placement fee", quantity: "2", unitPrice: "2000.00" },
        { name: "Setup", quantity: "1", unitPrice: "349.99" },
      ],
    });
    const data = (prisma.invoice as unknown as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(data.subtotal.toFixed(2)).toBe("4349.99");
    expect(data.totalAmount.toFixed(2)).toBe("4349.99");
    expect(data.items.create.map((i: { lineTotal: Prisma.Decimal }) => i.lineTotal.toFixed(2))).toEqual(["4000.00", "349.99"]);
  });

  it("applies tax to the subtotal", async () => {
    const { svc, prisma } = build();
    await svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), {
      providerId: "provider-a",
      taxRate: "0.0825",
      items: [{ name: "Fee", quantity: "1", unitPrice: "100.00" }],
    });
    const data = (prisma.invoice as unknown as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(data.taxAmount.toFixed(2)).toBe("8.25");
    expect(data.totalAmount.toFixed(2)).toBe("108.25");
  });

  it("starts as a DRAFT that owes nothing yet", async () => {
    const { svc, prisma } = build();
    await svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), { providerId: "provider-a", items: [{ name: "Fee", quantity: "1", unitPrice: "10.00" }] });
    expect((prisma.invoice as unknown as { create: jest.Mock }).create.mock.calls[0][0].data.status).toBe("DRAFT");
  });

  it("computes the end of a fixed-length recurring plan, which Stripe cannot", async () => {
    const { svc, prisma } = build();
    await svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), {
      providerId: "provider-a",
      billingType: "RECURRING",
      recurringInterval: "MONTHLY",
      recurringPeriods: 2,
      recurringStartAt: "2026-01-01T00:00:00Z",
      items: [{ name: "Monthly fee", quantity: "1", unitPrice: "2000.00" }],
    });
    const data = (prisma.invoice as unknown as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(data.recurringPeriods).toBe(2);
    expect((data.recurringEndsAt as Date).toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("refuses a recurring invoice with no billing periods", async () => {
    const { svc } = build();
    await expect(
      svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), {
        providerId: "provider-a",
        billingType: "RECURRING",
        items: [{ name: "Fee", quantity: "1", unitPrice: "10.00" }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an invoice with no lines", async () => {
    const { svc } = build();
    await expect(svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), { providerId: "provider-a", items: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s an unknown provider", async () => {
    const { svc } = build({ provider: null });
    await expect(
      svc.create(actor([PERMISSIONS.INVOICES_MANAGE]), { providerId: "provider-x", items: [{ name: "Fee", quantity: "1", unitPrice: "10.00" }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("update — only drafts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("edits a draft", async () => {
    const { svc } = build({ invoice: { id: "inv-1", status: "DRAFT", issueDate: new Date() } });
    await expect(svc.update(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1", { items: [{ name: "Fee", quantity: "1", unitPrice: "5.00" }] })).resolves.toBeDefined();
  });

  it("refuses to rewrite an invoice the provider already holds a copy of", async () => {
    const { svc } = build({ invoice: { id: "inv-1", status: "SENT", issueDate: new Date() } });
    await expect(svc.update(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1", { notes: "changed" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("reportOfflinePayment — a claim, never a settlement", () => {
  beforeEach(() => jest.clearAllMocks());

  it("moves the invoice to REQUIRES_VERIFICATION and records NO payment", async () => {
    const { svc, invoiceUpdate, paymentCreate } = build({ findFirst: { id: "inv-1", status: "SENT", invoiceNumber: "INV-1" } });
    await svc.reportOfflinePayment(actor([PERMISSIONS.INVOICES_READ_OWN]), "inv-1", { reference: "Z-991" });

    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe("REQUIRES_VERIFICATION");
    // Money is only recorded from evidence; a message is not evidence.
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("404s another provider's invoice", async () => {
    const { svc } = build({ findFirst: null });
    await expect(svc.reportOfflinePayment(actor([PERMISSIONS.INVOICES_READ_OWN]), "inv-1", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses when the caller has no provider organization selected", async () => {
    const { svc } = build();
    await expect(svc.reportOfflinePayment(actor([PERMISSIONS.INVOICES_READ_OWN], null), "inv-1", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses on an already paid invoice", async () => {
    const { svc } = build({ findFirst: { id: "inv-1", status: "PAID", invoiceNumber: "INV-1" } });
    await expect(svc.reportOfflinePayment(actor([PERMISSIONS.INVOICES_READ_OWN]), "inv-1", {})).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("verifyOfflinePayment — the only way offline money settles an invoice", () => {
  beforeEach(() => jest.clearAllMocks());

  const unpaid = { id: "inv-1", status: "REQUIRES_VERIFICATION", invoiceNumber: "INV-1", totalAmount: dec("4000.00"), amountPaid: dec("0.00"), paymentMethod: "BANK_TRANSFER" };

  it("requires its own permission, which INVOICES_MANAGE does not grant", async () => {
    // Issuing a bill and asserting money arrived are different levels of trust.
    const { svc } = build({ invoice: unpaid });
    await expect(svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("records the payment, who verified it, and settles the invoice", async () => {
    const { svc, paymentCreate, invoiceUpdate } = build({ invoice: unpaid });
    await svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_VERIFY_PAYMENT]), "inv-1", { reference: "Z-991" });

    const payment = paymentCreate.mock.calls[0][0].data;
    expect(payment.amount.toFixed(2)).toBe("4000.00");
    expect(payment.verifiedByUserId).toBe("user-1");
    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe("PAID");
  });

  it("leaves a partial payment PENDING_PAYMENT rather than calling it settled", async () => {
    const { svc, invoiceUpdate } = build({ invoice: unpaid });
    await svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_VERIFY_PAYMENT]), "inv-1", { amount: "1500.00" });
    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe("PENDING_PAYMENT");
    expect(invoiceUpdate.mock.calls[0][0].data.amountPaid.toFixed(2)).toBe("1500.00");
  });

  it("refuses a cancelled invoice", async () => {
    const { svc } = build({ invoice: { ...unpaid, status: "CANCELLED" } });
    await expect(svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_VERIFY_PAYMENT]), "inv-1", {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a zero or negative amount", async () => {
    const { svc } = build({ invoice: unpaid });
    await expect(svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_VERIFY_PAYMENT]), "inv-1", { amount: "0" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("writes an audit entry naming the amount and method", async () => {
    const { svc, auditRecord } = build({ invoice: unpaid });
    await svc.verifyOfflinePayment(actor([PERMISSIONS.INVOICES_VERIFY_PAYMENT]), "inv-1", {});
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invoice.payment_verified", metadata: expect.objectContaining({ amount: "4000.00", method: "BANK_TRANSFER" }) }),
    );
  });
});

describe("approval — an unapproved amount must never reach a provider", () => {
  beforeEach(() => jest.clearAllMocks());

  const at = (status: string) => ({ invoice: { id: "inv-1", status, invoiceNumber: "INV-1" } });

  it("refuses to send a DRAFT", async () => {
    const { svc } = build(at("DRAFT"));
    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to send an invoice merely submitted for review", async () => {
    const { svc } = build(at("PENDING_REVIEW"));
    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sends once APPROVED", async () => {
    const { svc } = build(at("APPROVED"));
    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).resolves.toBeDefined();
  });

  it("requires its own permission to approve — INVOICES_MANAGE is not enough", async () => {
    // Writing a figure and standing behind it are separate acts.
    const { svc } = build(at("PENDING_REVIEW"));
    await expect(svc.approve(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("records who approved it and when", async () => {
    const { svc, tx } = build(at("PENDING_REVIEW"));
    await svc.approve(actor([PERMISSIONS.INVOICES_APPROVE]), "inv-1");
    const data = tx.invoice.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("APPROVED");
    expect(data.approvedByUserId).toBe("user-1");
    expect(data.approvedAt).toBeInstanceOf(Date);
  });

  it("writes an audit event naming the transition", async () => {
    const { svc, eventCreate } = build(at("PENDING_REVIEW"));
    await svc.approve(actor([PERMISSIONS.INVOICES_APPROVE]), "inv-1");
    expect(eventCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ type: "approved", fromStatus: "PENDING_REVIEW", toStatus: "APPROVED", actorUserId: "user-1" }),
    );
  });

  it("cannot approve an invoice that was already sent", async () => {
    const { svc } = build(at("SENT"));
    await expect(svc.approve(actor([PERMISSIONS.INVOICES_APPROVE]), "inv-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stops allowing edits once the amount is approved", async () => {
    // A figure that can still change afterwards was never approved.
    const { svc } = build({ invoice: { id: "inv-1", status: "APPROVED", issueDate: new Date() } });
    await expect(svc.update(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1", { notes: "x" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("still allows editing while it is only submitted for review", async () => {
    const { svc } = build({ invoice: { id: "inv-1", status: "PENDING_REVIEW", issueDate: new Date() } });
    await expect(svc.update(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1", { notes: "x" })).resolves.toBeDefined();
  });

  it("can cancel from any live state, including after approval", async () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "REQUIRES_VERIFICATION"]) {
      const { svc } = build(at(status));
      await expect(svc.cancel(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).resolves.toBeDefined();
    }
  });
});

describe("a provider sees only what Nonni's actually sent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("narrows the list to invoices that have been sent", async () => {
    const { svc, prisma } = build();
    await svc.listOwn(actor([PERMISSIONS.INVOICES_READ_OWN]), { page: 1, pageSize: 20 } as never);

    const where = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.sentAt).toEqual({ not: null });
    expect(where.providerId).toBe("provider-a");
  });

  it("404s an invoice that exists but has never been sent", async () => {
    // A draft's amount can still change, and an approved-but-unsent invoice is
    // a decision Nonni's has not yet acted on. Neither is the provider's to see.
    const { svc, prisma } = build({ findFirst: null });
    await expect(svc.getOwn(actor([PERMISSIONS.INVOICES_READ_OWN]), "inv-1")).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma.invoice.findFirst as jest.Mock).mock.calls[0][0].where.sentAt).toEqual({ not: null });
  });

  it("leaves the admin list unnarrowed — Nonni's sees its own drafts", async () => {
    const { svc, prisma } = build();
    await svc.list(actor([PERMISSIONS.INVOICES_READ]), { page: 1, pageSize: 20 } as never);
    expect((prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where.sentAt).toBeUndefined();
  });

  it("does not let a request widen the scope back out", async () => {
    // The scope is applied first and a query cannot overwrite it with a status
    // filter, so no crafted request reaches an unsent invoice.
    const { svc, prisma } = build();
    await svc.listOwn(actor([PERMISSIONS.INVOICES_READ_OWN]), { page: 1, pageSize: 20, status: "DRAFT" } as never);
    const where = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.sentAt).toEqual({ not: null });
  });
});

describe("sending an invoice delivers it to the provider's portal", () => {
  beforeEach(() => jest.clearAllMocks());

  const approved = { invoice: { ...INVOICE_ROW, status: "APPROVED" }, findFirst: { id: "inv-1", status: "APPROVED", invoiceNumber: "INV-1" } };

  it("moves the invoice to SENT so the provider can see it", async () => {
    const { svc, tx } = build(approved);
    await svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1");

    const data = tx.invoice.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.sentAt).toBeInstanceOf(Date);
  });

  it("tells the provider in the product, not only by email", async () => {
    const { svc, notificationsRaise } = build(approved);
    await svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1");

    const raised = notificationsRaise.mock.calls[0][0];
    expect(raised.type).toBe("invoice.sent");
    expect(raised.recipientUserIds).toEqual(["provider-user-1"]);
    expect(raised.route).toBe("/provider/invoices/inv-1");
    expect(raised.entityId).toBe("inv-1");
  });

  it("delivers even when the email cannot be sent at all", async () => {
    // Both sides are on this platform. A mail provider being down, or a
    // provider having no address on file, must not stop Nonni's billing them.
    const { svc, emailSend, tx } = build(approved);
    emailSend.mockRejectedValue(new Error("No sending address is configured"));

    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).resolves.toBeDefined();
    expect(tx.invoice.updateMany.mock.calls[0][0].data.status).toBe("SENT");
  });

  it("still notifies the provider when the email fails", async () => {
    const { svc, emailSend, notificationsRaise } = build(approved);
    emailSend.mockResolvedValue({ sent: false, reason: "Recipient rejected." });

    await svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1");
    expect(notificationsRaise).toHaveBeenCalled();
  });

  it("records in the invoice's own history whether the email went", async () => {
    // Nobody should have to wonder afterwards.
    const { svc, emailSend, eventCreate } = build(approved);
    emailSend.mockResolvedValue({ sent: false, reason: "Recipient rejected." });
    await svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1");

    const failure = eventCreate.mock.calls.map((c) => c[0].data).find((d) => d.type === "email_failed");
    expect(failure).toBeDefined();
    expect(failure.message).toMatch(/still see and pay this invoice in their portal/i);
  });

  it("records a successful email too", async () => {
    const { svc, eventCreate } = build(approved);
    await svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1");
    expect(eventCreate.mock.calls.map((c) => c[0].data.type)).toContain("email_sent");
  });

  it("delivers even when the provider has nobody to notify", async () => {
    const { svc, notificationsRaise, tx } = build(approved);
    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).resolves.toBeDefined();
    expect(tx.invoice.updateMany.mock.calls[0][0].data.status).toBe("SENT");
    expect(notificationsRaise).toHaveBeenCalled();
  });

  it("refuses to send an invoice whose amount nobody approved", async () => {
    const { svc, tx } = build({ invoice: { ...INVOICE_ROW, status: "DRAFT" } });
    await expect(svc.markSent(actor([PERMISSIONS.INVOICES_MANAGE]), "inv-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });
});
