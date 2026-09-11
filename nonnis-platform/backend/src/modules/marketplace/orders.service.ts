import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { MarketplaceAccessService, generateOrderNumber } from "./marketplace-access";
import { orderInclude, toOrderView, type OrderView } from "./marketplace.serializer";
import type { CreateOrderDto, DeclineOrderDto, OrdersQueryDto } from "./dto/marketplace.dto";

/**
 * Marketplace orders: a family's request to buy or rent a listing, and the
 * provider's handling of it.
 *
 * Two rules govern everything here.
 *
 * 1. INVENTORY IS TAKEN ON ACCEPTANCE, NOT ON REQUEST. A request costs the
 *    provider nothing and blocks nobody; several families may request the same
 *    last bed. The provider accepting one of them is what consumes it.
 *
 * 2. EVERY STATE CHANGE IS A CONDITIONAL WRITE. Each transition is expressed as
 *    an `updateMany` whose WHERE restates the state it is allowed to move from,
 *    and the affected-row count is checked. Two providers clicking Accept at the
 *    same instant therefore cannot both succeed: the second matches zero rows.
 *    This is what keeps the last unit from being sold twice, and it is why the
 *    quantity decrement is a conditional `gte` rather than a read-then-write.
 */
@Injectable()
export class MarketplaceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MarketplaceAccessService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Family side
  // -------------------------------------------------------------------------

  async create(user: RequestUser, dto: CreateOrderDto): Promise<OrderView> {
    // Only a published listing can be ordered, and only while it has stock.
    const listing = await this.prisma.providerListing.findFirst({
      where: { id: dto.listingId, status: "PUBLISHED" },
      select: {
        id: true,
        providerId: true,
        title: true,
        transactionType: true,
        price: true,
        currency: true,
        billingPeriod: true,
        availableQuantity: true,
      },
    });
    if (!listing) throw new NotFoundException(`Listing ${dto.listingId} not found`);
    if (listing.availableQuantity <= 0) {
      throw new ConflictException("This listing is sold out.");
    }
    if (dto.quantity > listing.availableQuantity) {
      throw new BadRequestException(
        `Only ${listing.availableQuantity} available. Please reduce the quantity.`,
      );
    }

    const caseId = this.access.requireOwnCase(user, dto.caseId);
    const start = dto.requestedStartDate ? new Date(dto.requestedStartDate) : null;
    const end = dto.requestedEndDate ? new Date(dto.requestedEndDate) : null;
    if (start && end && end < start) {
      throw new BadRequestException("The end date cannot be before the start date.");
    }

    // The commercial terms are copied, not referenced: editing the listing
    // afterwards must never change what was requested. This snapshot is also
    // everything a future invoice needs.
    const unitPrice = listing.price;
    const totalAmount = unitPrice.mul(dto.quantity);

    const row = await this.prisma.marketplaceOrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        listingId: listing.id,
        providerId: listing.providerId,
        seekerUserId: user.id,
        caseId,
        transactionType: listing.transactionType,
        listingTitle: listing.title,
        quantity: dto.quantity,
        unitPrice,
        totalAmount,
        currency: listing.currency,
        billingPeriod: listing.billingPeriod,
        requestedStartDate: start,
        requestedEndDate: end,
        paymentMethod: "CASH",
        paymentStatus: "UNPAID",
        status: "REQUESTED",
        seekerNote: dto.note?.trim() || null,
      },
      include: orderInclude,
    });

    await this.audit.record({
      action: "marketplace_order.requested",
      entityType: "MarketplaceOrder",
      entityId: row.id,
      actorUserId: user.id,
      metadata: { orderNumber: row.orderNumber, listingId: listing.id, quantity: dto.quantity },
    });
    return toOrderView(row);
  }

  async listOwn(user: RequestUser, query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    return this.page({ seekerUserId: user.id, ...(query.status ? { status: query.status as never } : {}) }, query);
  }

  async getOwn(user: RequestUser, id: string): Promise<OrderView> {
    const row = await this.prisma.marketplaceOrder.findFirst({
      where: { id, seekerUserId: user.id },
      include: orderInclude,
    });
    // Another family's order is "not found" — the same rule the case surface
    // follows, so an id cannot be probed to learn that an order exists.
    if (!row) throw new NotFoundException(`Order ${id} not found`);
    return toOrderView(row);
  }

  /**
   * A family may withdraw a request the provider has not answered yet.
   *
   * Only from REQUESTED. An accepted order has already consumed inventory and
   * an arrangement has been made with the provider; a paid or completed one has
   * money behind it. Those need the provider, and are refused here rather than
   * quietly reversed.
   */
  async cancelOwn(user: RequestUser, id: string): Promise<OrderView> {
    const existing = await this.prisma.marketplaceOrder.findFirst({
      where: { id, seekerUserId: user.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);
    if (existing.status !== "REQUESTED") {
      throw new BadRequestException(
        "This request has already been answered by the provider. Please contact the provider or Nonnis for help.",
      );
    }

    const updated = await this.prisma.marketplaceOrder.updateMany({
      where: { id: existing.id, seekerUserId: user.id, status: "REQUESTED" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException("This request has just been answered by the provider.");
    }

    await this.audit.record({
      action: "marketplace_order.cancelled",
      entityType: "MarketplaceOrder",
      entityId: existing.id,
      actorUserId: user.id,
      metadata: { by: "seeker" },
    });
    return this.getOwn(user, existing.id);
  }

  // -------------------------------------------------------------------------
  // Provider side
  // -------------------------------------------------------------------------

  async listForProvider(user: RequestUser, query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    const provider = await this.access.requireOwnProvider(user);
    return this.page(
      {
        providerId: provider.id,
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.unpaidOnly ? { paymentStatus: "UNPAID" } : {}),
      },
      query,
    );
  }

  async getForProvider(user: RequestUser, id: string): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const row = await this.prisma.marketplaceOrder.findFirst({
      where: { id, providerId: provider.id },
      include: orderInclude,
    });
    if (!row) throw new NotFoundException(`Order ${id} not found`);
    return toOrderView(row);
  }

  /**
   * Accept a request and take the stock for it, in one transaction.
   *
   * The decrement is a conditional `updateMany` — `availableQuantity >= quantity`
   * lives in the WHERE, so the database itself refuses to go negative and two
   * simultaneous acceptances of the last unit cannot both match. The order
   * transition is conditional on REQUESTED for the same reason, which also makes
   * a double-click harmless rather than a double decrement.
   */
  async accept(user: RequestUser, id: string): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id, providerId: provider.id },
      select: { id: true, status: true, quantity: true, listingId: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status !== "REQUESTED") {
      throw new BadRequestException("Only a pending request can be accepted.");
    }

    await this.prisma.$transaction(async (tx) => {
      const stock = await tx.providerListing.updateMany({
        where: { id: order.listingId, providerId: provider.id, availableQuantity: { gte: order.quantity } },
        data: { availableQuantity: { decrement: order.quantity } },
      });
      if (stock.count !== 1) {
        throw new ConflictException(
          "There is no longer enough availability on this listing to accept this request.",
        );
      }

      const moved = await tx.marketplaceOrder.updateMany({
        where: { id: order.id, providerId: provider.id, status: "REQUESTED" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      // Losing this race rolls the decrement back with the transaction, so the
      // stock taken above is never stranded.
      if (moved.count !== 1) {
        throw new ConflictException("This request has already been answered.");
      }

      await this.audit.record(
        {
          action: "marketplace_order.accepted",
          entityType: "MarketplaceOrder",
          entityId: order.id,
          organizationId: provider.organizationId,
          actorUserId: user.id,
          metadata: { orderNumber: order.orderNumber, quantity: order.quantity },
        },
        tx,
      );
    });

    return this.getForProvider(user, order.id);
  }

  /** Declining answers the request and takes no stock. */
  async decline(user: RequestUser, id: string, dto: DeclineOrderDto): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const moved = await this.prisma.marketplaceOrder.updateMany({
      where: { id, providerId: provider.id, status: "REQUESTED" },
      data: { status: "DECLINED", declinedAt: new Date(), declineReason: dto.reason?.trim() || null },
    });
    if (moved.count !== 1) {
      await this.assertExists(id, provider.id);
      throw new BadRequestException("Only a pending request can be declined.");
    }

    await this.audit.record({
      action: "marketplace_order.declined",
      entityType: "MarketplaceOrder",
      entityId: id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
      metadata: { hasReason: Boolean(dto.reason) },
    });
    return this.getForProvider(user, id);
  }

  /**
   * Record that the offline payment was received.
   *
   * Never reachable by the buyer: this endpoint holds a provider/admin
   * permission, and the actor is recorded so "who said the cash arrived" is
   * answerable later. The amount is not re-entered — the order's own snapshot
   * is the agreed figure.
   */
  async markCashReceived(user: RequestUser, id: string, asAdmin = false): Promise<OrderView> {
    const provider = asAdmin ? null : await this.access.requireOwnProvider(user);
    const where: Prisma.MarketplaceOrderWhereInput = {
      id,
      ...(provider ? { providerId: provider.id } : {}),
      status: { in: ["ACCEPTED", "ACTIVE"] },
      paymentStatus: "UNPAID",
    };

    const paid = await this.prisma.marketplaceOrder.updateMany({
      where,
      data: { paymentStatus: "PAID", paidAt: new Date(), paidByUserId: user.id },
    });
    if (paid.count !== 1) {
      await this.assertExists(id, provider?.id);
      throw new BadRequestException("Only an accepted, unpaid order can be marked as paid.");
    }

    const row = await this.prisma.marketplaceOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
    await this.audit.record({
      action: "marketplace_order.payment_recorded",
      entityType: "MarketplaceOrder",
      entityId: id,
      actorUserId: user.id,
      // The agreed total, not payment instrument detail — there is none to hold.
      metadata: { method: "CASH", amount: row.totalAmount.toFixed(2), currency: row.currency, byAdmin: asAdmin },
    });
    return toOrderView(row);
  }

  /** Start a paid rental. Sales go straight to completion instead. */
  async startRental(user: RequestUser, id: string): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const moved = await this.prisma.marketplaceOrder.updateMany({
      where: { id, providerId: provider.id, status: "ACCEPTED", transactionType: "RENT", paymentStatus: "PAID" },
      data: { status: "ACTIVE" },
    });
    if (moved.count !== 1) {
      await this.assertExists(id, provider.id);
      throw new BadRequestException("A rental can start once it has been accepted and paid.");
    }
    await this.audit.record({
      action: "marketplace_order.rental_started",
      entityType: "MarketplaceOrder",
      entityId: id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
    });
    return this.getForProvider(user, id);
  }

  /** Close out a paid sale, or a rental that has run its course. */
  async complete(user: RequestUser, id: string): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const moved = await this.prisma.marketplaceOrder.updateMany({
      where: { id, providerId: provider.id, status: { in: ["ACCEPTED", "ACTIVE"] }, paymentStatus: "PAID" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (moved.count !== 1) {
      await this.assertExists(id, provider.id);
      throw new BadRequestException("An order can be completed once it has been accepted and paid.");
    }
    await this.audit.record({
      action: "marketplace_order.completed",
      entityType: "MarketplaceOrder",
      entityId: id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
    });
    return this.getForProvider(user, id);
  }

  /**
   * Provider cancels an accepted order and the stock goes back — exactly once.
   *
   * `quantityReleasedAt` is the guard: the restore is conditional on it still
   * being null and is stamped in the same transaction, so a repeated call
   * cannot inflate the listing. A paid order is refused, because returning the
   * bed without returning the money is not a decision this endpoint can make.
   */
  async cancelAccepted(user: RequestUser, id: string, dto: DeclineOrderDto): Promise<OrderView> {
    const provider = await this.access.requireOwnProvider(user);
    const order = await this.prisma.marketplaceOrder.findFirst({
      where: { id, providerId: provider.id },
      select: { id: true, status: true, quantity: true, listingId: true, paymentStatus: true, quantityReleasedAt: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status !== "ACCEPTED") {
      throw new BadRequestException("Only an accepted order that has not started can be cancelled here.");
    }
    if (order.paymentStatus === "PAID") {
      throw new BadRequestException("This order has been paid. A refund has to be agreed before it can be cancelled.");
    }

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.marketplaceOrder.updateMany({
        where: { id: order.id, providerId: provider.id, status: "ACCEPTED", quantityReleasedAt: null },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          quantityReleasedAt: new Date(),
          declineReason: dto.reason?.trim() || null,
        },
      });
      // Zero rows means someone else already released it — do not restore twice.
      if (moved.count !== 1) {
        throw new ConflictException("This order has already been updated.");
      }
      await tx.providerListing.update({
        where: { id: order.listingId },
        data: { availableQuantity: { increment: order.quantity } },
      });
      await this.audit.record(
        {
          action: "marketplace_order.cancelled",
          entityType: "MarketplaceOrder",
          entityId: order.id,
          organizationId: provider.organizationId,
          actorUserId: user.id,
          metadata: { by: "provider", restoredQuantity: order.quantity },
        },
        tx,
      );
    });

    return this.getForProvider(user, order.id);
  }

  // -------------------------------------------------------------------------
  // Platform side
  // -------------------------------------------------------------------------

  async adminList(query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    return this.page({ ...(query.status ? { status: query.status as never } : {}) }, query);
  }

  async adminGet(id: string): Promise<OrderView> {
    const row = await this.prisma.marketplaceOrder.findUnique({ where: { id }, include: orderInclude });
    if (!row) throw new NotFoundException(`Order ${id} not found`);
    return toOrderView(row);
  }

  // ---- helpers ----

  /** Turns "wrong state" into 404 when the order is not the caller's at all. */
  private async assertExists(id: string, providerId?: string): Promise<void> {
    const exists = await this.prisma.marketplaceOrder.findFirst({
      where: { id, ...(providerId ? { providerId } : {}) },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Order ${id} not found`);
  }

  private async page(
    where: Prisma.MarketplaceOrderWhereInput,
    query: OrdersQueryDto,
  ): Promise<PaginatedResult<OrderView>> {
    const { page, pageSize } = query;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.marketplaceOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.marketplaceOrder.count({ where }),
    ]);
    return {
      items: rows.map(toOrderView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
