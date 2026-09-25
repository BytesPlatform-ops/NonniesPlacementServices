import { Prisma } from "@prisma/client";

export interface InvoiceLineInput {
  quantity: Prisma.Decimal | string | number;
  unitPrice: Prisma.Decimal | string | number;
}

export interface InvoiceLineTotal {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface InvoiceTotals {
  lines: InvoiceLineTotal[];
  subtotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

/** Money rounds half-up at 2 places, the convention an invoice reader expects. */
const MONEY_DP = 2;
const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(MONEY_DP, ROUND_HALF_UP);
}

/**
 * The arithmetic an invoice is made of.
 *
 * Pure and Decimal end to end. Nothing here ever becomes a JavaScript number:
 * 0.1 + 0.2 is not 0.3 in binary floating point, and an invoice that is a cent
 * out is a document somebody has to argue about.
 *
 * Each line is rounded to cents before the subtotal is taken, because that is
 * the figure printed next to it — summing unrounded lines and rounding at the
 * end produces a total that does not equal the column above it.
 *
 * Callers pass whatever the database or a DTO gave them; this decides the
 * numbers. Totals are never accepted from a client.
 */
export function calculateInvoiceTotals(items: InvoiceLineInput[], taxRateInput: Prisma.Decimal | string | number = 0): InvoiceTotals {
  const taxRate = new Prisma.Decimal(taxRateInput);

  const lines = items.map((item) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    return { quantity, unitPrice, lineTotal: money(quantity.mul(unitPrice)) };
  });

  const subtotal = money(lines.reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0)));
  const taxAmount = money(subtotal.mul(taxRate));
  const totalAmount = money(subtotal.add(taxAmount));

  return { lines, subtotal, taxRate, taxAmount, totalAmount };
}

/**
 * What is still owed.
 *
 * Clamped at zero: an overpayment is a thing to investigate, not a negative
 * balance to present as though the invoice owed money back.
 */
export function amountDue(totalAmount: Prisma.Decimal, amountPaid: Prisma.Decimal): Prisma.Decimal {
  const due = totalAmount.sub(amountPaid);
  return due.isNegative() ? new Prisma.Decimal(0) : money(due);
}

/** True once settled money covers the invoice. */
export function isFullySettled(totalAmount: Prisma.Decimal, amountPaid: Prisma.Decimal): boolean {
  return amountPaid.gte(totalAmount) && totalAmount.gt(0);
}

/**
 * The end of a fixed-length recurring plan.
 *
 * Stripe subscriptions do not stop after N charges on their own, so the end is
 * computed here and handed to Stripe as an explicit cancellation point. `periods`
 * counts charges INCLUDING the first, so two monthly periods starting 1 Jan ends
 * after the 1 Feb charge.
 */
export function recurringEndsAt(startAt: Date, periods: number, interval: "MONTHLY"): Date {
  if (periods < 1) throw new Error("A recurring invoice needs at least one billing period.");
  const end = new Date(startAt.getTime());
  if (interval === "MONTHLY") {
    const day = end.getUTCDate();
    end.setUTCMonth(end.getUTCMonth() + periods);
    // Clamp a rollover: 31 Jan + 1 month must be 28/29 Feb, not 2/3 March.
    if (end.getUTCDate() !== day) end.setUTCDate(0);
  }
  return end;
}
