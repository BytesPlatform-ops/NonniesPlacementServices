import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { MarketplaceAccessService } from "./marketplace-access";
import { listingInclude, toListingView, type ListingView } from "./marketplace.serializer";
import type {
  AddListingImageDto,
  CreateListingDto,
  ListingStatusDto,
  ListingsQueryDto,
  UpdateListingDto,
} from "./dto/marketplace.dto";

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

/** Parses a money string into a Decimal, rejecting anything that is not money. */
function money(value: string, field: string, { allowZero = false } = {}): Prisma.Decimal {
  if (!MONEY.test(value)) {
    throw new BadRequestException(`${field} must be an amount such as 1200 or 1200.50.`);
  }
  const decimal = new Prisma.Decimal(value);
  if (!allowZero && decimal.lessThanOrEqualTo(0)) {
    throw new BadRequestException(`${field} must be greater than zero.`);
  }
  if (decimal.lessThan(0)) {
    throw new BadRequestException(`${field} cannot be negative.`);
  }
  return decimal;
}

@Injectable()
export class MarketplaceListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MarketplaceAccessService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Provider side — always scoped to the caller's own provider
  // -------------------------------------------------------------------------

  async listOwn(user: RequestUser, query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    const provider = await this.access.requireOwnProvider(user);
    const where: Prisma.ProviderListingWhereInput = {
      providerId: provider.id,
      ...(query.status ? { status: query.status } : { status: { not: "ARCHIVED" } }),
      ...(query.transactionType ? { transactionType: query.transactionType } : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
    };
    return this.page(where, query);
  }

  async getOwn(user: RequestUser, id: string): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const row = await this.prisma.providerListing.findFirst({
      where: { id, providerId: provider.id },
      include: listingInclude,
    });
    // A listing belonging to another provider is "not found" — never a 403,
    // which would confirm it exists.
    if (!row) throw new NotFoundException(`Listing ${id} not found`);
    return toListingView(row);
  }

  async create(user: RequestUser, dto: CreateListingDto): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const price = money(dto.price, "Price");
    const billingPeriod = this.billingPeriodFor(dto.transactionType, dto.billingPeriod);
    const deposit = this.depositFor(dto.depositAmount);

    const row = await this.prisma.providerListing.create({
      data: {
        providerId: provider.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        listingType: dto.listingType,
        transactionType: dto.transactionType,
        price,
        currency: (dto.currency ?? "USD").toUpperCase(),
        billingPeriod,
        depositAmount: deposit,
        availableQuantity: dto.availableQuantity,
        addressLine1: dto.addressLine1?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        amenities: dto.amenities?.map((a) => a.trim()).filter(Boolean) ?? [],
        serviceCategoryId: dto.serviceCategoryId ?? null,
        restrictions: dto.restrictions?.trim() || null,
        status: "DRAFT",
        createdByUserId: user.id,
      },
      include: listingInclude,
    });

    await this.audit.record({
      action: "marketplace_listing.created",
      entityType: "ProviderListing",
      entityId: row.id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
      metadata: { title: row.title, transactionType: row.transactionType },
    });
    return toListingView(row);
  }

  async update(user: RequestUser, id: string, dto: UpdateListingDto): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const existing = await this.prisma.providerListing.findFirst({
      where: { id, providerId: provider.id },
      select: { id: true, transactionType: true },
    });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);

    // The transaction type decides whether a billing period is legal, so the
    // incoming value is judged against the type this update leaves behind.
    const transactionType = dto.transactionType ?? existing.transactionType;
    const price = dto.price !== undefined ? money(dto.price, "Price") : null;
    const billingPeriod = this.billingPeriodFor(transactionType, dto.billingPeriod);
    const deposit = this.depositFor(dto.depositAmount);

    const row = await this.prisma.providerListing.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.listingType !== undefined ? { listingType: dto.listingType } : {}),
        ...(dto.transactionType !== undefined ? { transactionType: dto.transactionType } : {}),
        ...(price ? { price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        // Always written: a listing switched from RENT to SALE must lose its
        // period, and one switched to RENT must gain the new one.
        billingPeriod,
        ...(dto.depositAmount !== undefined ? { depositAmount: deposit } : {}),
        ...(dto.availableQuantity !== undefined ? { availableQuantity: dto.availableQuantity } : {}),
        ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() || null } : {}),
        ...(dto.state !== undefined ? { state: dto.state.trim() || null } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode.trim() || null } : {}),
        ...(dto.availableFrom !== undefined ? { availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null } : {}),
        ...(dto.amenities !== undefined ? { amenities: dto.amenities.map((a) => a.trim()).filter(Boolean) } : {}),
        ...(dto.serviceCategoryId !== undefined ? { serviceCategoryId: dto.serviceCategoryId } : {}),
        ...(dto.restrictions !== undefined ? { restrictions: dto.restrictions.trim() || null } : {}),
      },
      include: listingInclude,
    });

    await this.audit.record({
      action: "marketplace_listing.updated",
      entityType: "ProviderListing",
      entityId: row.id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toListingView(row);
  }

  async setStatus(user: RequestUser, id: string, dto: ListingStatusDto): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const existing = await this.prisma.providerListing.findFirst({
      where: { id, providerId: provider.id },
      select: { id: true, status: true, title: true, price: true, availableQuantity: true, transactionType: true, billingPeriod: true },
    });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);

    if (dto.status === "PUBLISHED") {
      // Publishing is the moment a listing becomes an offer, so the terms have
      // to be complete — a rental with no period cannot be priced.
      if (existing.transactionType === "RENT" && !existing.billingPeriod) {
        throw new BadRequestException("A rental listing needs a billing period before it can be published.");
      }
      if (existing.price.lessThanOrEqualTo(0)) {
        throw new BadRequestException("A listing needs a price above zero before it can be published.");
      }
    }

    const row = await this.prisma.providerListing.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        // Stamped on the first publish and kept afterwards, so unpublishing and
        // republishing does not rewrite when the listing first went live.
        ...(dto.status === "PUBLISHED" && existing.status !== "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
      include: listingInclude,
    });

    await this.audit.record({
      action: `marketplace_listing.${dto.status.toLowerCase()}`,
      entityType: "ProviderListing",
      entityId: row.id,
      organizationId: provider.organizationId,
      actorUserId: user.id,
      metadata: { from: existing.status, to: dto.status },
    });
    return toListingView(row);
  }

  async addImage(user: RequestUser, id: string, dto: AddListingImageDto): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const listing = await this.prisma.providerListing.findFirst({
      where: { id, providerId: provider.id },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    const count = await this.prisma.providerListingImage.count({ where: { listingId: listing.id } });
    if (count >= 10) throw new BadRequestException("A listing can hold at most 10 images.");

    await this.prisma.providerListingImage.create({
      data: {
        listingId: listing.id,
        imageUrl: dto.imageUrl,
        storagePath: dto.storagePath ?? null,
        altText: dto.altText?.trim() || null,
        sortOrder: count,
      },
    });
    return this.getOwn(user, listing.id);
  }

  async removeImage(user: RequestUser, id: string, imageId: string): Promise<ListingView> {
    const provider = await this.access.requireOwnProvider(user);
    const image = await this.prisma.providerListingImage.findFirst({
      where: { id: imageId, listing: { id, providerId: provider.id } },
      select: { id: true },
    });
    if (!image) throw new NotFoundException(`Image ${imageId} not found`);
    await this.prisma.providerListingImage.delete({ where: { id: image.id } });
    return this.getOwn(user, id);
  }

  // -------------------------------------------------------------------------
  // Public (family) side — published and in stock only
  // -------------------------------------------------------------------------

  /**
   * The marketplace as a family sees it.
   *
   * Deliberately NOT referral-scoped: any family member may browse every
   * published listing. `status: PUBLISHED` and a positive quantity are applied
   * in the query, so a draft or archived listing is not merely hidden from the
   * list — it cannot be reached at all.
   */
  async browse(query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    const where: Prisma.ProviderListingWhereInput = {
      status: "PUBLISHED",
      availableQuantity: { gt: 0 },
      ...(query.transactionType ? { transactionType: query.transactionType } : {}),
      ...(query.listingType ? { listingType: query.listingType } : {}),
      ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.minPrice || query.maxPrice
        ? {
            price: {
              ...(query.minPrice ? { gte: money(query.minPrice, "Minimum price", { allowZero: true }) } : {}),
              ...(query.maxPrice ? { lte: money(query.maxPrice, "Maximum price", { allowZero: true }) } : {}),
            },
          }
        : {}),
    };
    return this.page(where, query);
  }

  /** One published listing, or 404 — a draft id cannot be guessed into view. */
  async publicDetail(id: string): Promise<ListingView> {
    const row = await this.prisma.providerListing.findFirst({
      where: { id, status: "PUBLISHED" },
      include: listingInclude,
    });
    if (!row) throw new NotFoundException(`Listing ${id} not found`);
    return toListingView(row);
  }

  // -------------------------------------------------------------------------
  // Platform side
  // -------------------------------------------------------------------------

  async adminList(query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    const where: Prisma.ProviderListingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.transactionType ? { transactionType: query.transactionType } : {}),
      ...(query.providerId ? { providerId: query.providerId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
    };
    return this.page(where, query);
  }

  /** Moderation: a platform user may take any listing down. */
  async adminSetStatus(user: RequestUser, id: string, dto: ListingStatusDto): Promise<ListingView> {
    const existing = await this.prisma.providerListing.findUnique({
      where: { id },
      select: { id: true, status: true, provider: { select: { organizationId: true } } },
    });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);
    if (dto.status === "PUBLISHED") {
      throw new BadRequestException("A listing is published by its provider, not from the admin console.");
    }

    const row = await this.prisma.providerListing.update({
      where: { id: existing.id },
      data: { status: dto.status },
      include: listingInclude,
    });
    await this.audit.record({
      action: "marketplace_listing.moderated",
      entityType: "ProviderListing",
      entityId: row.id,
      organizationId: existing.provider.organizationId,
      actorUserId: user.id,
      metadata: { from: existing.status, to: dto.status },
    });
    return toListingView(row);
  }

  // ---- helpers ----

  private async page(
    where: Prisma.ProviderListingWhereInput,
    query: ListingsQueryDto,
  ): Promise<PaginatedResult<ListingView>> {
    const { page, pageSize } = query;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.providerListing.findMany({
        where,
        include: listingInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.providerListing.count({ where }),
    ]);
    return {
      items: rows.map(toListingView),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * A billing period belongs to a rental and to nothing else.
   *
   * A SALE always stores null whatever was sent, so a listing switched from
   * RENT to SALE cannot keep a period that no longer means anything.
   */
  private billingPeriodFor(
    transactionType: CreateListingDto["transactionType"],
    billingPeriod: CreateListingDto["billingPeriod"],
  ): CreateListingDto["billingPeriod"] | null {
    if (transactionType !== "RENT") return null;
    if (!billingPeriod) {
      throw new BadRequestException("A rental listing needs a billing period (daily, weekly or monthly).");
    }
    return billingPeriod;
  }

  /** Informational only in this phase — zero is allowed, negative is not. */
  private depositFor(depositAmount: string | undefined): Prisma.Decimal | null {
    if (depositAmount === undefined || depositAmount === "") return null;
    return money(depositAmount, "Deposit", { allowZero: true });
  }
}
