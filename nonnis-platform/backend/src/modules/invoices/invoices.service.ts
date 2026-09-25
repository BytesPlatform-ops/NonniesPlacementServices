import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { PERMISSIONS } from "../../common/rbac";
import { calculateInvoiceTotals, isFullySettled, recurringEndsAt } from "./invoice-totals";
import { InvoiceEmailService } from "./invoice-email.service";
import { PAYMENT_GATEWAY, type PaymentGateway } from "./payment-gateway";
import { readPaymentToken } from "./payment-link";
import { zelleInstructions } from "./zelle";
import { NotificationsService } from "../notifications/notifications.service";
import { NOTIFICATION_TYPES, ROUTES, eventKey } from "../notifications/notification-catalog";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";
import type { CreateInvoiceDto, InvoiceQueryDto, UpdateInvoiceDto } from "./dto/invoices.dto";
import { invoiceInclude, toInvoiceView, type InvoiceView } from "./invoices.serializer";

/**
 * Human-readable invoice reference: INV-<year>-XXXXXX, mirroring the order and
 * referral references. The UUID stays the primary key; this is for people.
 */
export function generateInvoiceNumber(now: Date = new Date()): string {
  return `INV-${now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Statuses an invoice may still be edited in.
 *
 * Editing stops at APPROVED: the whole point of approval is that somebody took
 * responsibility for a figure, and a figure that can still change afterwards
 * was never approved.
 */
const EDITABLE: InvoiceStatus[] = ["DRAFT", "PENDING_REVIEW"];
/** Statuses that can still receive money. */
const PAYABLE: InvoiceStatus[] = ["SENT", "PENDING_PAYMENT", "OVERDUE", "REQUIRES_VERIFICATION"];

/**
 * Nonni's invoicing a provider.
 *
 * Two rules shape everything here.
 *
 * 1. THE INVOICE IS THE BUSINESS RECORD, STRIPE IS A PAYMENT RAIL. Amounts, line
 *    items and the status a human relies on live in these tables. Stripe is told
 *    what to charge; it is never asked what the invoice says.
 *
 * 2. MONEY IS ONLY EVER RECORDED FROM EVIDENCE. A card payment is recorded from
 *    a verified Stripe webhook. An offline payment is recorded when a person
 *    with `invoices.verify_payment` says they saw it in the bank. Nobody — not
 *    the provider, not an admin acting on a message — can mark an invoice paid
 *    on someone's say-so alone.
 *
 * Totals are always recomputed from the stored items. A client may send items;
 * it may never send a total.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger("Invoices");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: InvoiceEmailService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- reading ---------------------------------------------------------------

  async list(
    user: RequestUser,
    query: InvoiceQueryDto,
    /** Extra narrowing the caller enforces — never anything a request supplies. */
    scope: Prisma.InvoiceWhereInput = {},
  ): Promise<{ items: InvoiceView[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const where: Prisma.InvoiceWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.providerId ? { providerId: query.providerId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      items: rows.map(toInvoiceView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string): Promise<InvoiceView> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!row) throw new NotFoundException(`Invoice ${id} not found`);
    return toInvoiceView(row);
  }

  /**
   * A provider reading the invoices addressed to them.
   *
   * Scoped by the provider the caller's ACTIVE organization owns — never by an
   * id from the request, so a provider cannot read another's billing by
   * changing a parameter.
   */
  /**
   * A provider sees the bills Nonni's has actually sent them — and only those.
   *
   * The gate is `sentAt`, not a status: a draft still being written, and an
   * approved invoice somebody has not sent yet, are internal. Showing either
   * would put a figure in front of a provider that Nonni's had not yet decided
   * to bill, and a draft's amount can still change.
   */
  async listOwn(user: RequestUser, query: InvoiceQueryDto): Promise<{ items: InvoiceView[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const providerId = await this.requireOwnProviderId(user);
    return this.list(user, { ...query, providerId }, { sentAt: { not: null } });
  }

  async getOwn(user: RequestUser, id: string): Promise<InvoiceView> {
    const providerId = await this.requireOwnProviderId(user);
    // Same gate as the list: an unsent invoice answers 404, exactly as another
    // provider's would, so its existence is never confirmed either.
    const row = await this.prisma.invoice.findFirst({ where: { id, providerId, sentAt: { not: null } }, include: invoiceInclude });
    // 404 rather than 403: another provider's invoice must not be confirmed to
    // exist, which is how the rest of this platform answers cross-tenant reads.
    if (!row) throw new NotFoundException(`Invoice ${id} not found`);
    return toInvoiceView(row);
  }

  private async requireOwnProviderId(user: RequestUser): Promise<string> {
    const organizationId = user.activeOrganizationId;
    if (!organizationId) throw new ForbiddenException("Select a provider organization first.");
    const provider = await this.prisma.provider.findUnique({ where: { organizationId }, select: { id: true } });
    if (!provider) throw new ForbiddenException("This organization has no provider profile.");
    return provider.id;
  }

  /**
   * Every payment record across all providers.
   *
   * Its own query rather than a walk over invoices, because payment history
   * outlives the invoice's current status: a failed attempt and a later refund
   * both stay on the record, and an invoice that has since been cancelled still
   * has to account for money that moved.
   */
  async paymentHistory(query: { page: number; pageSize: number; status?: string; providerId?: string }): Promise<{
    items: Array<{
      id: string;
      invoiceId: string;
      invoiceNumber: string;
      provider: { id: string; name: string };
      amount: string;
      currency: string;
      method: string;
      status: string;
      paidAt: string;
      reference: string | null;
      verified: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const where: Prisma.InvoicePaymentWhereInput = {
      ...(query.status ? { status: query.status as Prisma.EnumInvoicePaymentStatusFilter["equals"] } : {}),
      ...(query.providerId ? { invoice: { providerId: query.providerId } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoicePayment.findMany({
        where,
        include: { invoice: { select: { id: true, invoiceNumber: true, currency: true, provider: { select: { id: true, displayName: true } } } } },
        orderBy: { paidAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoicePayment.count({ where }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        invoiceId: p.invoice.id,
        invoiceNumber: p.invoice.invoiceNumber,
        provider: { id: p.invoice.provider.id, name: p.invoice.provider.displayName },
        amount: p.amount.toFixed(2),
        currency: p.invoice.currency,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt.toISOString(),
        reference: p.reference,
        verified: !!p.verifiedByUserId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  // ---- writing ---------------------------------------------------------------

  /**
   * Create a draft invoice with its line items.
   *
   * Everything financial is derived here: the client sends names, quantities and
   * unit prices, and the server decides every total. A recurring invoice also
   * gets its end date computed now, because Stripe cannot stop a subscription
   * after N charges by itself.
   */
  async create(user: RequestUser, dto: CreateInvoiceDto): Promise<InvoiceView> {
    const provider = await this.prisma.provider.findUnique({ where: { id: dto.providerId }, select: { id: true } });
    if (!provider) throw new NotFoundException(`Provider ${dto.providerId} not found`);
    if (dto.items.length === 0) throw new BadRequestException("An invoice needs at least one line item.");

    const totals = calculateInvoiceTotals(dto.items, dto.taxRate ?? 0);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const recurring = this.resolveRecurring(dto, issueDate);

    const created = await this.prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(issueDate),
        providerId: dto.providerId,
        caseId: dto.caseId ?? null,
        orderId: dto.orderId ?? null,
        status: "DRAFT",
        billingType: dto.billingType ?? "ONE_TIME",
        paymentMethod: dto.paymentMethod ?? "STRIPE",
        issueDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        currency: (dto.currency ?? "USD").toUpperCase(),
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        notes: dto.notes?.trim() || null,
        ...recurring,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        items: {
          create: dto.items.map((item, position) => ({
            productId: item.productId ?? null,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            quantity: totals.lines[position]!.quantity,
            unitPrice: totals.lines[position]!.unitPrice,
            lineTotal: totals.lines[position]!.lineTotal,
            position,
          })),
        },
        events: {
          create: {
            type: "created",
            toStatus: "DRAFT",
            message: `Invoice created with ${dto.items.length} line item${dto.items.length === 1 ? "" : "s"}.`,
            actorUserId: user.id,
          },
        },
      },
      include: invoiceInclude,
    });

    await this.audit.record({
      action: "invoice.created",
      entityType: "Invoice",
      entityId: created.id,
      actorUserId: user.id,
      metadata: { invoiceNumber: created.invoiceNumber, total: created.totalAmount.toFixed(2), currency: created.currency },
    });
    return toInvoiceView(created);
  }

  /**
   * Edit a draft.
   *
   * Only drafts: once an invoice has been sent, the provider has a copy of a
   * document, and silently changing what it says underneath them is not an edit
   * but a different invoice. Cancel and reissue instead.
   */
  async update(user: RequestUser, id: string, dto: UpdateInvoiceDto): Promise<InvoiceView> {
    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { id: true, status: true, issueDate: true } });
    if (!existing) throw new NotFoundException(`Invoice ${id} not found`);
    if (!EDITABLE.includes(existing.status)) {
      throw new BadRequestException("Only a draft invoice can be edited. Cancel it and raise a new one instead.");
    }

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : existing.issueDate;
    const totals = dto.items ? calculateInvoiceTotals(dto.items, dto.taxRate ?? 0) : null;
    const recurring = dto.billingType ? this.resolveRecurring(dto, issueDate) : {};

    const updated = await this.prisma.$transaction(async (tx) => {
      if (totals && dto.items) {
        // Replace wholesale: line identity carries no meaning on a draft, and
        // diffing would let a stale client id resurrect a removed line.
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: dto.items.map((item, position) => ({
            invoiceId: id,
            productId: item.productId ?? null,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            quantity: totals.lines[position]!.quantity,
            unitPrice: totals.lines[position]!.unitPrice,
            lineTotal: totals.lines[position]!.lineTotal,
            position,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
          ...(dto.issueDate !== undefined ? { issueDate } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
          ...(dto.billingType !== undefined ? { billingType: dto.billingType } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
          ...(totals ? { subtotal: totals.subtotal, taxRate: totals.taxRate, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount } : {}),
          ...recurring,
          updatedByUserId: user.id,
        },
        include: invoiceInclude,
      });
    });

    await this.audit.record({
      action: "invoice.updated",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { invoiceNumber: updated.invoiceNumber, total: updated.totalAmount.toFixed(2) },
    });
    return toInvoiceView(updated);
  }

  /** Recurring fields, or the explicit absence of them for a one-time invoice. */
  private resolveRecurring(
    dto: { billingType?: "ONE_TIME" | "RECURRING"; recurringInterval?: "MONTHLY"; recurringPeriods?: number; recurringStartAt?: string },
    issueDate: Date,
  ): Prisma.InvoiceUncheckedCreateInput extends never ? never : Record<string, unknown> {
    if (dto.billingType !== "RECURRING") {
      return { recurringInterval: null, recurringPeriods: null, recurringStartAt: null, recurringEndsAt: null };
    }
    const interval = dto.recurringInterval ?? "MONTHLY";
    const periods = dto.recurringPeriods ?? 0;
    if (periods < 1) throw new BadRequestException("A recurring invoice needs at least one billing period.");
    const startAt = dto.recurringStartAt ? new Date(dto.recurringStartAt) : issueDate;
    return {
      recurringInterval: interval,
      recurringPeriods: periods,
      recurringStartAt: startAt,
      recurringEndsAt: recurringEndsAt(startAt, periods, interval),
    };
  }

  /** Submit a draft for approval. */
  async submitForReview(user: RequestUser, id: string): Promise<InvoiceView> {
    return this.transition(id, ["DRAFT"], "PENDING_REVIEW", {
      type: "submitted_for_review",
      message: "Invoice submitted for approval.",
      actorUserId: user.id,
    });
  }

  /**
   * Approve the final amount.
   *
   * Behind `invoices.approve` rather than `invoices.manage`: prices here are
   * negotiated per provider, so writing a figure and standing behind it are
   * separate acts. The approver and the moment are both recorded, because an
   * amount that left the building should always have a name against it.
   */
  async approve(user: RequestUser, id: string): Promise<InvoiceView> {
    if (!user.activePermissions.has(PERMISSIONS.INVOICES_APPROVE)) {
      throw new ForbiddenException("You are not authorized to approve invoice amounts.");
    }
    return this.transition(id, ["DRAFT", "PENDING_REVIEW"], "APPROVED", {
      type: "approved",
      message: "Invoice amount approved.",
      actorUserId: user.id,
      data: { approvedByUserId: user.id, approvedAt: new Date() },
    });
  }

  /**
   * Send an approved invoice to the provider.
   *
   * Only from APPROVED. An unapproved amount must never reach a provider — that
   * is the single rule this whole workflow exists to enforce.
   */
  async markSent(user: RequestUser, id: string): Promise<InvoiceView> {
    const invoice = await this.get(id);
    if (invoice.status !== "APPROVED") {
      throw new BadRequestException("Only an approved invoice can be sent. Approve the amount first.");
    }

    // Sending is delivery to the provider's own portal, and that is what moves
    // first. Both sides are on this platform, so the invoice reaching them does
    // not depend on mail getting through — an email provider being down, or a
    // provider having no address on file, must not stop Nonni's billing them.
    await this.transition(id, ["APPROVED"], "SENT", {
      type: "sent",
      message: `Invoice delivered to ${invoice.provider.name}'s portal.`,
      actorUserId: user.id,
      data: { sentAt: new Date() },
    });

    await this.notifyProvider(invoice, user.id);

    // The email is a courtesy copy of something the provider already has. It is
    // attempted after the fact and never fails the send; what it does do is
    // leave a record either way, so nobody has to wonder whether it went.
    const outcome = await this.email
      .send(invoice)
      .catch((err: unknown) => ({ sent: false, reason: err instanceof Error ? err.message : "unknown error" }));

    if (!outcome.sent) {
      this.logger.warn(`Invoice ${invoice.invoiceNumber} is in the provider's portal, but the email copy failed: ${outcome.reason}`);
    }
    await this.prisma.invoiceEvent.create({
      data: {
        invoiceId: id,
        type: outcome.sent ? "email_sent" : "email_failed",
        message: outcome.sent
          ? `Emailed to ${invoice.provider.email}.`
          : `The email copy could not be delivered (${outcome.reason ?? "unknown"}). The provider can still see and pay this invoice in their portal.`,
        actorRef: "system:invoicing",
      },
    });

    await this.audit.record({
      action: "invoice.sent",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, emailed: outcome.sent },
    });
    return this.get(id);
  }

  /**
   * Tell the provider, in the product, that they have a bill.
   *
   * Addressed to the people who may read their organisation's invoices, so it
   * lands with whoever actually handles billing there. Deduplicated on the
   * invoice, so re-sending never stacks up duplicate alerts.
   */
  private async notifyProvider(invoice: InvoiceView, actorUserId: string): Promise<void> {
    try {
      const recipients = await this.notifications.for.providerUsers(invoice.provider.id, PERMISSIONS.INVOICES_READ_OWN);
      if (recipients.length === 0) {
        this.logger.warn(`Invoice ${invoice.invoiceNumber} was sent, but ${invoice.provider.name} has nobody who can read invoices.`);
        return;
      }
      await this.notifications.raise({
        type: NOTIFICATION_TYPES.INVOICE_SENT,
        title: `Invoice ${invoice.invoiceNumber}`,
        message: `Nonni's has sent you an invoice for ${invoice.currency} ${invoice.amountDue}.`,
        recipientUserIds: recipients,
        eventKey: eventKey(NOTIFICATION_TYPES.INVOICE_SENT, invoice.id),
        route: ROUTES.providerInvoice(invoice.id),
        entityType: "Invoice",
        entityId: invoice.id,
        organizationId: await this.notifications.for.providerOrganizationId(invoice.provider.id),
        actorUserId,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      });
    } catch (err) {
      // A failed alert must not undo a delivered invoice.
      this.logger.warn(`Could not notify ${invoice.provider.name} about ${invoice.invoiceNumber}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  /**
   * Email an invoice again, without moving its status.
   *
   * A separate action from sending so the first send stays a single, meaningful
   * transition and every later copy is its own recorded event — somebody asking
   * "was this ever sent, and how many times?" gets an honest answer.
   */
  async resend(user: RequestUser, id: string): Promise<InvoiceView> {
    const invoice = await this.get(id);
    if (invoice.status === "DRAFT" || invoice.status === "PENDING_REVIEW") {
      throw new BadRequestException("This invoice has not been approved yet.");
    }
    if (invoice.status === "CANCELLED") throw new BadRequestException("This invoice was cancelled.");

    const outcome = await this.email.send(invoice);
    if (!outcome.sent) {
      throw new ServiceUnavailableException(outcome.reason ?? "The invoice email could not be delivered.");
    }

    await this.prisma.invoiceEvent.create({
      data: {
        invoiceId: id,
        type: "resent",
        message: `Invoice emailed again to ${invoice.provider.email}.`,
        actorUserId: user.id,
      },
    });
    await this.audit.record({
      action: "invoice.resent",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
    return this.get(id);
  }

  async cancel(user: RequestUser, id: string): Promise<InvoiceView> {
    return this.transition(id, ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "PENDING_PAYMENT", "OVERDUE", "REQUIRES_VERIFICATION"], "CANCELLED", {
      type: "cancelled",
      message: "Invoice cancelled.",
      actorUserId: user.id,
      data: { cancelledAt: new Date() },
    });
  }

  /**
   * A provider saying they have sent an offline payment.
   *
   * A claim, not a settlement: the invoice moves to REQUIRES_VERIFICATION and no
   * payment row is written. Money is only ever recorded from evidence, and a
   * message is not evidence.
   */
  async reportOfflinePayment(user: RequestUser, id: string, dto: { reference?: string }): Promise<InvoiceView> {
    const providerId = await this.requireOwnProviderId(user);
    const invoice = await this.prisma.invoice.findFirst({ where: { id, providerId }, select: { id: true, status: true, invoiceNumber: true } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    if (invoice.status === "PAID") throw new BadRequestException("This invoice is already paid.");
    if (!PAYABLE.includes(invoice.status)) throw new BadRequestException("This invoice is not awaiting payment.");

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invoice.update({
        where: { id },
        data: { status: "REQUIRES_VERIFICATION" },
        include: invoiceInclude,
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId: id,
          type: "payment_reported",
          fromStatus: invoice.status,
          toStatus: "REQUIRES_VERIFICATION",
          message: dto.reference?.trim() ? `Provider reported payment, reference ${dto.reference.trim()}.` : "Provider reported sending payment.",
          actorUserId: user.id,
        },
      });
      return row;
    });

    await this.audit.record({
      action: "invoice.payment_reported",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, hasReference: !!dto.reference?.trim() },
    });
    return toInvoiceView(updated);
  }

  /**
   * An authorized person confirming that offline money actually arrived.
   *
   * This is the only path by which a non-Stripe invoice becomes PAID, and it
   * requires `invoices.verify_payment` — deliberately a different permission
   * from writing invoices, because issuing a bill and asserting money was
   * received are different levels of trust.
   */
  async verifyOfflinePayment(
    user: RequestUser,
    id: string,
    dto: { amount?: string; method?: "ZELLE"; reference?: string },
  ): Promise<InvoiceView> {
    if (!user.activePermissions.has(PERMISSIONS.INVOICES_VERIFY_PAYMENT)) {
      throw new ForbiddenException("You are not authorized to verify payments.");
    }
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true, totalAmount: true, amountPaid: true, paymentMethod: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    if (invoice.status === "PAID") throw new BadRequestException("This invoice is already paid.");
    if (invoice.status === "CANCELLED") throw new BadRequestException("This invoice was cancelled.");

    const amount = dto.amount ? new Prisma.Decimal(dto.amount) : invoice.totalAmount.sub(invoice.amountPaid);
    if (amount.lte(0)) throw new BadRequestException("Enter the amount that was received.");

    const method = dto.method ?? (invoice.paymentMethod === "STRIPE" ? "BANK_TRANSFER" : invoice.paymentMethod);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId: id,
          amount,
          method,
          paidAt: now,
          reference: dto.reference?.trim() || null,
          verifiedByUserId: user.id,
          verifiedAt: now,
        },
      });
      const paid = invoice.amountPaid.add(amount);
      const settled = isFullySettled(invoice.totalAmount, paid);
      const row = await tx.invoice.update({
        where: { id },
        data: {
          amountPaid: paid,
          ...(settled ? { status: "PAID" as const, paidAt: now } : { status: "PENDING_PAYMENT" as const }),
        },
        include: invoiceInclude,
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId: id,
          type: "payment_verified",
          fromStatus: invoice.status,
          toStatus: settled ? "PAID" : "PENDING_PAYMENT",
          message: `${method} payment of ${amount.toFixed(2)} verified.`,
          actorUserId: user.id,
        },
      });
      return row;
    });

    await this.audit.record({
      action: "invoice.payment_verified",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: amount.toFixed(2), method },
    });
    return toInvoiceView(updated);
  }

  // ---- Stripe ----------------------------------------------------------------

  /**
   * Begin a card payment for an approved invoice.
   *
   * The charge is built from the stored invoice, so nothing a browser sends can
   * influence what is billed. The session is recorded against the invoice but
   * the invoice is NOT moved: returning from Stripe proves nothing, and only a
   * verified webhook settles it.
   */
  async createStripeCheckout(user: RequestUser, id: string): Promise<{ url: string }> {
    const { url } = await this.beginCardPayment(id);
    await this.audit.record({
      action: "invoice.stripe_checkout_started",
      entityType: "Invoice",
      entityId: id,
      actorUserId: user.id,
      metadata: { via: "portal" },
    });
    return { url };
  }

  /**
   * Whether an invoice can still be paid, and why not when it cannot.
   *
   * One place decides this, because the answer has to be identical whether it
   * is asked by the signed-in portal, by a link in an email sent three weeks
   * ago, or by a screen deciding which buttons to draw.
   */
  private payability(status: string): { payable: boolean; reason: string } {
    if (status === "PAID") return { payable: false, reason: "This invoice is already paid." };
    if (status === "CANCELLED") return { payable: false, reason: "This invoice was cancelled." };
    if (status === "DRAFT" || status === "PENDING_REVIEW") {
      return { payable: false, reason: "This invoice has not been approved yet." };
    }
    return { payable: true, reason: "" };
  }

  /**
   * Open the card payment page for one invoice.
   *
   * Everything that matters is decided here, from the stored record:
   *
   *  - The amount is the approved balance on the invoice. No caller supplies
   *    it, so there is nothing a browser or a URL could tamper with.
   *  - An existing session is resumed when it is still open, so a provider who
   *    clicks the same emailed link twice sees one payment, not two.
   *  - A dead session is replaced rather than re-offered, which is the whole
   *    reason the emailed link points here instead of at Stripe.
   *
   * Nothing about the invoice's status changes. Arriving at Stripe is not
   * paying; only a verified webhook settles an invoice.
   */
  async beginCardPayment(id: string): Promise<{ url: string; invoice: InvoiceView }> {
    const invoice = await this.get(id);

    const { payable, reason } = this.payability(invoice.status);
    if (!payable) throw new BadRequestException(reason);
    if (!this.gateway.configured) {
      throw new ServiceUnavailableException(this.gateway.configurationError ?? "Card payment is unavailable.");
    }

    const existingId = await this.prisma.invoice
      .findUnique({ where: { id }, select: { stripeCheckoutSessionId: true } })
      .then((r) => r?.stripeCheckoutSessionId ?? null);

    if (existingId) {
      const resumed = await this.gateway.retrieveCheckout(existingId);
      if (resumed) return { url: resumed.url, invoice };
    }

    const base = this.config.get("frontendUrl", { infer: true }).replace(/\/$/, "");
    const checkout = await this.gateway.createCheckout({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      description: `Nonni's invoice ${invoice.invoiceNumber}`,
      amount: new Prisma.Decimal(invoice.amountDue),
      currency: invoice.currency,
      // Neither page may assert payment; both only report what is known.
      successUrl: `${base}/provider/invoices/${invoice.id}?payment=processing`,
      cancelUrl: `${base}/provider/invoices/${invoice.id}?payment=cancelled`,
      providerEmail: invoice.provider.email,
      providerName: invoice.provider.name,
      providerId: invoice.provider.id,
      replaces: existingId,
    });

    // Recorded so the next click resumes this session instead of opening
    // another. The status is untouched: the bill is not paid by being opened.
    await this.prisma.invoice.updateMany({
      where: { id, status: { notIn: ["PAID", "CANCELLED"] } },
      data: { stripeCheckoutSessionId: checkout.sessionId },
    });
    return { url: checkout.url, invoice };
  }

  /**
   * Begin a card payment from an emailed or printed link.
   *
   * The token is the only input, and it decides the invoice. There is no id to
   * substitute, so one provider's link can never open another's bill.
   */
  async beginCardPaymentByToken(token: string): Promise<{ url: string }> {
    const invoiceId = readPaymentToken(this.config, token);
    if (!invoiceId) throw new NotFoundException("This payment link is not valid.");

    const exists = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!exists) throw new NotFoundException("This payment link is not valid.");

    const { url } = await this.beginCardPayment(invoiceId);
    await this.audit.record({
      action: "invoice.stripe_checkout_started",
      entityType: "Invoice",
      entityId: invoiceId,
      actorRef: "system:payment-link",
      metadata: { via: "link" },
    });
    return { url };
  }

  /**
   * Settle an invoice from a VERIFIED Stripe event.
   *
   * Idempotent in two independent ways, because Stripe delivers at least once:
   * the payment row is keyed on the PaymentIntent, and the status transition is
   * conditional on the invoice not already being PAID. A redelivered event
   * therefore updates the same row and changes nothing else.
   */
  async applyStripePaid(input: {
    invoiceId: string;
    paymentIntentId: string | null;
    amount: Prisma.Decimal | null;
    stripeInvoiceId?: string | null;
  }): Promise<{ applied: boolean }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountPaid: true },
    });
    if (!invoice) {
      this.logger.warn("Stripe reported a payment for an invoice that does not exist.");
      return { applied: false };
    }

    const amount = input.amount ?? invoice.totalAmount.sub(invoice.amountPaid);
    const now = new Date();

    const applied = await this.prisma.$transaction(async (tx) => {
      if (input.paymentIntentId) {
        // One row per payment attempt, whose status evolves. A retry of the same
        // intent updates it; a different period is a different intent and a
        // different row, so history is never overwritten.
        await tx.invoicePayment.upsert({
          where: { stripePaymentIntentId: input.paymentIntentId },
          create: {
            invoiceId: invoice.id,
            amount,
            method: "STRIPE",
            status: "SUCCEEDED",
            paidAt: now,
            stripePaymentIntentId: input.paymentIntentId,
          },
          update: { status: "SUCCEEDED", amount, paidAt: now },
        });
      }

      const settled = await tx.invoice.updateMany({
        where: { id: invoice.id, status: { notIn: ["PAID", "CANCELLED"] } },
        data: {
          status: "PAID",
          paidAt: now,
          amountPaid: invoice.totalAmount,
          stripePaymentIntentId: input.paymentIntentId ?? undefined,
          ...(input.stripeInvoiceId ? { stripeInvoiceId: input.stripeInvoiceId } : {}),
        },
      });
      if (settled.count !== 1) return false;

      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "payment_succeeded",
          fromStatus: invoice.status,
          toStatus: "PAID",
          message: `Card payment of ${amount.toFixed(2)} confirmed by Stripe.`,
          actorRef: "system:stripe-webhook",
        },
      });
      return true;
    });

    if (!applied) return { applied: false };
    await this.audit.record({
      action: "invoice.payment_recorded",
      entityType: "Invoice",
      entityId: invoice.id,
      actorRef: "system:stripe-webhook",
      metadata: { invoiceNumber: invoice.invoiceNumber, method: "STRIPE", amount: amount.toFixed(2) },
    });
    return { applied: true };
  }

  /**
   * Record that a card payment did not go through.
   *
   * The invoice stays unpaid and payable — a declined card is a reason to try
   * again, not to close a bill that is genuinely owed. The failed attempt is
   * kept so the history shows what happened.
   */
  async applyStripeFailed(input: { invoiceId: string; paymentIntentId: string | null; rawStatus: string | null }): Promise<{ applied: boolean }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: input.invoiceId }, select: { id: true, status: true, invoiceNumber: true } });
    if (!invoice) return { applied: false };
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") return { applied: false };

    await this.prisma.$transaction(async (tx) => {
      if (input.paymentIntentId) {
        await tx.invoicePayment.upsert({
          where: { stripePaymentIntentId: input.paymentIntentId },
          create: {
            invoiceId: invoice.id,
            amount: new Prisma.Decimal(0),
            method: "STRIPE",
            status: "FAILED",
            paidAt: new Date(),
            stripePaymentIntentId: input.paymentIntentId,
          },
          update: { status: "FAILED" },
        });
      }
      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "payment_failed",
          message: `Card payment did not complete (${input.rawStatus ?? "failed"}).`,
          actorRef: "system:stripe-webhook",
        },
      });
    });
    return { applied: true };
  }

  /**
   * What a provider may actually do about this bill.
   *
   * Both ways are reported together, because choosing how to pay is the
   * provider's decision and not something Nonni's settles when raising the
   * invoice. `invoice.paymentMethod` is Nonni's own expectation and a default
   * for recording a manual payment — it never removes an option from the payer.
   *
   * Card availability is the gateway's own state rather than a separate flag,
   * so a screen can never advertise a button the server would refuse. The
   * reason is the gateway's safe text — never a key or a configuration detail.
   */
  paymentOptions(): { card: boolean; cardUnavailableReason: string | null; zelle: boolean; zelleRecipient: string; zelleQrUrl: string } {
    const zelle = zelleInstructions(this.config);
    return {
      card: this.gateway.configured,
      cardUnavailableReason: this.gateway.configurationError,
      // Always offered: somebody can always be shown where to send money, even
      // when no card processor is connected.
      zelle: true,
      zelleRecipient: zelle.recipient,
      zelleQrUrl: zelle.qrUrl,
    };
  }

  /** Find the invoice a Stripe Checkout Session belongs to. */
  async findByCheckoutSession(sessionId: string): Promise<{ id: string } | null> {
    return this.prisma.invoice.findUnique({ where: { stripeCheckoutSessionId: sessionId }, select: { id: true } });
  }

  // ---- shared transition ------------------------------------------------------

  private async transition(
    id: string,
    from: InvoiceStatus[],
    to: InvoiceStatus,
    event: { type: string; message: string; actorUserId: string; data?: Prisma.InvoiceUpdateInput },
  ): Promise<InvoiceView> {
    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { id: true, status: true, invoiceNumber: true } });
    if (!existing) throw new NotFoundException(`Invoice ${id} not found`);
    if (!from.includes(existing.status)) {
      throw new BadRequestException(`An invoice that is ${existing.status.toLowerCase().replace(/_/g, " ")} cannot be ${to.toLowerCase()}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional on the status just read, so two simultaneous transitions
      // cannot both apply.
      const moved = await tx.invoice.updateMany({ where: { id, status: existing.status }, data: { status: to, ...(event.data ?? {}) } });
      if (moved.count !== 1) throw new ConflictException("This invoice has just been updated. Please reload.");
      await tx.invoiceEvent.create({
        data: { invoiceId: id, type: event.type, fromStatus: existing.status, toStatus: to, message: event.message, actorUserId: event.actorUserId },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
    });

    await this.audit.record({
      action: `invoice.${event.type}`,
      entityType: "Invoice",
      entityId: id,
      actorUserId: event.actorUserId,
      metadata: { invoiceNumber: existing.invoiceNumber, from: existing.status, to },
    });
    return toInvoiceView(updated);
  }
}
