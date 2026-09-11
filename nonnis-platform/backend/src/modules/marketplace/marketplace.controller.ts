import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import type { PaginatedResult } from "../../common/types/api-response";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { MediaService } from "../content/media.service";
import { MarketplaceListingsService } from "./listings.service";
import { MarketplaceOrdersService } from "./orders.service";
import type { ListingView, OrderView } from "./marketplace.serializer";
import {
  AddListingImageDto,
  CreateListingDto,
  CreateOrderDto,
  DeclineOrderDto,
  ListingStatusDto,
  ListingImageUploadUrlDto,
  ListingsQueryDto,
  OrdersQueryDto,
  UpdateListingDto,
} from "./dto/marketplace.dto";

/**
 * A provider's own marketplace listings.
 *
 * Provider identity comes from the authenticated membership inside the service,
 * never from the URL, so there is no id here that could address another
 * provider's listing.
 */
@Controller("provider/listings")
export class ProviderListingsController {
  constructor(
    private readonly listings: MarketplaceListingsService,
    private readonly media: MediaService,
  ) {}

  /**
   * A signed upload ticket for a listing photo.
   *
   * The content module already owns bucket policy, type and size validation, so
   * this reuses it rather than inventing a second storage path. It exists
   * separately from the CMS route only because a provider holds marketplace
   * permissions, not content-management ones.
   */
  @Post("image-upload-url")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  imageUploadUrl(@Body() dto: ListingImageUploadUrlDto) {
    return this.media.createUploadTicket("provider-public", dto.contentType, dto.sizeBytes);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  list(@CurrentUser() user: RequestUser, @Query() query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    return this.listings.listOwn(user, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateListingDto): Promise<ListingView> {
    return this.listings.create(user, dto);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  get(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ListingView> {
    return this.listings.getOwn(user, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingView> {
    return this.listings.update(user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ListingStatusDto,
  ): Promise<ListingView> {
    return this.listings.setStatus(user, id, dto);
  }

  @Post(":id/images")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  @HttpCode(HttpStatus.CREATED)
  addImage(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AddListingImageDto,
  ): Promise<ListingView> {
    return this.listings.addImage(user, id, dto);
  }

  @Delete(":id/images/:imageId")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_LISTINGS_MANAGE_OWN)
  removeImage(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ): Promise<ListingView> {
    return this.listings.removeImage(user, id, imageId);
  }
}

/** A provider's incoming marketplace orders. */
@Controller("provider/marketplace-orders")
export class ProviderMarketplaceOrdersController {
  constructor(private readonly orders: MarketplaceOrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  list(@CurrentUser() user: RequestUser, @Query() query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    return this.orders.listForProvider(user, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  get(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.getForProvider(user, id);
  }

  @Post(":id/accept")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.accept(user, id);
  }

  @Post(":id/decline")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  decline(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: DeclineOrderDto,
  ): Promise<OrderView> {
    return this.orders.decline(user, id, dto);
  }

  @Post(":id/record-cash-payment")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  recordCash(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.markCashReceived(user, id);
  }

  @Post(":id/start-rental")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  startRental(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.startRental(user, id);
  }

  @Post(":id/complete")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.complete(user, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ORDERS_MANAGE_OWN)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: DeclineOrderDto,
  ): Promise<OrderView> {
    return this.orders.cancelAccepted(user, id, dto);
  }
}

/**
 * The family-facing marketplace.
 *
 * Unlike every other seeker route, this one is NOT case-scoped: browsing is
 * open to any family member, which is the whole point of a marketplace. Row
 * security lives on the orders instead — a family reads only their own.
 */
@Controller("seeker/marketplace")
export class SeekerMarketplaceController {
  constructor(
    private readonly listings: MarketplaceListingsService,
    private readonly orders: MarketplaceOrdersService,
  ) {}

  @Get("listings")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_BROWSE)
  browse(@Query() query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    return this.listings.browse(query);
  }

  @Get("listings/:id")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_BROWSE)
  detail(@Param("id", new ParseUUIDPipe()) id: string): Promise<ListingView> {
    return this.listings.publicDetail(id);
  }

  @Post("orders")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_ORDER)
  @HttpCode(HttpStatus.CREATED)
  createOrder(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto): Promise<OrderView> {
    return this.orders.create(user, dto);
  }

  @Get("orders")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_BROWSE)
  listOrders(@CurrentUser() user: RequestUser, @Query() query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    return this.orders.listOwn(user, query);
  }

  @Get("orders/:id")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_BROWSE)
  getOrder(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.getOwn(user, id);
  }

  @Post("orders/:id/cancel")
  @RequirePermissions(PERMISSIONS.SEEKER_MARKETPLACE_ORDER)
  @HttpCode(HttpStatus.OK)
  cancelOrder(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.cancelOwn(user, id);
  }
}

/** Platform-wide marketplace visibility and moderation. */
@Controller("marketplace")
export class MarketplaceAdminController {
  constructor(
    private readonly listings: MarketplaceListingsService,
    private readonly orders: MarketplaceOrdersService,
  ) {}

  @Get("listings")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ADMIN_READ)
  listings_(@Query() query: ListingsQueryDto): Promise<PaginatedResult<ListingView>> {
    return this.listings.adminList(query);
  }

  @Patch("listings/:id/status")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ADMIN_MANAGE)
  moderate(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ListingStatusDto,
  ): Promise<ListingView> {
    return this.listings.adminSetStatus(user, id, dto);
  }

  @Get("orders")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ADMIN_READ)
  orders_(@Query() query: OrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    return this.orders.adminList(query);
  }

  @Get("orders/:id")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ADMIN_READ)
  order(@Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.adminGet(id);
  }

  @Post("orders/:id/record-cash-payment")
  @RequirePermissions(PERMISSIONS.MARKETPLACE_ADMIN_MANAGE)
  @HttpCode(HttpStatus.OK)
  recordCash(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<OrderView> {
    // Authorized override: acts without a provider scope, and the audit event
    // records that it came from the admin console.
    return this.orders.markCashReceived(user, id, true);
  }
}
