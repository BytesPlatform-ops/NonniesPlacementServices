import { Prisma } from "@prisma/client";
import { amountDue } from "./invoice-totals";

export const invoiceInclude = {
  provider: { select: { id: true, displayName: true, email: true } },
  items: { orderBy: { position: "asc" } },
  payments: { orderBy: { paidAt: "desc" } },
  events: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export interface InvoiceItemView {
  id: string;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  position: number;
}

export interface InvoicePaymentView {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
  reference: string | null;
  /** True when a person confirmed it; false when Stripe's webhook did. */
  verified: boolean;
  verifiedAt: string | null;
}

export interface InvoiceEventView {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  createdAt: string;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  provider: { id: string; name: string; email: string | null };
  caseId: string | null;
  orderId: string | null;
  status: string;
  billingType: string;
  paymentMethod: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  /** Present only when a payment page exists to send someone to. */
  hasStripeSession: boolean;
  recurringInterval: string | null;
  recurringPeriods: number | null;
  recurringStartAt: string | null;
  recurringEndsAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: InvoiceItemView[];
  payments: InvoicePaymentView[];
  events: InvoiceEventView[];
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const money = (d: Prisma.Decimal): string => d.toFixed(2);

/**
 * Money is serialized as a fixed-2 STRING, never a number: JSON numbers are
 * IEEE-754 doubles, and a total that survives the database exactly should not
 * lose a cent on the way to a browser.
 *
 * Stripe's session, payment-intent, subscription and customer ids are
 * deliberately NOT projected. They are reconciliation handles for the Stripe
 * dashboard; nothing in the product needs them, and a provider certainly does not.
 */
export function toInvoiceView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    provider: { id: row.provider.id, name: row.provider.displayName, email: row.provider.email },
    caseId: row.caseId,
    orderId: row.orderId,
    status: row.status,
    billingType: row.billingType,
    paymentMethod: row.paymentMethod,
    issueDate: row.issueDate.toISOString(),
    dueDate: iso(row.dueDate),
    currency: row.currency,
    subtotal: money(row.subtotal),
    taxRate: row.taxRate.toFixed(4),
    taxAmount: money(row.taxAmount),
    totalAmount: money(row.totalAmount),
    amountPaid: money(row.amountPaid),
    amountDue: money(amountDue(row.totalAmount, row.amountPaid)),
    notes: row.notes,
    hasStripeSession: !!row.stripeCheckoutSessionId || !!row.stripeSubscriptionId,
    recurringInterval: row.recurringInterval,
    recurringPeriods: row.recurringPeriods,
    recurringStartAt: iso(row.recurringStartAt),
    recurringEndsAt: iso(row.recurringEndsAt),
    sentAt: iso(row.sentAt),
    paidAt: iso(row.paidAt),
    cancelledAt: iso(row.cancelledAt),
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      quantity: i.quantity.toFixed(2),
      unitPrice: money(i.unitPrice),
      lineTotal: money(i.lineTotal),
      position: i.position,
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: money(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
      reference: p.reference,
      verified: !!p.verifiedByUserId,
      verifiedAt: iso(p.verifiedAt),
    })),
    events: row.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
