import { Prisma } from "@prisma/client";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { RequestUser } from "../auth/request-user";
import { MarketplaceAccessService } from "./marketplace-access";
import { MarketplaceOrdersService } from "./orders.service";
import { MarketplaceStripeService, toMinorUnits } from "./stripe.service";

const dec = (v: string) => new Prisma.Decimal(v);

function seeker(id: string): RequestUser {
  return {
    id,
    supabaseUserId: `sb-${id}`,
    email: `${id}@example.com`,
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    caseAccess: [],
    activeOrganizationId: null,
    activePermissions: new Set(["seeker_marketplace.order"]),
  } as unknown as RequestUser;
}

const ORDER = {
  id: "order-1",
  orderNumber: "MKT-2026-000001",
  listingTitle: "Private room",
  quantity: 2,
  unitPrice: dec("600.00"),
  totalAmount: dec("1200.00"),
  currency: "USD",
  status: "ACCEPTED",
  paymentStatus: "UNPAID",
};

function build(over: { order?: Record<string, unknown> | null; updateCount?: number; found?: Record<string, unknown> | null } = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: over.updateCount ?? 1 });
  const createCheckoutSession = jest.fn().mockResolvedValue({ sessionId: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" });
  const auditRecord = jest.fn().mockResolvedValue({});
  const raise = jest.fn().mockResolvedValue(null);

  const prisma = {
    marketplaceOrder: {
      findFirst: jest.fn().mockResolvedValue("order" in over ? over.order : ORDER),
      findUnique: jest.fn().mockResolvedValue("found" in over ? over.found : null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ORDER, provider: { displayName: "Sunrise" } }),
      updateMany,
    },
  } as unknown as PrismaService;

  const notifications = {
    raise,
    raiseForUser: jest.fn().mockResolvedValue(null),
    for: {
      providerUsers: jest.fn().mockResolvedValue(["provider-user"]),
      providerOrganizationId: jest.fn().mockResolvedValue("org-a"),
    },
  } as unknown as NotificationsService;

  const stripe = { createCheckoutSession, verifyEvent: jest.fn() } as unknown as MarketplaceStripeService;
  const svc = new MarketplaceOrdersService(
    prisma,
    new MarketplaceAccessService(prisma),
    { record: auditRecord } as unknown as AuditService,
    notifications,
    { get: () => "http://localhost:3001" } as unknown as ConfigService<never, true>,
    stripe,
  );
  return { svc, prisma, updateMany, createCheckoutSession, auditRecord, raise };
}

describe("toMinorUnits — money never becomes a float", () => {
  it("converts whole and fractional amounts exactly", () => {
    expect(toMinorUnits(dec("1200.00"))).toBe(120000);
    expect(toMinorUnits(dec("0.01"))).toBe(1);
    expect(toMinorUnits(dec("19.99"))).toBe(1999);
  });

  it("survives the values binary floating point gets wrong", () => {
    // 1234.55 * 100 is 123454.99999... in IEEE-754; the Decimal path must not be.
    expect(toMinorUnits(dec("1234.55"))).toBe(123455);
    expect(toMinorUnits(dec("8.29"))).toBe(829);
    expect(toMinorUnits(dec("1.005"))).toBe(101);
  });
});

describe("createStripeCheckout — the amount comes from the server", () => {
  beforeEach(() => jest.clearAllMocks());

  it("builds the charge from the stored order, not from any client input", async () => {
    const { svc, createCheckoutSession } = build();
    await svc.createStripeCheckout(seeker("seeker-1"), "order-1");

    const [order] = createCheckoutSession.mock.calls[0];
    expect(order.unitPrice.toFixed(2)).toBe("600.00");
    expect(order.quantity).toBe(2);
    expect(order.currency).toBe("USD");
  });

  it("scopes the lookup to the caller's own order", async () => {
    const { svc, prisma } = build();
    await svc.createStripeCheckout(seeker("seeker-1"), "order-1");
    expect((prisma.marketplaceOrder as unknown as { findFirst: jest.Mock }).findFirst.mock.calls[0][0].where.seekerUserId).toBe("seeker-1");
  });

  it("404s another family's order", async () => {
    const { svc } = build({ order: null });
    await expect(svc.createStripeCheckout(seeker("seeker-2"), "order-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses an order that is already paid", async () => {
    const { svc } = build({ order: { ...ORDER, paymentStatus: "PAID" } });
    await expect(svc.createStripeCheckout(seeker("seeker-1"), "order-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses before the provider has accepted", async () => {
    const { svc } = build({ order: { ...ORDER, status: "REQUESTED" } });
    await expect(svc.createStripeCheckout(seeker("seeker-1"), "order-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("never touches inventory — that happened at acceptance", async () => {
    const { svc, updateMany } = build();
    await svc.createStripeCheckout(seeker("seeker-1"), "order-1");
    const data = updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("quantity");
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain("availableQuantity");
  });

  it("records the session against the order without marking it paid", async () => {
    const { svc, updateMany } = build();
    await svc.createStripeCheckout(seeker("seeker-1"), "order-1");
    const data = updateMany.mock.calls[0][0].data;
    expect(data.stripeCheckoutSessionId).toBe("cs_test_1");
    expect(data.paymentMethod).toBe("STRIPE");
    expect(data).not.toHaveProperty("paymentStatus");
    expect(data).not.toHaveProperty("paidAt");
  });

  it("sends the family to a page that only REPORTS status, never asserts it", async () => {
    const { svc, createCheckoutSession } = build();
    await svc.createStripeCheckout(seeker("seeker-1"), "order-1");
    const [, urls] = createCheckoutSession.mock.calls[0];
    expect(urls.successUrl).toContain("payment=processing");
    expect(urls.successUrl).not.toContain("paid");
    expect(urls.cancelUrl).toContain("payment=cancelled");
  });
});

describe("applyStripePaid — the webhook is the only authority, and it is idempotent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("settles an unpaid order exactly once", async () => {
    const { svc, updateMany } = build({ found: { id: "order-1", orderNumber: "MKT-1", paymentStatus: "UNPAID", providerId: "provider-a", listingTitle: "Room" } });
    const out = await svc.applyStripePaid({ sessionId: "cs_test_1", paymentIntentId: "pi_1", stripeStatus: "paid" });

    expect(out.applied).toBe(true);
    const data = updateMany.mock.calls[0][0].data;
    expect(data.paymentStatus).toBe("PAID");
    expect(data.stripePaymentIntentId).toBe("pi_1");
    // Nobody confirmed it by hand, so no human is recorded as having done so.
    expect(data).not.toHaveProperty("paidByUserId");
  });

  it("only transitions an order that is still UNPAID", async () => {
    const { svc, updateMany } = build({ found: { id: "order-1", orderNumber: "MKT-1", paymentStatus: "UNPAID", providerId: "provider-a", listingTitle: "Room" } });
    await svc.applyStripePaid({ sessionId: "cs_test_1", paymentIntentId: "pi_1", stripeStatus: "paid" });
    expect(updateMany.mock.calls[0][0].where.paymentStatus).toBe("UNPAID");
  });

  it("is a no-op on a duplicate delivery of the same event", async () => {
    // Stripe delivers at least once; the conditional write absorbs the repeat.
    const { svc, auditRecord, raise } = build({
      found: { id: "order-1", orderNumber: "MKT-1", paymentStatus: "PAID", providerId: "provider-a", listingTitle: "Room" },
      updateCount: 0,
    });
    const out = await svc.applyStripePaid({ sessionId: "cs_test_1", paymentIntentId: "pi_1", stripeStatus: "paid" });

    expect(out.applied).toBe(false);
    expect(auditRecord).not.toHaveBeenCalled();
    expect(raise).not.toHaveBeenCalled();
  });

  it("ignores a session that matches no order rather than guessing", async () => {
    const { svc, updateMany } = build({ found: null });
    const out = await svc.applyStripePaid({ sessionId: "cs_unknown", paymentIntentId: null, stripeStatus: "paid" });
    expect(out.applied).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("never touches inventory when settling", async () => {
    const { svc, updateMany } = build({ found: { id: "order-1", orderNumber: "MKT-1", paymentStatus: "UNPAID", providerId: "provider-a", listingTitle: "Room" } });
    await svc.applyStripePaid({ sessionId: "cs_test_1", paymentIntentId: "pi_1", stripeStatus: "paid" });
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain("availableQuantity");
  });
});

describe("applyStripeFailed — a decline leaves the order payable", () => {
  beforeEach(() => jest.clearAllMocks());

  it("annotates without changing payment status", async () => {
    const { svc, updateMany } = build();
    await svc.applyStripeFailed({ sessionId: "cs_test_1", stripeStatus: "expired" });
    const call = updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ stripePaymentStatus: "expired" });
    expect(call.where.paymentStatus).toBe("UNPAID");
  });

  it("cannot disturb an order that has already been paid", async () => {
    const { svc, updateMany } = build({ updateCount: 0 });
    const out = await svc.applyStripeFailed({ sessionId: "cs_test_1", stripeStatus: "expired" });
    expect(out.applied).toBe(false);
    expect(updateMany.mock.calls[0][0].where.paymentStatus).toBe("UNPAID");
  });
});
