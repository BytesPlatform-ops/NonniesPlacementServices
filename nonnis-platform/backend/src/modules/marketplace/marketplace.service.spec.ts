import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MarketplaceListingsService } from "./listings.service";
import { MarketplaceOrdersService } from "./orders.service";
import { MarketplaceAccessService } from "./marketplace-access";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

function providerAdmin(orgId = "org-a", id = "prov-user-a"): RequestUser {
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
    activeOrganizationId: orgId,
    activePermissions: new Set([
      PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN,
      PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN,
    ]),
  };
}

function seeker(id = "seeker-1", caseAccess: RequestUser["caseAccess"] = []): RequestUser {
  return {
    id,
    supabaseUserId: `sb-${id}`,
    email: `${id}@example.com`,
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    caseAccess,
    activeOrganizationId: null,
    activePermissions: new Set([PERMISSIONS.SEEKER_MARKETPLACE_BROWSE, PERMISSIONS.SEEKER_MARKETPLACE_ORDER]),
  };
}

const dec = (v: string) => new Prisma.Decimal(v);

const LISTING = {
  id: "listing-1",
  providerId: "provider-a",
  title: "Private room, ground floor",
  transactionType: "SALE" as const,
  price: dec("1200.00"),
  currency: "USD",
  billingPeriod: null,
  availableQuantity: 2,
  status: "PUBLISHED" as const,
};

/**
 * A prisma double whose `$transaction` runs the callback against the same
 * object, so the conditional `updateMany` calls the services rely on are
 * observable in tests exactly as they run in production.
 */
function harness(over: Record<string, unknown> = {}) {
  const listingUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const listingUpdate = jest.fn().mockResolvedValue({});
  const orderUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

  const prisma: Record<string, unknown> = {
    provider: { findFirst: jest.fn().mockResolvedValue({ id: "provider-a", organizationId: "org-a" }) },
    providerListing: {
      findFirst: jest.fn().mockResolvedValue(LISTING),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ ...LISTING, images: [], provider: { id: "provider-a", displayName: "A", city: null, state: null, phone: null }, serviceCategory: null, createdAt: new Date(), updatedAt: new Date(), description: null, listingType: "BED", depositAmount: null, addressLine1: null, city: null, state: null, postalCode: null, availableFrom: null, amenities: [], restrictions: null, publishedAt: null }),
      update: listingUpdate,
      updateMany: listingUpdateMany,
    },
    providerListingImage: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    marketplaceOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      updateMany: orderUpdateMany,
    },
    ...over,
  };
  prisma.$transaction = jest
    .fn()
    .mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(prisma),
    );

  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const typed = prisma as unknown as PrismaService;
  const access = new MarketplaceAccessService(typed);
  return {
    prisma,
    audit,
    listings: new MarketplaceListingsService(typed, access, audit),
    orders: new MarketplaceOrdersService(typed, access, audit),
    listingUpdateMany,
    listingUpdate,
    orderUpdateMany,
  };
}

const createDto = {
  title: "Private room",
  listingType: "PRIVATE_ROOM" as const,
  transactionType: "SALE" as const,
  price: "1200",
  availableQuantity: 2,
};

// ---------------------------------------------------------------------------

describe("Marketplace listings — provider ownership", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a listing against the caller's own provider, as a draft", async () => {
    const h = harness();
    await h.listings.create(providerAdmin(), createDto);

    const create = (h.prisma.providerListing as { create: jest.Mock }).create;
    expect(create.mock.calls[0][0].data).toMatchObject({ providerId: "provider-a", status: "DRAFT" });
    // The provider id comes from the membership, never from the request body.
    expect(create.mock.calls[0][0].data.providerId).toBe("provider-a");
  });

  it("refuses an organization that has no provider profile", async () => {
    const h = harness({ provider: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(h.listings.create(providerAdmin(), createDto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not let Provider B reach Provider A's listing — 404, not 403", async () => {
    // Provider B's own provider row is found, but the listing query is scoped to
    // it and matches nothing.
    const h = harness({
      provider: { findFirst: jest.fn().mockResolvedValue({ id: "provider-b", organizationId: "org-b" }) },
      providerListing: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    await expect(h.listings.getOwn(providerAdmin("org-b", "prov-user-b"), "listing-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      h.listings.update(providerAdmin("org-b", "prov-user-b"), "listing-1", { title: "hijacked" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((h.prisma.providerListing as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("rejects a rental with no billing period", async () => {
    const h = harness();
    await expect(
      h.listings.create(providerAdmin(), { ...createDto, transactionType: "RENT" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("clears the billing period when a listing becomes a sale", async () => {
    const h = harness({
      providerListing: {
        findFirst: jest.fn().mockResolvedValue({ id: "listing-1", transactionType: "RENT" }),
        update: jest.fn().mockResolvedValue({ ...LISTING, images: [], provider: { id: "provider-a", displayName: "A", city: null, state: null, phone: null }, serviceCategory: null, createdAt: new Date(), updatedAt: new Date(), description: null, listingType: "BED", depositAmount: null, addressLine1: null, city: null, state: null, postalCode: null, availableFrom: null, amenities: [], restrictions: null, publishedAt: null }),
      },
    });
    await h.listings.update(providerAdmin(), "listing-1", { transactionType: "SALE" } as never);
    expect((h.prisma.providerListing as { update: jest.Mock }).update.mock.calls[0][0].data.billingPeriod).toBeNull();
  });

  it("rejects a price of zero or below", async () => {
    const h = harness();
    await expect(h.listings.create(providerAdmin(), { ...createDto, price: "0" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("Marketplace listings — what a family can see", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only ever queries published listings with stock", async () => {
    const h = harness();
    await h.listings.browse({ page: 1, pageSize: 20 });
    const where = (h.prisma.providerListing as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
    expect(where.status).toBe("PUBLISHED");
    expect(where.availableQuantity).toEqual({ gt: 0 });
  });

  it("404s a draft listing fetched by id", async () => {
    // The status is part of the query, so a guessed draft id matches nothing.
    const h = harness({ providerListing: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(h.listings.publicDetail("listing-1")).rejects.toBeInstanceOf(NotFoundException);
    expect((h.prisma.providerListing as { findFirst: jest.Mock }).findFirst.mock.calls[0][0].where.status).toBe(
      "PUBLISHED",
    );
  });

  it("returns a published listing without the provider's private fields", async () => {
    const h = harness({
      providerListing: {
        findFirst: jest.fn().mockResolvedValue({
          ...LISTING,
          description: null,
          listingType: "BED",
          depositAmount: null,
          addressLine1: null,
          city: "Seattle",
          state: "WA",
          postalCode: null,
          availableFrom: null,
          amenities: [],
          restrictions: null,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [],
          provider: { id: "provider-a", displayName: "Sunrise", city: "Seattle", state: "WA", phone: "555" },
          serviceCategory: null,
        }),
      },
    });
    const view = await h.listings.publicDetail("listing-1");
    expect(view.provider).toEqual({ id: "provider-a", name: "Sunrise", city: "Seattle", state: "WA" });
    expect(view).not.toHaveProperty("createdByUserId");
    expect(view.price).toBe("1200.00");
  });
});

describe("Marketplace orders — placing a request", () => {
  beforeEach(() => jest.clearAllMocks());

  const orderRow = {
    id: "order-1",
    orderNumber: "MKT-2026-ABCDEF",
    listingId: "listing-1",
    providerId: "provider-a",
    seekerUserId: "seeker-1",
    caseId: null,
    transactionType: "SALE",
    listingTitle: "Private room",
    quantity: 1,
    unitPrice: dec("1200.00"),
    totalAmount: dec("1200.00"),
    currency: "USD",
    billingPeriod: null,
    requestedStartDate: null,
    requestedEndDate: null,
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
    status: "REQUESTED",
    seekerNote: null,
    declineReason: null,
    acceptedAt: null,
    declinedAt: null,
    cancelledAt: null,
    paidAt: null,
    completedAt: null,
    createdAt: new Date(),
    listing: { id: "listing-1", title: "Private room", listingType: "BED", images: [] },
    provider: { id: "provider-a", displayName: "Sunrise", city: null, state: null, phone: null },
  };

  it("creates an unpaid CASH request and does NOT touch inventory", async () => {
    const h = harness({
      marketplaceOrder: { create: jest.fn().mockResolvedValue(orderRow), updateMany: jest.fn(), findFirst: jest.fn() },
    });
    const view = await h.orders.create(seeker(), { listingId: "listing-1", quantity: 1 });

    expect(view.paymentMethod).toBe("CASH");
    expect(view.paymentStatus).toBe("UNPAID");
    expect(view.status).toBe("REQUESTED");
    // The whole point: a request reserves nothing.
    expect(h.listingUpdateMany).not.toHaveBeenCalled();
    expect(h.listingUpdate).not.toHaveBeenCalled();
  });

  it("snapshots the price so a later listing edit cannot change the order", async () => {
    const h = harness({
      marketplaceOrder: { create: jest.fn().mockResolvedValue(orderRow), updateMany: jest.fn(), findFirst: jest.fn() },
    });
    await h.orders.create(seeker(), { listingId: "listing-1", quantity: 2 });
    const data = (h.prisma.marketplaceOrder as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(data.unitPrice.toFixed(2)).toBe("1200.00");
    expect(data.totalAmount.toFixed(2)).toBe("2400.00");
    expect(data.listingTitle).toBe("Private room, ground floor");
  });

  it("refuses a sold-out listing", async () => {
    const h = harness({
      providerListing: { findFirst: jest.fn().mockResolvedValue({ ...LISTING, availableQuantity: 0 }) },
    });
    await expect(h.orders.create(seeker(), { listingId: "listing-1", quantity: 1 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("refuses a quantity larger than the stock on hand", async () => {
    const h = harness();
    await expect(h.orders.create(seeker(), { listingId: "listing-1", quantity: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("refuses a draft listing", async () => {
    const h = harness({ providerListing: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(h.orders.create(seeker(), { listingId: "listing-1", quantity: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("refuses a caseId the family does not hold — 404, never a silent drop", async () => {
    const h = harness();
    await expect(
      h.orders.create(seeker(), { listingId: "listing-1", quantity: 1, caseId: "someone-elses-case" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("attaches a case the family does hold", async () => {
    const grant = { caseId: "case-1", caseNumber: "C-1", careRecipientName: "Ann", relationship: null } as never;
    const h = harness({
      marketplaceOrder: { create: jest.fn().mockResolvedValue(orderRow), updateMany: jest.fn(), findFirst: jest.fn() },
    });
    await h.orders.create(seeker("seeker-1", [grant]), { listingId: "listing-1", quantity: 1, caseId: "case-1" });
    expect((h.prisma.marketplaceOrder as { create: jest.Mock }).create.mock.calls[0][0].data.caseId).toBe("case-1");
  });
});

describe("Marketplace orders — isolation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes a family's order list to their own user id", async () => {
    const h = harness();
    await h.orders.listOwn(seeker("seeker-1"), { page: 1, pageSize: 20 });
    expect((h.prisma.marketplaceOrder as { findMany: jest.Mock }).findMany.mock.calls[0][0].where.seekerUserId).toBe(
      "seeker-1",
    );
  });

  it("404s another family's order", async () => {
    const h = harness();
    await expect(h.orders.getOwn(seeker("seeker-2"), "order-1")).rejects.toBeInstanceOf(NotFoundException);
    expect((h.prisma.marketplaceOrder as { findFirst: jest.Mock }).findFirst.mock.calls[0][0].where.seekerUserId).toBe(
      "seeker-2",
    );
  });

  it("scopes a provider's order list to their own provider", async () => {
    const h = harness();
    await h.orders.listForProvider(providerAdmin(), { page: 1, pageSize: 20 });
    expect((h.prisma.marketplaceOrder as { findMany: jest.Mock }).findMany.mock.calls[0][0].where.providerId).toBe(
      "provider-a",
    );
  });
});

describe("Marketplace orders — inventory safety", () => {
  beforeEach(() => jest.clearAllMocks());

  const pending = {
    id: "order-1",
    status: "REQUESTED",
    quantity: 2,
    listingId: "listing-1",
    orderNumber: "MKT-2026-ABCDEF",
  };

  function acceptHarness(over: Record<string, unknown> = {}) {
    // `marketplaceOrder` is merged, not replaced: an override that only sets
    // `updateMany` must keep the default `findFirst` the service calls first.
    const { marketplaceOrder, ...rest } = over;
    return harness({
      ...rest,
      marketplaceOrder: {
        findFirst: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
        count: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        ...(marketplaceOrder as object),
      },
    });
  }

  it("decrements the listing by exactly the ordered quantity, conditionally", async () => {
    const h = acceptHarness();
    await h.orders.accept(providerAdmin(), "order-1").catch(() => undefined);

    const call = h.listingUpdateMany.mock.calls[0][0];
    // The guard that makes this safe: the database refuses the update unless
    // there is still enough stock, so it can never go negative.
    expect(call.where).toMatchObject({ id: "listing-1", providerId: "provider-a", availableQuantity: { gte: 2 } });
    expect(call.data).toEqual({ availableQuantity: { decrement: 2 } });
  });

  it("moves the order only from REQUESTED, so a double-click cannot decrement twice", async () => {
    const h = acceptHarness();
    await h.orders.accept(providerAdmin(), "order-1").catch(() => undefined);
    const orderCall = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    expect(orderCall.where).toMatchObject({ id: "order-1", providerId: "provider-a", status: "REQUESTED" });
  });

  it("refuses acceptance when stock has run out in the meantime", async () => {
    const h = acceptHarness({});
    h.listingUpdateMany.mockResolvedValue({ count: 0 });
    await expect(h.orders.accept(providerAdmin(), "order-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("loses the race safely when another acceptance got there first", async () => {
    // The stock update succeeded but the order had already moved: throwing
    // rolls the whole transaction back, so the decrement is not stranded.
    const h = acceptHarness({ marketplaceOrder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } });
    await expect(h.orders.accept(providerAdmin(), "order-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses to accept an order that is not pending", async () => {
    const h = acceptHarness({ marketplaceOrder: { findFirst: jest.fn().mockResolvedValue({ ...pending, status: "ACCEPTED" }) } });
    await expect(h.orders.accept(providerAdmin(), "order-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(h.listingUpdateMany).not.toHaveBeenCalled();
  });

  it("404s an order belonging to another provider before any stock moves", async () => {
    const h = acceptHarness({ marketplaceOrder: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(h.orders.accept(providerAdmin("org-b", "prov-user-b"), "order-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(h.listingUpdateMany).not.toHaveBeenCalled();
  });

  it("takes no stock when the provider declines", async () => {
    const h = harness();
    await h.orders.decline(providerAdmin(), "order-1", {}).catch(() => undefined);
    expect(h.listingUpdateMany).not.toHaveBeenCalled();
    expect(h.listingUpdate).not.toHaveBeenCalled();
  });

  it("restores stock exactly once when an accepted order is cancelled", async () => {
    const h = harness({
      marketplaceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "order-1",
          status: "ACCEPTED",
          quantity: 2,
          listingId: "listing-1",
          paymentStatus: "UNPAID",
          quantityReleasedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
    await h.orders.cancelAccepted(providerAdmin(), "order-1", {}).catch(() => undefined);

    const guard = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    // The release is stamped in the same conditional write that reads it, so a
    // repeat cannot restore the quantity a second time.
    expect(guard.where).toMatchObject({ status: "ACCEPTED", quantityReleasedAt: null });
    expect(guard.data.quantityReleasedAt).toBeInstanceOf(Date);
    expect(h.listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { availableQuantity: { increment: 2 } },
    });
  });

  it("does not restore stock twice when the release was already stamped", async () => {
    const h = harness({
      marketplaceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "order-1",
          status: "ACCEPTED",
          quantity: 2,
          listingId: "listing-1",
          paymentStatus: "UNPAID",
          quantityReleasedAt: new Date(),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
    await expect(h.orders.cancelAccepted(providerAdmin(), "order-1", {})).rejects.toBeInstanceOf(ConflictException);
    expect(h.listingUpdate).not.toHaveBeenCalled();
  });

  it("refuses to cancel a paid order", async () => {
    const h = harness({
      marketplaceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "order-1",
          status: "ACCEPTED",
          quantity: 1,
          listingId: "listing-1",
          paymentStatus: "PAID",
          quantityReleasedAt: null,
        }),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
    await expect(h.orders.cancelAccepted(providerAdmin(), "order-1", {})).rejects.toBeInstanceOf(BadRequestException);
    expect(h.listingUpdate).not.toHaveBeenCalled();
  });

  it("lets a family withdraw only a request the provider has not answered", async () => {
    const h = harness({
      marketplaceOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "order-1", status: "ACCEPTED" }),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
    await expect(h.orders.cancelOwn(seeker(), "order-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(h.listingUpdate).not.toHaveBeenCalled();
  });
});

describe("Marketplace orders — recording the cash payment", () => {
  beforeEach(() => jest.clearAllMocks());

  function paidHarness(count = 1) {
    return harness({
      marketplaceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "order-1",
          orderNumber: "MKT-2026-ABCDEF",
          listingId: "listing-1",
          listingTitle: "Private room",
          providerId: "provider-a",
          seekerUserId: "seeker-1",
          caseId: null,
          transactionType: "SALE",
          quantity: 1,
          unitPrice: dec("1200.00"),
          totalAmount: dec("1200.00"),
          currency: "USD",
          billingPeriod: null,
          requestedStartDate: null,
          requestedEndDate: null,
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          status: "ACCEPTED",
          seekerNote: null,
          declineReason: null,
          acceptedAt: new Date(),
          declinedAt: null,
          cancelledAt: null,
          paidAt: new Date(),
          completedAt: null,
          createdAt: new Date(),
          listing: { id: "listing-1", title: "Private room", listingType: "BED", images: [] },
          provider: { id: "provider-a", displayName: "Sunrise", city: null, state: null, phone: null },
        }),
        findFirst: jest.fn().mockResolvedValue({ id: "order-1" }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
  }

  it("records the payment against the provider's own order and names the actor", async () => {
    const h = paidHarness();
    const view = await h.orders.markCashReceived(providerAdmin(), "order-1");

    const call = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: "order-1", providerId: "provider-a", paymentStatus: "UNPAID" });
    expect(call.data).toMatchObject({ paymentStatus: "PAID", paidByUserId: "prov-user-a" });
    expect(view.paymentStatus).toBe("PAID");
  });

  it("cannot be applied twice, because it only matches an UNPAID order", async () => {
    const h = paidHarness(0);
    await expect(h.orders.markCashReceived(providerAdmin(), "order-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is scoped away from another provider's order", async () => {
    const h = paidHarness(0);
    (h.prisma.marketplaceOrder as { findFirst: jest.Mock }).findFirst.mockResolvedValue(null);
    await expect(h.orders.markCashReceived(providerAdmin("org-b", "prov-user-b"), "order-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lets an authorized platform user record it without a provider scope", async () => {
    const h = paidHarness();
    await h.orders.markCashReceived(providerAdmin(), "order-1", true);
    const call = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0];
    expect(call.where.providerId).toBeUndefined();
  });

  it("never records card or instrument detail in the audit metadata", async () => {
    const h = paidHarness();
    await h.orders.markCashReceived(providerAdmin(), "order-1");
    const metadata = (h.audit.record as jest.Mock).mock.calls.at(-1)![0].metadata;
    expect(metadata).toEqual({ method: "CASH", amount: "1200.00", currency: "USD", byAdmin: false });
  });
});

describe("Marketplace orders — fulfilment guards", () => {
  beforeEach(() => jest.clearAllMocks());

  function moveHarness(count: number) {
    return harness({
      marketplaceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        findFirst: jest.fn().mockResolvedValue({ id: "order-1" }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });
  }

  it("completes only an accepted or active order that has been paid", async () => {
    const h = moveHarness(1);
    await h.orders.complete(providerAdmin(), "order-1").catch(() => undefined);
    const where = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ providerId: "provider-a", status: { in: ["ACCEPTED", "ACTIVE"] }, paymentStatus: "PAID" });
  });

  it("refuses to complete an unpaid or already-declined order", async () => {
    const h = moveHarness(0);
    await expect(h.orders.complete(providerAdmin(), "order-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("starts a rental only when it is accepted, paid and actually a rental", async () => {
    const h = moveHarness(1);
    await h.orders.startRental(providerAdmin(), "order-1").catch(() => undefined);
    const where = (h.prisma.marketplaceOrder as { updateMany: jest.Mock }).updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "ACCEPTED", transactionType: "RENT", paymentStatus: "PAID" });
  });
});
