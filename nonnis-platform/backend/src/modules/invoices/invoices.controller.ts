import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { InvoicesService } from "./invoices.service";
import { ProductsService } from "./products.service";
import { SubscriptionsService } from "./subscriptions.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import {
  CreateInvoiceDto,
  InvoiceQueryDto,
  ReportInvoicePaymentDto,
  UpdateInvoiceDto,
  CreateSubscriptionDto,
  PaymentHistoryQueryDto,
  UpdateProductPricingDto,
  VerifyInvoicePaymentDto,
} from "./dto/invoices.dto";

/**
 * Nonni's invoicing a provider — the administrative side.
 *
 * Reading and writing are separate permissions, and confirming that money
 * arrived is a third: issuing a bill and asserting it was paid are different
 * levels of trust, so operations can watch billing without being able to settle
 * it.
 */
@Controller("invoices")
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: InvoiceQueryDto) {
    return this.invoices.list(user, query);
  }

  /** All payment records, across invoices and providers. */
  @Get("payments/history")
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  paymentHistory(@Query() query: PaymentHistoryQueryDto) {
    return this.invoices.paymentHistory(query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.get(id);
  }

  /** The invoice as a PDF, rendered from the record on every request. */
  @Get(":id/pdf")
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  @Header("content-type", "application/pdf")
  async downloadPdf(@Param("id", new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const invoice = await this.invoices.get(id);
    const file = await this.pdf.render(invoice);
    res.setHeader("content-disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(file);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(user, id, dto);
  }

  @Post(":id/submit-for-review")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  submitForReview(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.submitForReview(user, id);
  }

  /** Stand behind the final amount. Its own permission, deliberately. */
  @Post(":id/approve")
  @RequirePermissions(PERMISSIONS.INVOICES_APPROVE)
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.approve(user, id);
  }

  @Post(":id/send")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.markSent(user, id);
  }

  /** Email the invoice again. Does not change its status. */
  @Post(":id/resend")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  resend(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.resend(user, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.cancel(user, id);
  }

  /**
   * Confirm that an offline payment actually arrived.
   *
   * The only way a non-Stripe invoice becomes PAID, and deliberately behind its
   * own permission rather than INVOICES_MANAGE.
   */
  @Post(":id/verify-payment")
  @RequirePermissions(PERMISSIONS.INVOICES_VERIFY_PAYMENT)
  @HttpCode(HttpStatus.OK)
  verifyPayment(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: VerifyInvoicePaymentDto) {
    return this.invoices.verifyOfflinePayment(user, id, dto);
  }
}

/**
 * The provider's own billing.
 *
 * Every route is scoped by the provider the caller's active organization owns,
 * resolved server-side — never by an id in the request. Another provider's
 * invoice answers 404, the way every cross-tenant read on this platform does.
 */
@Controller("provider-portal/invoices")
export class ProviderInvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  list(@CurrentUser() user: RequestUser, @Query() query: InvoiceQueryDto) {
    return this.invoices.listOwn(user, query);
  }

  /**
   * Which ways of paying are actually open right now.
   *
   * Declared before `:id` so the literal path wins the match. It exists so the
   * screen can offer a card button only when a card payment would really work,
   * rather than showing one that fails on the click.
   */
  @Get("payment-options")
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  paymentOptions(): ReturnType<InvoicesService["paymentOptions"]> {
    return this.invoices.paymentOptions();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  get(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.invoices.getOwn(user, id);
  }

  /** Their own invoice as a PDF. Scoped the same way the detail route is. */
  @Get(":id/pdf")
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  @Header("content-type", "application/pdf")
  async downloadPdf(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const invoice = await this.invoices.getOwn(user, id);
    const file = await this.pdf.render(invoice);
    res.setHeader("content-disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(file);
  }

  /**
   * Begin a card payment for one of the caller's own invoices.
   *
   * The body is empty on purpose: the amount comes from the stored invoice, so
   * there is nothing here a browser could tamper with.
   */
  @Post(":id/checkout-session")
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<{ url: string }> {
    // Ownership first: getOwn 404s another provider's invoice, so a guessed id
    // can never reach the payment path.
    await this.invoices.getOwn(user, id);
    return this.invoices.createStripeCheckout(user, id);
  }

  /** "I have sent the payment." A claim — it never settles the invoice. */
  @Post(":id/report-payment")
  @RequirePermissions(PERMISSIONS.INVOICES_READ_OWN)
  @HttpCode(HttpStatus.OK)
  reportPayment(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ReportInvoicePaymentDto) {
    return this.invoices.reportOfflinePayment(user, id, dto);
  }
}

/**
 * The billable catalogue.
 *
 * Reading it is part of writing an invoice, so it follows INVOICES_READ.
 * Changing a suggested price is a pricing decision and follows INVOICES_APPROVE
 * — the same authority that signs off the figure on an invoice.
 */
@Controller("invoice-products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  list(@Query("activeOnly") activeOnly?: string) {
    return this.products.list(activeOnly === "true");
  }

  @Patch(":id/pricing")
  @RequirePermissions(PERMISSIONS.INVOICES_APPROVE)
  updatePricing(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateProductPricingDto) {
    return this.products.updatePricing(user, id, dto);
  }
}

/**
 * Recurring plans.
 *
 * Nonni's owns the schedule and the per-period invoices; a payment processor,
 * once connected, only collects them. Generation is behind INVOICES_MANAGE and
 * is safe to call repeatedly — a period that is already invoiced is skipped.
 */
@Controller("invoice-subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  list(@Query("providerId") providerId?: string) {
    return this.subscriptions.list(providerId);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INVOICES_READ)
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.subscriptions.get(id);
  }

  /** Put a provider on a monthly plan at the amount agreed with them. */
  @Post()
  @RequirePermissions(PERMISSIONS.INVOICES_APPROVE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(user, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.subscriptions.cancel(user, id);
  }

  /** Generate any invoice that has come due. Idempotent per billing period. */
  @Post("generate-due")
  @RequirePermissions(PERMISSIONS.INVOICES_MANAGE)
  @HttpCode(HttpStatus.OK)
  generateDue() {
    return this.subscriptions.generateDueInvoices();
  }
}
