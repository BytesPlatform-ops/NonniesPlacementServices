import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/request-user";
import { calculateInvoiceTotals } from "./invoice-totals";
import { generateInvoiceNumber } from "./invoices.service";

export interface SubscriptionView {
  id: string;
  provider: { id: string; name: string };
  product: { id: string; name: string };
  status: string;
  unitPrice: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  periodsBilled: number;
  totalPeriods: number | null;
  nextBillingDate: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
}

/** Advance a date by whole months, clamping a rollover into the same month. */
export function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  // 31 Jan + 1 month is 28/29 Feb, never 2/3 March.
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

/** Midnight UTC, so a period is a calendar day rather than a moment. */
function atMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toView(row: {
  id: string;
  status: string;
  unitPrice: Prisma.Decimal;
  currency: string;
  startDate: Date;
  endDate: Date | null;
  periodsBilled: number;
  totalPeriods: number | null;
  nextBillingDate: Date | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  provider: { id: string; displayName: string };
  product: { id: string; name: string };
}): SubscriptionView {
  return {
    id: row.id,
    provider: { id: row.provider.id, name: row.provider.displayName },
    product: { id: row.product.id, name: row.product.name },
    status: row.status,
    unitPrice: row.unitPrice.toFixed(2),
    currency: row.currency,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : null,
    periodsBilled: row.periodsBilled,
    totalPeriods: row.totalPeriods,
    nextBillingDate: row.nextBillingDate ? row.nextBillingDate.toISOString() : null,
    stripeSubscriptionId: row.stripeSubscriptionId,
    createdAt: row.createdAt.toISOString(),
  };
}

const include = {
  provider: { select: { id: true, displayName: true } },
  product: { select: { id: true, name: true } },
} satisfies Prisma.ProviderSubscriptionInclude;

/**
 * A provider's recurring plan, and the invoices it produces.
 *
 * Two things are kept firmly apart:
 *
 *   A. Nonni's decides WHAT is owed and WHEN — one invoice per billing period,
 *      generated here.
 *   B. A payment processor, once connected, collects it and reports back.
 *
 * Doing (A) ourselves means the billing history is complete and readable with
 * no processor at all, and that connecting Stripe later synchronizes statuses
 * onto records that already exist rather than inventing a second, competing
 * schedule.
 *
 * Generation is safe to run as often as anyone likes. The unique constraint on
 * (subscriptionId, periodStart) is what guarantees it: a second run for the same
 * month collides and is skipped, rather than billing a provider twice.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger("Subscriptions");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(providerId?: string): Promise<SubscriptionView[]> {
    const rows = await this.prisma.providerSubscription.findMany({
      where: providerId ? { providerId } : {},
      include,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toView);
  }

  async get(id: string): Promise<SubscriptionView> {
    const row = await this.prisma.providerSubscription.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException(`Subscription ${id} not found`);
    return toView(row);
  }

  /**
   * Put a provider on a recurring plan.
   *
   * The monthly amount is the figure agreed with THIS provider, not a catalogue
   * price — the product only says what kind of charge it is.
   */
  async create(
    user: RequestUser,
    dto: { providerId: string; productId: string; unitPrice: string; currency?: string; startDate?: string; totalPeriods?: number },
  ): Promise<SubscriptionView> {
    const [provider, product] = await Promise.all([
      this.prisma.provider.findUnique({ where: { id: dto.providerId }, select: { id: true } }),
      this.prisma.product.findUnique({ where: { id: dto.productId }, select: { id: true, recurring: true } }),
    ]);
    if (!provider) throw new NotFoundException(`Provider ${dto.providerId} not found`);
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);
    if (!product.recurring) throw new BadRequestException("That product is not billed monthly.");

    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    if (unitPrice.lte(0)) throw new BadRequestException("Enter the agreed monthly amount.");
    if (dto.totalPeriods !== undefined && dto.totalPeriods < 1) {
      throw new BadRequestException("A fixed-length plan needs at least one billing period.");
    }

    const startDate = atMidnight(dto.startDate ? new Date(dto.startDate) : new Date());
    const endDate = dto.totalPeriods ? addMonths(startDate, dto.totalPeriods) : null;

    const created = await this.prisma.providerSubscription.create({
      data: {
        providerId: dto.providerId,
        productId: dto.productId,
        status: "ACTIVE",
        unitPrice,
        currency: (dto.currency ?? "USD").toUpperCase(),
        startDate,
        endDate,
        totalPeriods: dto.totalPeriods ?? null,
        // The first invoice covers the period beginning on the start date.
        nextBillingDate: startDate,
        createdByUserId: user.id,
      },
      include,
    });

    await this.audit.record({
      action: "subscription.created",
      entityType: "ProviderSubscription",
      entityId: created.id,
      actorUserId: user.id,
      metadata: { unitPrice: unitPrice.toFixed(2), currency: created.currency, totalPeriods: dto.totalPeriods ?? null },
    });
    return toView(created);
  }

  async cancel(user: RequestUser, id: string): Promise<SubscriptionView> {
    const existing = await this.prisma.providerSubscription.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException(`Subscription ${id} not found`);
    if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
      throw new BadRequestException("This subscription has already ended.");
    }

    const updated = await this.prisma.providerSubscription.update({
      where: { id },
      // Invoices already generated are left exactly as they are: cancelling a
      // plan does not unbill months that were genuinely owed.
      data: { status: "CANCELLED", cancelledAt: new Date(), nextBillingDate: null },
      include,
    });
    await this.audit.record({
      action: "subscription.cancelled",
      entityType: "ProviderSubscription",
      entityId: id,
      actorUserId: user.id,
      metadata: { periodsBilled: updated.periodsBilled },
    });
    return toView(updated);
  }

  /**
   * Generate any invoice that has come due.
   *
   * Idempotent by construction rather than by checking first: the invoice is
   * simply written, and a unique (subscriptionId, periodStart) makes a repeat
   * run collide and skip. That is what makes this safe to call from a cron, a
   * button, and a retry of either, all at once.
   *
   * Each period produces its own DRAFT invoice. It still has to be approved
   * before it reaches the provider — a recurring plan does not bypass the rule
   * that a person stands behind every amount that goes out.
   */
  async generateDueInvoices(now: Date = new Date()): Promise<{ generated: number; skipped: number; completed: number }> {
    const today = atMidnight(now);
    const due = await this.prisma.providerSubscription.findMany({
      where: { status: "ACTIVE", nextBillingDate: { not: null, lte: today } },
      include,
    });

    let generated = 0;
    let skipped = 0;
    let completed = 0;

    for (const sub of due) {
      const periodStart = sub.nextBillingDate!;
      const periodEnd = addMonths(periodStart, 1);

      // A fixed-length plan stops when its periods are used up.
      if (sub.totalPeriods !== null && sub.periodsBilled >= sub.totalPeriods) {
        await this.complete(sub.id);
        completed += 1;
        continue;
      }

      try {
        const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: sub.unitPrice }]);
        await this.prisma.$transaction(async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber: generateInvoiceNumber(periodStart),
              providerId: sub.providerId,
              status: "DRAFT",
              billingType: "RECURRING",
              paymentMethod: "STRIPE",
              issueDate: periodStart,
              dueDate: periodEnd,
              currency: sub.currency,
              subtotal: totals.subtotal,
              taxRate: totals.taxRate,
              taxAmount: totals.taxAmount,
              totalAmount: totals.totalAmount,
              subscriptionId: sub.id,
              periodStart,
              periodEnd,
              recurringInterval: "MONTHLY",
              items: {
                create: {
                  productId: sub.productId,
                  name: sub.product.name,
                  description: `Billing period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
                  quantity: totals.lines[0]!.quantity,
                  unitPrice: totals.lines[0]!.unitPrice,
                  lineTotal: totals.lines[0]!.lineTotal,
                  position: 0,
                },
              },
              events: {
                create: {
                  type: "created",
                  toStatus: "DRAFT",
                  message: `Generated for billing period ${periodStart.toISOString().slice(0, 10)}.`,
                  actorRef: "system:subscription-billing",
                },
              },
            },
            select: { id: true, invoiceNumber: true },
          });

          // Advance only after the invoice exists, so a crash mid-run resumes on
          // the same period rather than silently skipping a month.
          await tx.providerSubscription.update({
            where: { id: sub.id },
            data: { periodsBilled: { increment: 1 }, nextBillingDate: periodEnd },
          });
          return invoice;
        });
        generated += 1;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // This period is already invoiced. Move the pointer on so the run
          // makes progress instead of colliding on the same month forever.
          await this.prisma.providerSubscription.update({ where: { id: sub.id }, data: { nextBillingDate: periodEnd } });
          skipped += 1;
          continue;
        }
        throw err;
      }

      const after = await this.prisma.providerSubscription.findUnique({ where: { id: sub.id }, select: { periodsBilled: true, totalPeriods: true } });
      if (after?.totalPeriods !== null && after && after.periodsBilled >= after.totalPeriods!) {
        await this.complete(sub.id);
        completed += 1;
      }
    }

    if (generated || skipped || completed) {
      this.logger.log(`Subscription billing: ${generated} generated, ${skipped} already present, ${completed} completed.`);
    }
    return { generated, skipped, completed };
  }

  // ---- Stripe synchronization -------------------------------------------------

  /**
   * A Stripe subscription charge succeeded.
   *
   * Maps onto the OLDEST unsettled Nonnis invoice for that plan, which is the
   * period the charge is paying for. Linking the Stripe invoice id makes this
   * idempotent: a redelivered event finds the row it already settled instead of
   * consuming another period.
   */
  async applyStripeInvoicePaid(input: {
    stripeSubscriptionId: string;
    stripeInvoiceId: string | null;
    paymentIntentId: string | null;
    amount: Prisma.Decimal | null;
  }): Promise<{ applied: boolean }> {
    const sub = await this.prisma.providerSubscription.findUnique({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
      select: { id: true },
    });
    if (!sub) {
      this.logger.warn("Stripe reported a subscription charge for a plan we do not hold.");
      return { applied: false };
    }

    // Already linked: this exact Stripe invoice has been handled.
    if (input.stripeInvoiceId) {
      const seen = await this.prisma.invoice.findUnique({ where: { stripeInvoiceId: input.stripeInvoiceId }, select: { id: true } });
      if (seen) return { applied: false };
    }

    const target = await this.prisma.invoice.findFirst({
      where: { subscriptionId: sub.id, status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: { periodStart: "asc" },
      select: { id: true, invoiceNumber: true, status: true, totalAmount: true },
    });
    if (!target) {
      // Stripe is ahead of our generation run. Acknowledged, never guessed at:
      // inventing an invoice here would bill a period we have not raised.
      this.logger.warn("A subscription charge arrived with no unsettled Nonnis invoice to match it.");
      return { applied: false };
    }

    const amount = input.amount ?? target.totalAmount;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (input.paymentIntentId) {
        await tx.invoicePayment.upsert({
          where: { stripePaymentIntentId: input.paymentIntentId },
          create: {
            invoiceId: target.id,
            amount,
            method: "STRIPE",
            status: "SUCCEEDED",
            paidAt: now,
            stripePaymentIntentId: input.paymentIntentId,
          },
          update: { status: "SUCCEEDED", amount, paidAt: now },
        });
      }
      await tx.invoice.updateMany({
        where: { id: target.id, status: { notIn: ["PAID", "CANCELLED"] } },
        data: {
          status: "PAID",
          paidAt: now,
          amountPaid: target.totalAmount,
          stripeInvoiceId: input.stripeInvoiceId ?? undefined,
          stripePaymentIntentId: input.paymentIntentId ?? undefined,
        },
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId: target.id,
          type: "payment_succeeded",
          fromStatus: target.status,
          toStatus: "PAID",
          message: `Subscription charge of ${amount.toFixed(2)} confirmed by Stripe.`,
          actorRef: "system:stripe-webhook",
        },
      });
    });

    await this.audit.record({
      action: "invoice.payment_recorded",
      entityType: "Invoice",
      entityId: target.id,
      actorRef: "system:stripe-webhook",
      metadata: { invoiceNumber: target.invoiceNumber, method: "STRIPE", amount: amount.toFixed(2), recurring: true },
    });
    return { applied: true };
  }

  /**
   * A Stripe subscription charge failed.
   *
   * The month stays unpaid and stays visible. Stripe will retry on its own
   * schedule; a later success settles the same invoice through the paid handler,
   * so November can read FAILED today and PAID next week without losing either
   * fact.
   */
  async applyStripeInvoiceFailed(input: {
    stripeSubscriptionId: string;
    stripeInvoiceId: string | null;
    paymentIntentId: string | null;
  }): Promise<{ applied: boolean }> {
    const sub = await this.prisma.providerSubscription.findUnique({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
      select: { id: true },
    });
    if (!sub) return { applied: false };

    const target = await this.prisma.invoice.findFirst({
      where: { subscriptionId: sub.id, status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: { periodStart: "asc" },
      select: { id: true },
    });
    if (!target) return { applied: false };

    await this.prisma.$transaction(async (tx) => {
      if (input.paymentIntentId) {
        await tx.invoicePayment.upsert({
          where: { stripePaymentIntentId: input.paymentIntentId },
          create: {
            invoiceId: target.id,
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
          invoiceId: target.id,
          type: "payment_failed",
          message: "Subscription charge failed at Stripe. It will be retried.",
          actorRef: "system:stripe-webhook",
        },
      });
    });
    // The plan itself is flagged, so admin and provider both see why.
    await this.prisma.providerSubscription.updateMany({ where: { id: sub.id, status: "ACTIVE" }, data: { status: "PAST_DUE" } });
    return { applied: true };
  }

  /**
   * Stripe says the subscription has ended.
   *
   * Synchronizes our status only. Invoices already raised stay exactly as they
   * are — a plan ending does not unbill months that were genuinely owed.
   */
  async applyStripeSubscriptionEnded(stripeSubscriptionId: string): Promise<{ applied: boolean }> {
    const updated = await this.prisma.providerSubscription.updateMany({
      where: { stripeSubscriptionId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), nextBillingDate: null },
    });
    return { applied: updated.count === 1 };
  }

  private async complete(id: string): Promise<void> {
    await this.prisma.providerSubscription.update({
      where: { id },
      data: { status: "COMPLETED", nextBillingDate: null },
    });
    await this.audit.record({
      action: "subscription.completed",
      entityType: "ProviderSubscription",
      entityId: id,
      actorRef: "system:subscription-billing",
      metadata: {},
    });
  }
}
