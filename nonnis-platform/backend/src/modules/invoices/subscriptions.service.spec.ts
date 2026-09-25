import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { SubscriptionsService, addMonths } from "./subscriptions.service";

const dec = (v: string) => new Prisma.Decimal(v);
const USER = { id: "user-1" } as RequestUser;
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function sub(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    providerId: "provider-a",
    productId: "product-1",
    status: "ACTIVE",
    unitPrice: dec("500.00"),
    currency: "USD",
    startDate: day("2026-09-01"),
    endDate: null,
    periodsBilled: 0,
    totalPeriods: 3,
    nextBillingDate: day("2026-09-01"),
    stripeSubscriptionId: null,
    createdAt: new Date(),
    provider: { id: "provider-a", displayName: "Sunrise" },
    product: { id: "product-1", name: "Nonni's Provider Subscription" },
    ...over,
  };
}

function build(opts: { due?: Array<Record<string, unknown>>; createThrows?: boolean; after?: Record<string, unknown> | null } = {}) {
  const invoiceCreate = opts.createThrows
    ? jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }))
    : jest.fn().mockResolvedValue({ id: "inv-new", invoiceNumber: "INV-2026-AAA111" });
  const subUpdate = jest.fn().mockResolvedValue(sub());
  const auditRecord = jest.fn().mockResolvedValue({});

  const tx = { invoice: { create: invoiceCreate }, providerSubscription: { update: subUpdate } };
  const prisma = {
    providerSubscription: {
      findMany: jest.fn().mockResolvedValue(opts.due ?? []),
      findUnique: jest.fn().mockResolvedValue("after" in opts ? opts.after : { periodsBilled: 1, totalPeriods: 3 }),
      update: subUpdate,
      create: jest.fn().mockResolvedValue(sub()),
    },
    provider: { findUnique: jest.fn().mockResolvedValue({ id: "provider-a" }) },
    product: { findUnique: jest.fn().mockResolvedValue({ id: "product-1", recurring: true }) },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;

  const svc = new SubscriptionsService(prisma, { record: auditRecord } as unknown as AuditService);
  return { svc, prisma, invoiceCreate, subUpdate, auditRecord };
}

describe("addMonths", () => {
  it("advances whole months", () => {
    expect(addMonths(day("2026-09-01"), 1).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(addMonths(day("2026-09-01"), 3).toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("clamps a rollover instead of skipping a month", () => {
    // 31 Jan + 1 month must land in February.
    expect(addMonths(day("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(day("2026-03-31"), 1).toISOString().slice(0, 10)).toBe("2026-04-30");
  });
});

describe("create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores the amount agreed with THIS provider", async () => {
    const { svc, prisma } = build();
    await svc.create(USER, { providerId: "provider-a", productId: "product-1", unitPrice: "500.00", totalPeriods: 3 });
    const data = (prisma.providerSubscription as unknown as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(data.unitPrice.toFixed(2)).toBe("500.00");
    expect(data.totalPeriods).toBe(3);
    // The first invoice covers the period starting on the start date.
    expect(data.nextBillingDate).toEqual(data.startDate);
  });

  it("computes the plan's end from its length", async () => {
    const { svc, prisma } = build();
    await svc.create(USER, { providerId: "provider-a", productId: "product-1", unitPrice: "500.00", startDate: "2026-09-01", totalPeriods: 3 });
    const data = (prisma.providerSubscription as unknown as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect((data.endDate as Date).toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("leaves an open-ended plan with no end date", async () => {
    const { svc, prisma } = build();
    await svc.create(USER, { providerId: "provider-a", productId: "product-1", unitPrice: "500.00" });
    expect((prisma.providerSubscription as unknown as { create: jest.Mock }).create.mock.calls[0][0].data.endDate).toBeNull();
  });

  it("refuses a zero amount", async () => {
    const { svc } = build();
    await expect(svc.create(USER, { providerId: "provider-a", productId: "product-1", unitPrice: "0" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a product that is not billed monthly", async () => {
    const { svc, prisma } = build();
    (prisma.product as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: "product-2", recurring: false });
    await expect(svc.create(USER, { providerId: "provider-a", productId: "product-2", unitPrice: "500.00" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s an unknown provider", async () => {
    const { svc, prisma } = build();
    (prisma.provider as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
    await expect(svc.create(USER, { providerId: "nope", productId: "product-1", unitPrice: "500.00" })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("generateDueInvoices — one invoice per period, never two", () => {
  beforeEach(() => jest.clearAllMocks());

  it("generates a DRAFT invoice for the due period", async () => {
    const { svc, invoiceCreate } = build({ due: [sub()] });
    const out = await svc.generateDueInvoices(day("2026-09-05"));

    expect(out.generated).toBe(1);
    const data = invoiceCreate.mock.calls[0][0].data;
    // A recurring invoice still has to be approved before it goes out.
    expect(data.status).toBe("DRAFT");
    expect(data.billingType).toBe("RECURRING");
    expect(data.subscriptionId).toBe("sub-1");
    expect((data.periodStart as Date).toISOString().slice(0, 10)).toBe("2026-09-01");
    expect((data.periodEnd as Date).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(data.totalAmount.toFixed(2)).toBe("500.00");
  });

  it("advances the pointer only after the invoice exists", async () => {
    const { svc, subUpdate } = build({ due: [sub()] });
    await svc.generateDueInvoices(day("2026-09-05"));
    const data = subUpdate.mock.calls[0][0].data;
    expect(data.periodsBilled).toEqual({ increment: 1 });
    expect((data.nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("skips a period that is already invoiced rather than billing twice", async () => {
    // The unique (subscriptionId, periodStart) collides; that IS the guard.
    const { svc, subUpdate } = build({ due: [sub()], createThrows: true });
    const out = await svc.generateDueInvoices(day("2026-09-05"));

    expect(out.generated).toBe(0);
    expect(out.skipped).toBe(1);
    // The pointer still moves on, so a repeat run makes progress.
    expect((subUpdate.mock.calls[0][0].data.nextBillingDate as Date).toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("is a no-op when nothing is due yet", async () => {
    const { svc, invoiceCreate } = build({ due: [] });
    const out = await svc.generateDueInvoices(day("2026-08-01"));
    expect(out).toEqual({ generated: 0, skipped: 0, completed: 0 });
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it("completes a fixed-length plan once its periods are used up", async () => {
    const { svc, invoiceCreate, subUpdate } = build({ due: [sub({ periodsBilled: 3, totalPeriods: 3 })] });
    const out = await svc.generateDueInvoices(day("2026-12-05"));

    expect(out.completed).toBe(1);
    expect(invoiceCreate).not.toHaveBeenCalled();
    expect(subUpdate.mock.calls[0][0].data.status).toBe("COMPLETED");
  });

  it("completes the plan right after generating its final period", async () => {
    const { svc, subUpdate } = build({ due: [sub({ periodsBilled: 2, totalPeriods: 3 })], after: { periodsBilled: 3, totalPeriods: 3 } });
    const out = await svc.generateDueInvoices(day("2026-11-05"));
    expect(out.generated).toBe(1);
    expect(out.completed).toBe(1);
    expect(subUpdate.mock.calls.some((c) => c[0].data.status === "COMPLETED")).toBe(true);
  });

  it("keeps an open-ended plan running past any period count", async () => {
    const { svc, subUpdate } = build({ due: [sub({ periodsBilled: 12, totalPeriods: null })], after: { periodsBilled: 13, totalPeriods: null } });
    const out = await svc.generateDueInvoices(day("2027-09-05"));
    expect(out.generated).toBe(1);
    expect(out.completed).toBe(0);
    expect(subUpdate.mock.calls.every((c) => c[0].data.status !== "COMPLETED")).toBe(true);
  });

  it("generates for several subscriptions in one run", async () => {
    const { svc, invoiceCreate } = build({ due: [sub(), sub({ id: "sub-2", providerId: "provider-b" })] });
    const out = await svc.generateDueInvoices(day("2026-09-05"));
    expect(out.generated).toBe(2);
    expect(invoiceCreate).toHaveBeenCalledTimes(2);
  });

  it("only looks at ACTIVE plans with a billing date that has arrived", async () => {
    const { svc, prisma } = build({ due: [] });
    await svc.generateDueInvoices(day("2026-09-05"));
    const where = (prisma.providerSubscription as unknown as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
    expect(where.nextBillingDate.lte).toBeInstanceOf(Date);
  });
});

describe("cancel — history is never unbilled", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stops future billing and leaves existing invoices alone", async () => {
    const { svc, prisma, subUpdate } = build();
    (prisma.providerSubscription as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: "sub-1", status: "ACTIVE" });
    await svc.cancel(USER, "sub-1");

    const data = subUpdate.mock.calls[0][0].data;
    expect(data.status).toBe("CANCELLED");
    expect(data.nextBillingDate).toBeNull();
    // Nothing touches invoices: months genuinely owed stay owed.
    expect(JSON.stringify(subUpdate.mock.calls)).not.toContain("invoice");
  });

  it("refuses a plan that has already ended", async () => {
    const { svc, prisma } = build();
    (prisma.providerSubscription as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: "sub-1", status: "COMPLETED" });
    await expect(svc.cancel(USER, "sub-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});
